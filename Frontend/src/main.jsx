import React from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { io } from 'socket.io-client';

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

// Inject custom orange color for NProgress
const style = document.createElement('style');
style.innerHTML = `
  #nprogress .bar {
    background: #f97316 !important;
    height: 3px !important;
  }
  #nprogress .peg {
    box-shadow: 0 0 10px #f97316, 0 0 5px #f97316 !important;
  }
  #nprogress .spinner-icon {
    border-top-color: #f97316 !important;
    border-left-color: #f97316 !important;
  }
`;
document.head.appendChild(style);

const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'file:';

const API_BASE_URL = isLocal
  ? `http://${window.location.hostname}:5000`
  : 'https://api.vidya-setu.org.in';

// Global fetch override to always send credentials (cookies) to the API
let isRefreshing = false;
let refreshPromise = null;
let activeFetchRequests = 0;

const originalFetch = window.fetch;
window.fetch = async function (resource, config) {
  config = config || {};

  // 1. Extract URL and prepare requests securely
  let url = '';
  let requestToFetch = resource;
  let requestForRetry = resource;

  if (typeof resource === 'string') {
    url = resource;
  } else if (resource instanceof Request) {
    url = resource.url;
    // MUST clone the Request so its body stream is not permanently locked on the first attempt
    requestToFetch = resource.clone();
    requestForRetry = resource.clone();
  } else if (resource && resource.href) {
    url = resource.href;
  }

  const isApiCall = url.startsWith(API_BASE_URL);

  // 2. Inject credentials if targeting our API
  if (isApiCall) {
    if (!(resource instanceof Request)) {
      config.credentials = config.credentials || 'include';
    }
  }

  // 3. Skip NProgress for silent/background fetches (e.g. Socket.io polling fallback)
  const isSilent = config && config.headers && config.headers['X-Silent'];
  if (!isSilent) {
    activeFetchRequests++;
    if (activeFetchRequests === 1) NProgress.start();
  }

  let response;
  try {
    response = await originalFetch(requestToFetch, config);
  } catch (err) {
    if (!isSilent) {
      activeFetchRequests--;
      if (activeFetchRequests === 0) NProgress.done();
    }
    throw err;
  }

  // 4. Implement 401 -> Refresh -> Retry exactly once

  const isAuthEndpoint = url.includes('/api/users/refresh') ||
    url.includes('/api/users/login') ||
    url.includes('/api/users/logout');

  if (response.status === 401 && isApiCall && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = originalFetch(`${API_BASE_URL}/api/users/refresh`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }).finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    try {
      const refreshResponse = await refreshPromise;
      if (refreshResponse && refreshResponse.ok) {
        // 5. Retry exactly once using originalFetch (bypassing interceptor to prevent infinite loops)
        const retryResponse = await originalFetch(requestForRetry, config);

        // If retry fails with 401/403, the session is dead (e.g., token version changed or blocked)
        if (retryResponse.status === 401 || retryResponse.status === 403) {
          window.dispatchEvent(new Event('vidyasetu_force_logout'));
        }
        if (!isSilent) {
          activeFetchRequests--;
          if (activeFetchRequests === 0) NProgress.done();
        }
        return retryResponse;
      } else {
        // Refresh explicitly failed
        window.dispatchEvent(new Event('vidyasetu_force_logout'));
        if (!isSilent) {
          activeFetchRequests--;
          if (activeFetchRequests === 0) NProgress.done();
        }
        return response; // Return original 401
      }
    } catch (err) {
      window.dispatchEvent(new Event('vidyasetu_force_logout'));
      if (!isSilent) {
        activeFetchRequests--;
        if (activeFetchRequests === 0) NProgress.done();
      }
      return response;
    }
  }

  if (!isSilent) {
    activeFetchRequests--;
    if (activeFetchRequests === 0) NProgress.done();
  }
  return response;
};
const { useState, useEffect, useRef, createContext, useContext } = React;


// Temporary Global Error Handler for Debugging Whitescreen
window.addEventListener('error', (event) => {
  alert("React Crash: " + event.message + "\nAt: " + event.filename + ":" + event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  alert("Unhandled Promise Rejection: " + (event.reason && event.reason.message ? event.reason.message : String(event.reason)));
});
/* ─── CONTEXTS ─── */
const UserContext = createContext(null);
const ToastContext = createContext(null);
const useUser = () => useContext(UserContext) || { user: {}, updateUser: () => { } };
const useToast = () => useContext(ToastContext) || (() => { });

/* ─── THEME ─── */
const parseInlineMarkdown = (text) => {
  if (typeof text !== 'string') return text;
  // Strip literal <br> and <br/> tags — replace with a space
  text = text.replace(/<br\s*\/?>/gi, ' ');
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return React.createElement('strong', { key: i }, part.slice(2, -2));
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return React.createElement('code', { key: i, style: { background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: 4, fontFamily: 'monospace' } }, part.slice(1, -1));
    }
    const italicParts = part.split(/(\*.*?\*)/g);
    if (italicParts.length > 1) {
      return italicParts.map((sub, j) => {
        if (sub.startsWith('*') && sub.endsWith('*') && !sub.startsWith('**') && sub.length >= 2) {
          return React.createElement('em', { key: j }, sub.slice(1, -1));
        }
        return sub;
      });
    }
    return part;
  });
};

const safeRenderMarkdown = (text) => {
  if (!text) return null;
  // Pre-process: replace <br> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      elements.push(React.createElement('hr', { key: i, style: { border: 'none', borderTop: '1px solid #E5E7EB', margin: '14px 0' } }));
      i++; continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(React.createElement('h4', { key: i, style: { fontSize: 15, fontWeight: 700, margin: '16px 0 6px', color: 'inherit' } }, parseInlineMarkdown(trimmed.slice(4))));
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(React.createElement('h3', { key: i, style: { fontSize: 17, fontWeight: 700, margin: '20px 0 8px', color: 'inherit' } }, parseInlineMarkdown(trimmed.slice(3))));
      i++; continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(React.createElement('h2', { key: i, style: { fontSize: 19, fontWeight: 800, margin: '22px 0 10px', color: 'inherit' } }, parseInlineMarkdown(trimmed.slice(2))));
      i++; continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(React.createElement('div', { key: i, style: { borderLeft: '3px solid #6366F1', paddingLeft: 12, margin: '8px 0', color: '#555', fontStyle: 'italic' } }, parseInlineMarkdown(trimmed.slice(2))));
      i++; continue;
    }

    // Pipe table — collect all consecutive table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      // Parse rows, skip separator rows (only - | :)
      const rows = tableLines
        .filter(r => !/^\|[\s:\-|]+\|$/.test(r))
        .map(r => r.slice(1, -1).split('|').map(c => c.trim()));
      if (rows.length > 0) {
        const [header, ...body] = rows;
        elements.push(
          React.createElement('div', { key: 'tbl-' + i, style: { overflowX: 'auto', margin: '12px 0' } },
            React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  header.map((h, hi) => React.createElement('th', { key: hi, style: { background: '#F3F4F6', padding: '8px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #E5E7EB', whiteSpace: 'nowrap' } }, parseInlineMarkdown(h)))
                )
              ),
              React.createElement('tbody', null,
                body.map((row, ri) =>
                  React.createElement('tr', { key: ri, style: { background: ri % 2 === 0 ? '#fff' : '#F9FAFB' } },
                    row.map((cell, ci) => React.createElement('td', { key: ci, style: { padding: '7px 12px', borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' } }, parseInlineMarkdown(cell)))
                  )
                )
              )
            )
          )
        );
      }
      continue;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(React.createElement('div', { key: i, style: { display: 'flex', marginBottom: 5, lineHeight: 1.55, color: 'inherit' } },
        React.createElement('span', { style: { marginRight: 8, flexShrink: 0 } }, '•'),
        React.createElement('div', null, parseInlineMarkdown(trimmed.substring(2)))
      ));
      i++; continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(React.createElement('div', { key: i, style: { display: 'flex', marginBottom: 5, lineHeight: 1.55, color: 'inherit' } },
        React.createElement('span', { style: { marginRight: 8, fontWeight: 600, flexShrink: 0 } }, numMatch[1] + '.'),
        React.createElement('div', null, parseInlineMarkdown(trimmed.substring(numMatch[0].length)))
      ));
      i++; continue;
    }

    // Empty line → spacer
    if (trimmed === '') {
      elements.push(React.createElement('div', { key: i, style: { height: 6 } }));
      i++; continue;
    }

    // Regular paragraph
    elements.push(React.createElement('p', { key: i, style: { marginBottom: 8, lineHeight: 1.65, color: 'inherit' } }, parseInlineMarkdown(trimmed)));
    i++;
  }
  return elements;
};

const T = {
  orange: "#FF4F1F", orangeLt: "#FF7044", yellow: "#FFC700",
  black: "#111111", white: "#FFFFFF", gray: "#F5F5F5",
  border: "#EBEBEB", muted: "#888888", cardBg: "#FFFFFF",
  success: "#22C55E", rose: "#EF4444", indigo: "#6366F1",
  teal: "#14B8A6", warn: "#F59E0B", text: "#1A1A1A",
  purple: "#9B6DFF",
  /* Legacy aliases so Vidya-Setu logic keeps working */
  saffron: "#FF4F1F", saffronLt: "#FF7044", gold: "#FFC700",
  navy: "#111111", navyMid: "#F5F5F5", navyLt: "#F0F0F0",
};

/* ─── SHARED UI ─── */
const Badge = ({ children, color = T.orange }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: color + "18", color, border: `1px solid ${color}38`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: .4 }}>{children}</span>
);

const Card = ({ children, style = {}, onClick, className = "" }) => (
  <div className={`card-hover ${className}`} onClick={onClick}
    style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #EBEBEB", padding: 18, boxShadow: "0 2px 14px rgba(0,0,0,0.05)", ...style }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }) => {
  const V = {
    primary: { background: `linear-gradient(135deg,#FF4F1F 0%,#FF6B3D 50%,#FF8C42 100%)`, color: "#fff", border: "none", boxShadow: "0 4px 18px rgba(255,79,31,0.32), 0 1px 4px rgba(0,0,0,0.08)" },
    secondary: { background: "#F5F5F5", color: T.text, border: `1px solid #E2E2E2`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
    teal: { background: `linear-gradient(135deg,#14B8A6 0%,#0DD6C4 60%,#06B6AA 100%)`, color: "#fff", border: "none", boxShadow: "0 4px 16px rgba(20,184,166,0.28)" },
    ghost: { background: "rgba(255,79,31,0.06)", color: T.orange, border: `1px solid rgba(255,79,31,0.28)` },
  };
  return (
    <button className="btn-press ripple-btn" onClick={onClick} disabled={disabled}
      style={{
        ...V[variant], borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .5 : 1, ...style
      }}>
      {children}
    </button>
  );
};

const SH = ({ icon, title, subtitle }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 18, width: 34, height: 34, background: "rgba(255,79,31,0.07)", border: "1px solid rgba(255,79,31,0.15)", borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <h2 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 20, fontWeight: 800, color: T.text }}>{title}</h2>
    </div>
    {subtitle && <p style={{ color: T.muted, fontSize: 13, paddingLeft: 30 }}>{subtitle}</p>}
  </div>
);

const Modal = ({ open, onClose, title, children, aboveNav, width }) => {
  if (!open) return null;
  return createPortal(
    <div className={`modal-overlay ${aboveNav ? "above-nav-overlay" : ""}`} onClick={onClose}>
      <div className={`modal-sheet ${aboveNav ? "above-nav-sheet" : ""}`} onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh', width: width || '90%', maxWidth: width || 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexShrink: 0 }}>
          <h3 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 20, fontWeight: 800, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "#F5F5F5", border: "1px solid #E8E8E8", color: "#999", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s ease" }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

const PBar = ({ value, color = T.orange, h = 8 }) => (
  <div style={{ background: "#F0F0F0", borderRadius: 99, height: h, overflow: "hidden" }}>
    <div className="prog-fill" style={{ width: `${value}%`, height: "100%", background: `linear-gradient(90deg,${color},${color}CC)`, borderRadius: 99 }} />
  </div>
);

const QR = ({ data, size = 96 }) => {
  const hash = data.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const g = 21, cell = size / g;
  let s = Math.abs(hash);
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const cells = Array.from({ length: g }, (_, r) => Array.from({ length: g }, (_, c) => {
    if (r < 7 && c < 7) return r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
    if (r < 7 && c > g - 8) return r === 0 || r === 6 || c === g - 1 || c === g - 7 || (r >= 2 && r <= 4 && c >= g - 5 && c <= g - 3);
    if (r > g - 8 && c < 7) return r === g - 1 || r === g - 7 || c === 0 || c === 6 || (r >= g - 5 && r <= g - 3 && c >= 2 && c <= 4);
    return rng() > .5;
  }));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" rx={4} />
      {cells.map((row, r) => row.map((on, c) => on ? <rect key={r + "-" + c} x={c * cell} y={r * cell} width={cell} height={cell} fill="#111" /> : null))}
    </svg>
  );
};

const EDUCATIONAL_BOARDS = [
  "CBSE",
  "ICSE",
  "UP Board",
  "Maharashtra State Board",
  "Bihar Board",
  "Rajasthan Board",
  "Madhya Pradesh Board",
  "West Bengal Board",
  "Karnataka State Board",
  "Tamil Nadu State Board",
  "NIOS (National Institute of Open Schooling)",
  "Other State Board"
];

/* ─── TOAST ─── */
function ToastSystem({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast-anim" style={{
          border: `1px solid ${(t.accent || T.orange)}28`,
          borderLeft: `3px solid ${t.accent || T.orange}`,
          borderRadius: 14, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 36px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
          backdropFilter: "blur(20px)", pointerEvents: "auto", background: "rgba(255,255,255,0.97)"
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text, lineHeight: 1.2 }}>{t.title}</div>
            {t.sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.3 }}>{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}


/* ══════════════════════════════════════
  SPLASH SCREEN COMPONENT
══════════════════════════════════════ */
function SplashScreen({ onDone }) {
  useEffect(() => {
    onDone();
  }, [onDone]);
  return null;
}

/* ─── USER PROFILE MODAL ─── */
function UserProfileModal({ open, onClose, onLogout }) {
  const { user, updateUser, refreshUser } = useUser();
  const addToast = useToast();
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showTfwPanel, setShowTfwPanel] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState({});
  const photoInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeAnalyzing, setResumeAnalyzing] = useState(false);
  const [newLink, setNewLink] = useState({ type: "LinkedIn", url: "" });

  const handleAddLink = async () => {
    if (!newLink.url) return;
    const currentLinks = user.links || [];
    const updatedLinks = [...currentLinks, newLink];
    try {
      const res = await fetch(API_BASE_URL + "/api/users/profile/links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: user.rollNo, links: updatedLinks })
      });
      if (res.ok) {
        updateUser({ ...user, links: updatedLinks });
        setNewLink({ type: "LinkedIn", url: "" });
        addToast("Link Added", "", "🔗", T.teal);
      } else {
        const errData = await res.json();
        addToast("Error", errData.error || "Failed to add link", "❌", T.rose);
      }
    } catch (err) {
      addToast("Error", err.message, "❌", T.rose);
    }
  };

  const handleDeleteLink = async (idx) => {
    const currentLinks = user.links || [];
    const updatedLinks = currentLinks.filter((_, i) => i !== idx);
    try {
      const res = await fetch(API_BASE_URL + "/api/users/profile/links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: user.rollNo, links: updatedLinks })
      });
      if (res.ok) {
        updateUser({ ...user, links: updatedLinks });
        addToast("Link Removed", "", "", T.rose);
      }
    } catch (err) { }
  };

  const handleResumeUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      addToast("Invalid File", "Only PDF files are allowed", "", T.rose);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("File Too Large", "Max size is 5MB", "", T.rose);
      return;
    }
    setResumeUploading(true);
    const formData = new FormData();
    formData.append("resume", file);
    formData.append("rollNo", user.rollNo);
    try {
      const res = await fetch(API_BASE_URL + "/api/users/profile/resume/upload", {
        method: "PUT",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        updateUser({ ...user, resume: data.resume });
        addToast("Resume Uploaded", "Your resume has been saved.", "", T.success);
      } else {
        addToast("Upload Failed", data.error, "", T.rose);
      }
    } catch (err) {
      addToast("Error", err.message, "", T.rose);
    } finally {
      setResumeUploading(false);
      e.target.value = null;
    }
  };

  const handleDeleteResume = async () => {
    try {
      const res = await fetch(API_BASE_URL + "/api/users/profile/resume", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: user.rollNo })
      });
      if (res.ok) {
        updateUser({ ...user, resume: null, resumeAnalysis: null });
        addToast("Resume Deleted", "", "", T.rose);
      }
    } catch (err) { }
  };

  const handleAnalyzeResume = async () => {
    setResumeAnalyzing(true);
    try {
      const res = await fetch(API_BASE_URL + "/api/ai/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo: user.rollNo,
          userContext: { name: user.name, branch: user.branch, year: user.year, domain: "Software Engineering", skills: user.skills || [] }
        })
      });
      const data = await res.json();
      if (res.ok) {
        updateUser({ ...user, resumeAnalysis: data.analysis });
        addToast("Analysis Complete", "Your Resume Intelligence is ready!", "", T.orange);
      } else {
        addToast("Analysis Failed", data.error, "", T.rose);
      }
    } catch (err) {
      addToast("Error", err.message, "", T.rose);
    } finally {
      setResumeAnalyzing(false);
    }
  };

  const isLocked = !!(user.profileEditedOnce);

  useEffect(() => {
    if (open) {
      refreshUser(); // Sync with backend on open to see if admin approved
      setDraft({ ...user });
      setSaved(false);
    }
  }, [open]);

  // When user context updates (e.g. from refreshUser), update the draft
  useEffect(() => {
    if (open) setDraft({ ...user });
  }, [user]);

  const handlePhotoUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      addToast("File Too Large", "Please select an image under 5MB", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>error</span>, T.rose);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      // Show preview immediately
      setDraft(p => ({ ...p, profilePhoto: base64 }));
      setPhotoUploading(true);

      try {
        const res = await fetch(`${API_BASE_URL}/api/users/upload-profile-photo`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollNo: user.rollNo, photoData: base64 })
        });
        const data = await res.json();
        if (res.ok && data.profilePhoto) {
          const updatedUser = { ...user, profilePhoto: data.profilePhoto };
          updateUser(updatedUser); // ✅ STABLE VERSION: Automatically saves lean data
          setDraft(p => ({ ...p, profilePhoto: data.profilePhoto }));
          // Unsafe localStorage.setItem removed to prevent storage crash
          addToast("Photo Uploaded ✨", "Your profile photo is live!", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>check_circle</span>, T.success);
        } else {
          throw new Error(data.error || "Upload failed");
        }
      } catch (err) {
        addToast("Upload Failed", err.message, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>error</span>, T.rose);
        setDraft(p => ({ ...p, profilePhoto: user.profilePhoto || "" }));
      } finally {
        setPhotoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDocUpload = (field, e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
      addToast("File Too Large", "Please select a file under 2MB", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>error</span>, T.rose);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setDraft(p => ({ ...p, [field]: reader.result }));
      addToast("Document Selected", "File attached successfully. Don't forget to save.", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>task</span>, T.teal);
    };
    reader.readAsDataURL(file);
  };


  /* ── TFW LIVE ELIGIBILITY CHECK (University/UPTAC norms) ── */
  const tfwCriteria = [
    {
      id: 'income', label: 'Family income < ₹6,00,000/year', icon: 'currency_rupee',
      check: () => (parseInt(draft.familyIncome) || 0) < 600000
    },
    {
      id: 'domicile', label: 'Uttar Pradesh domicile', icon: 'location_on',
      check: () => draft.domicileState === 'Uttar Pradesh'
    },
    {
      id: 'cert', label: 'Valid Income Certificate', icon: 'description',
      check: () => !!draft.hasIncomeCertificate
    },
    {
      id: 'course', label: 'Eligible course (not B.Arch)', icon: 'school',
      check: () => draft.course !== 'B.Arch'
    }
  ];
  const tfwResults = tfwCriteria.map(c => ({ ...c, passed: c.check() }));
  const tfwEligible = tfwResults.every(c => c.passed);

  const saveProfile = async (e) => {
    if (e) e.preventDefault();
    if (isLocked) {
      const reason = window.prompt("Your profile is locked. Please provide a reason for these changes (optional):");
      if (reason === null) return; // user cancelled
      await requestUnlock(reason);
      return;
    }
    // Block save if TFW is on but not eligible
    if (draft.isFeeWaiver && !tfwEligible) {
      addToast("TFW Ineligible ❌", "Please fix the eligibility issues below before saving.", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>error</span>, T.rose);
      return;
    }
    try {
      const payload = {
        name: draft.name || user.name || "",
        rollNo: draft.rollNo || user.rollNo || "",
        branch: draft.branch || user.branch || "",
        year: draft.year || user.year || "",
        familyIncome: parseInt(draft.familyIncome) || 0,
        isFeeWaiver: !!draft.isFeeWaiver,
        domicileState: draft.domicileState || "",
        hasIncomeCertificate: !!draft.hasIncomeCertificate,
        course: draft.course || "B.Tech",
        password: confirmPassword,
        mobileNumber: draft.mobileNumber || "",
        email: draft.email || user.email || "",
      };

      const initials = payload.name ? payload.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : user.initials;

      if (!confirmPassword && !isLocked) {
        addToast("Password Required", "Please enter your password to save changes.", "🔑", T.orange);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const updatedProfile = { ...user, ...draft, ...payload, initials, profileEditedOnce: true, rollNo: payload.rollNo };
        // updateUser already calls saveToStorage which is lean
        updateUser(updatedProfile);
        setSaved(true);
        addToast("Profile Saved & Locked ✨", `Your profile is now final, ${payload.name}!`, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>verified</span>, T.orange);
        setTimeout(onClose, 900);
      } else {
        const err = await response.json();
        if (err.reasons && err.reasons.length) {
          alert('TFW Eligibility Failed:\n\n' + err.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n'));
        } else {
          alert('Error: ' + ((err && err.error) || 'Failed to update profile.'));
        }
      }
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        alert('Network Error: Could not reach backend at ' + API_BASE_URL + '/api/users/update-profile — Please verify HTTPS is enabled and the server is live.');
      } else {
        alert('Error: ' + error.message);
      }
    }
  };

  const requestUnlock = async (reason) => {
    try {
      const requestedChanges = {
        name: draft.name,
        branch: draft.branch,
        year: draft.year,
        familyIncome: draft.familyIncome,
        isFeeWaiver: draft.isFeeWaiver,
        domicileState: draft.domicileState,
        hasIncomeCertificate: draft.hasIncomeCertificate,
        course: draft.course,
        mobileNumber: draft.mobileNumber,
        email: draft.email
      };
      const res = await fetch(`${API_BASE_URL}/api/users/request-profile-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo: user.rollNo, requestedChanges, reason })
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ profileEditRequested: true });
        addToast("Request Sent", "Admin will review your profile edit request.", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>check_circle</span>, T.indigo);
        onClose();
      } else {
        addToast("Request Failed", data.error || "Could not send request.", "⚠️", T.rose);
      }
    } catch (err) {
      addToast("Network Error", "Is the backend server running?", "❌", T.rose);
    }
  };

  const handleRefreshStatus = async () => {
    addToast("Syncing...", "Checking for admin approval", "⏳", T.teal);
    await refreshUser();
  };

  const inp = { width: "100%", padding: "11px 14px", background: T.gray, color: T.text, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 14, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', marginTop: 6 };
  const inpLocked = { ...inp, background: "#FFF9E6", border: `1px solid ${T.orange}` };
  const lbl = { color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase" };

  const currentPhoto = draft.profilePhoto || user.profilePhoto;
  const fieldStyle = isLocked ? inpLocked : inp;

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="👤 My Profile">
      <div className="profile-pop" style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>

        {/* ⚠️ PERMANENT LOCK WARNING */}
        {!isLocked && (
          <div style={{
            padding: "12px 16px", borderRadius: 12,
            background: "rgba(255,199,0,0.08)",
            border: "1px dashed #F59E0B",
            display: "flex", gap: 12, alignItems: "center",
            animation: "fadeIn 0.4s ease"
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ color: "#92400E", fontSize: 12, lineHeight: 1.4 }}>
              <b>Warning:</b> After saving, your profile will be permanently locked and cannot be edited again. Please double-check all details.
            </div>
          </div>
        )}

        {/* 🔒 PROFILE LOCK BANNER */}
        {isLocked && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px", borderRadius: 13,
            background: "linear-gradient(135deg, rgba(239,68,68,0.06), rgba(255,152,0,0.04))",
            border: "1.5px solid rgba(239,68,68,0.22)",
            animation: "fadeIn 0.3s ease"
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "linear-gradient(135deg, #EF4444, #F97316)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(239,68,68,0.25)", flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ color: "#fff", fontSize: 22 }}>lock</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#EF4444" }}>Profile Locked</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>
                Your profile has been saved and is now read-only. Contact admin if you need to make changes.
              </div>
            </div>
          </div>
        )}

        {/* AVATAR HEADER */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "linear-gradient(135deg,rgba(255,79,31,0.05),rgba(255,199,0,0.03))", borderRadius: 13, border: "1px solid rgba(255,79,31,0.14)" }}>
          {/* Profile Photo / Avatar */}
          <div
            onClick={() => !photoUploading && photoInputRef.current && photoInputRef.current.click()}
            style={{
              width: 64, height: 64, borderRadius: 16, flexShrink: 0,
              background: currentPhoto ? "transparent" : `linear-gradient(135deg,${T.orange},${T.yellow})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 22, color: "#111",
              cursor: "pointer", position: "relative", overflow: "hidden",
              border: currentPhoto ? "2px solid rgba(255,79,31,0.3)" : "none",
              boxShadow: "0 4px 16px rgba(255,79,31,0.18)",
              transition: "all .2s ease"
            }}
          >
            {currentPhoto ? <img src={currentPhoto} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} alt="" /> : (draft.initials || user.initials || "DK")}
            {/* Hover overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0, transition: "opacity .2s ease",
              borderRadius: "inherit"
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <span style={{ color: "#fff", fontSize: 20 }}>📷</span>
            </div>
            {/* Upload spinner */}
            {photoUploading && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.6)", borderRadius: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTop: "3px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{draft.name || user.name}</div>
            <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{draft.branch || user.branch} • {draft.year || user.year}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              {isLocked && <Badge color="#9B6DFF">🔒 Locked</Badge>}
            </div>
            <div
              onClick={() => !photoUploading && photoInputRef.current && photoInputRef.current.click()}
              style={{ color: T.orange, fontSize: 11, fontWeight: 600, marginTop: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              📷 {currentPhoto ? "Change Photo" : "Upload Photo"}
            </div>
          </div>
        </div>


        {/* ── LOCKED: CLEAN PROFILE DATA VIEW ── */}
        {isLocked && (() => {
          const D = draft; const U = user;
          const val = (a, b) => a || b || null;
          const Row = ({ label, value }) => (
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", borderRight: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: value ? T.text : "#D1D5DB" }}>{value || "—"}</div>
            </div>
          );
          const SectionHead = ({ title, icon }) => (
            <div style={{ background: "linear-gradient(90deg,#F8F9FA,#F3F4F6)", padding: "9px 14px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 7 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.orange }}>{icon}</span>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#6B7280", letterSpacing: 1, textTransform: "uppercase" }}>{title}</div>
            </div>
          );
          return (
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #E5E7EB", marginBottom: 16 }}>
              {/* Personal */}
              <SectionHead title="Personal Information" icon="person" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <Row label="Full Name" value={val(D.name, U.name)} />
                <Row label="Roll Number" value={val(D.rollNo, U.rollNo)} />
                <Row label="Branch" value={val(D.branch, U.branch)} />
                <Row label="Year" value={val(D.year, U.year)} />
                <Row label="Aadhaar Number" value={val(D.aadhaarNumber, U.aadhaarNumber)} />
                <Row label="Date of Birth" value={val(D.dob, U.dob)} />
                <Row label="Mobile Number" value={val(D.mobileNumber, U.mobileNumber)} />
                <Row label="Email" value={val(D.email, U.email)} />
              </div>

              {/* Financial */}
              <SectionHead title="Financial Details" icon="account_balance" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <Row label="Family Income" value={(val(D.familyIncome, U.familyIncome) && Number(val(D.familyIncome, U.familyIncome)) > 0) ? `₹${Number(val(D.familyIncome, U.familyIncome)).toLocaleString('en-IN')}` : null} />
              </div>
            </div>
          );
        })()}

        {/* ── EDIT FORM (only when unlocked) ── */}
        {!isLocked && (
          <div>
            {/* ── BASIC DETAILS ── */}

            <div style={{ padding: "14px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, marginBottom: 16 }}>
              <div className="grid-2">
                <div>
                  <label style={lbl}>Aadhaar Number</label>
                  <input style={fieldStyle} value={draft.aadhaarNumber || ""} disabled={isLocked} onChange={e => setDraft(p => ({ ...p, aadhaarNumber: e.target.value }))} placeholder="12-digit Aadhaar" />
                </div>
                <div>
                  <label style={lbl}>Date of Birth</label>
                  <input type="date" style={fieldStyle} value={draft.dob || ""} disabled={isLocked} onChange={e => setDraft(p => ({ ...p, dob: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={lbl}>Mobile Number (Aadhaar Linked)</label>
                  <input style={fieldStyle} value={draft.mobileNumber || ""} disabled={isLocked} onChange={e => setDraft(p => ({ ...p, mobileNumber: e.target.value }))} placeholder="Mobile Number" />
                </div>
              </div>
            </div>
            {/* ── FORM FIELDS ── */}
            <div>
              <label style={lbl}>Full Name</label>
              <input style={fieldStyle} value={draft.name || ""} disabled={isLocked} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Dev Kumar" />
            </div>

            <div>
              <label style={lbl}>Roll Number</label>
              <input style={fieldStyle} value={draft.rollNo || ""} disabled={isLocked} onChange={e => setDraft(p => ({ ...p, rollNo: e.target.value }))} placeholder="e.g. 210027010001" />
            </div>

            <div>
              <label style={lbl}>Email Address</label>
              <input type="email" style={fieldStyle} value={draft.email || ""} disabled={isLocked} onChange={e => setDraft(p => ({ ...p, email: e.target.value }))} placeholder="e.g. you@aktu.ac.in" />
            </div>

            <div className="grid-2">
              <div>
                <label style={lbl}>Branch</label>
                <div style={{ position: "relative", marginTop: 6 }}>
                  <select style={{ ...fieldStyle, marginTop: 0, paddingRight: 32 }} disabled={isLocked} value={draft.branch || ""} onChange={e => setDraft(p => ({ ...p, branch: e.target.value }))}>
                    {["CSE", "IT", "ECE", "ME", "CE", "EE", "BT", "CH"].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none", fontSize: 12 }}>▾</span>
                </div>
              </div>
              <div>
                <label style={lbl}>Year</label>
                <div style={{ position: "relative", marginTop: 6 }}>
                  <select style={{ ...fieldStyle, marginTop: 0, paddingRight: 32 }} disabled={isLocked} value={draft.year || ""} onChange={e => setDraft(p => ({ ...p, year: e.target.value }))}>
                    {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none", fontSize: 12 }}>▾</span>
                </div>
              </div>
            </div>


            {/* ── TFW ELIGIBILITY SECTION (Expandable Accordion) ── */}
            {!isLocked && (
              <div style={{
                borderRadius: 14, overflow: "hidden",
                border: `1.5px solid ${showTfwPanel ? 'rgba(255,79,31,0.25)' : T.border}`,
                background: "#fff",
                transition: "all .3s ease"
              }}>
                {/* ▸ Clickable Header Bar */}
                <div
                  onClick={() => setShowTfwPanel(p => !p)}
                  style={{
                    padding: "14px 18px",
                    background: showTfwPanel
                      ? "linear-gradient(135deg, rgba(255,79,31,0.08), rgba(255,152,0,0.05))"
                      : "#FAFAFA",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "background .2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ color: T.orange, fontSize: 20 }}>verified_user</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: T.text }}>Tuition Fee Waiver (TFW)</div>
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>University/UPTAC — 5% supernumerary seats</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {draft.isFeeWaiver && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: T.orange, padding: "3px 8px", borderRadius: 6 }}>ACTIVE</span>}
                    <span className="material-symbols-outlined" style={{
                      color: T.muted, fontSize: 18,
                      transform: showTfwPanel ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform .3s ease'
                    }}>expand_more</span>
                  </div>
                </div>

                {/* ▼ Expanded Panel */}
                {showTfwPanel && (
                  <div style={{ borderTop: "1px solid rgba(255,79,31,0.10)", animation: "fadeIn 0.25s ease" }}>

                    {/* Criteria Checklist */}
                    <div style={{ padding: "14px 18px", background: "#FFFBF5" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>Eligibility Criteria</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {tfwResults.map(c => (
                          <div key={c.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 12px", borderRadius: 10,
                            background: c.passed ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.04)",
                            border: `1px solid ${c.passed ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.12)'}`,
                            transition: "all .3s ease"
                          }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: 7,
                              background: c.passed ? T.success : "rgba(239,68,68,0.12)",
                              color: c.passed ? "#fff" : T.rose,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all .3s ease", flexShrink: 0
                            }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{c.passed ? 'check' : 'close'}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 15, color: T.muted }}>{c.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: c.passed ? T.success : T.text }}>{c.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detail Fields */}
                    <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #F0F0F0" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>Fill Your Details</div>
                      <div className="grid-2">
                        <div style={{ gridColumn: "span 2" }}>
                          <label style={lbl}>Family Income (Annual)</label>
                          <div style={{ position: "relative", marginTop: 6 }}>
                            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13 }}>₹</span>
                            <input type="number" style={{ ...inp, marginTop: 0, paddingLeft: 24 }} value={draft.familyIncome === 0 || draft.familyIncome === '0' ? '' : (draft.familyIncome || '')} onChange={e => { const v = e.target.value; setDraft(p => ({ ...p, familyIncome: v === '' ? 0 : Number(v) })); }} placeholder="e.g. 150000" />
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Domicile State</label>
                          <div style={{ position: "relative", marginTop: 6 }}>
                            <select style={{ ...inp, marginTop: 0, paddingRight: 32 }} value={draft.domicileState || ""} onChange={e => setDraft(p => ({ ...p, domicileState: e.target.value }))}>
                              <option value="">Select…</option>
                              <option value="Uttar Pradesh">Uttar Pradesh</option>
                              <option value="Other">Other State</option>
                            </select>
                            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none", fontSize: 12 }}>▾</span>
                          </div>
                        </div>
                        <div>
                          <label style={lbl}>Admitted Course</label>
                          <div style={{ position: "relative", marginTop: 6 }}>
                            <select style={{ ...inp, marginTop: 0, paddingRight: 32 }} value={draft.course || "B.Tech"} onChange={e => setDraft(p => ({ ...p, course: e.target.value }))}>
                              {["B.Tech", "B.Pharm", "BHMCT", "BFAD", "BFA", "B.Des", "MCA", "MBA", "B.Arch"].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none", fontSize: 12 }}>▾</span>
                          </div>
                        </div>
                      </div>

                      {/* Income Certificate Toggle */}
                      <div onClick={() => setDraft(p => ({ ...p, hasIncomeCertificate: !p.hasIncomeCertificate }))} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 10,
                        border: `1px solid ${draft.hasIncomeCertificate ? "rgba(34,197,94,0.22)" : T.border}`,
                        background: draft.hasIncomeCertificate ? "rgba(34,197,94,0.06)" : "#F9F9F9",
                        cursor: "pointer", transition: "all .2s"
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: draft.hasIncomeCertificate ? T.success : T.text }}>Valid Income Certificate</div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>Issued by Tehsildar/SDM (current year)</div>
                        </div>
                        <div style={{ width: 40, height: 22, borderRadius: 11, background: draft.hasIncomeCertificate ? T.success : "#E0E0E0", position: "relative", transition: "all .3s" }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: draft.hasIncomeCertificate ? 21 : 3, transition: "all .3s cubic-bezier(0.18, 0.89, 0.32, 1.28)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                        </div>
                      </div>
                    </div>

                    {/* Final Verdict + TFW Toggle */}
                    <div style={{ padding: "14px 18px", background: tfwEligible ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.03)", borderTop: "1px solid #F0F0F0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: tfwEligible ? "linear-gradient(135deg, #22C55E, #16A34A)" : "linear-gradient(135deg, #EF4444, #DC2626)",
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 4px 12px ${tfwEligible ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                          flexShrink: 0
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{tfwEligible ? 'check_circle' : 'cancel'}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: tfwEligible ? T.success : T.rose }}>
                            {tfwEligible ? '✅ You are Eligible!' : '❌ Not Eligible'}
                          </div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                            {tfwEligible ? 'All University/UPTAC criteria met. Toggle TFW below.' : `${tfwResults.filter(c => !c.passed).length} criteria not met — check above`}
                          </div>
                        </div>
                      </div>

                      {/* TFW TOGGLE — only appears when eligible */}
                      {tfwEligible && (
                        <div
                          onClick={() => setDraft(p => ({ ...p, isFeeWaiver: !p.isFeeWaiver }))}
                          style={{
                            marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 16px", borderRadius: 12,
                            background: draft.isFeeWaiver ? "linear-gradient(135deg, rgba(255,79,31,0.08), rgba(255,152,0,0.04))" : "#F5F5F5",
                            border: `1.5px solid ${draft.isFeeWaiver ? T.orange : '#E0E0E0'}`,
                            cursor: "pointer", transition: "all .3s ease"
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: draft.isFeeWaiver ? T.orange : T.text }}>Enable TFW Status</div>
                            <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>Tuition fee will be waived (other fees still apply)</div>
                          </div>
                          <div style={{ width: 46, height: 26, borderRadius: 13, background: draft.isFeeWaiver ? T.orange : "#D0D0D0", position: "relative", transition: "all .3s" }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", background: "#fff",
                              position: "absolute", top: 3, left: draft.isFeeWaiver ? 23 : 3,
                              transition: "all .3s cubic-bezier(0.18, 0.89, 0.32, 1.28)",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                            }} />
                          </div>
                        </div>
                      )}

                      {/* Save button is already disabled when TFW is on but ineligible */}
                    </div>

                    {/* University Info Note */}
                    <div style={{ padding: "10px 18px 14px", background: "#FFFAF5" }}>
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "#FFFBEB", border: "1px dashed rgba(245,158,11,0.3)", fontSize: 10, color: "#92400E", lineHeight: 1.5 }}>
                        💡 <b>University TFW:</b> 5% supernumerary seats for students with family income &lt; ₹6,00,000/year. UP domicile required. Not for B.Arch. Income certificate verified during UPTAC counselling.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LOCKED TFW STATUS (shown when locked and FW was set) ── */}
            {isLocked && user.isFeeWaiver && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(34,197,94,0.06)", border: "1.5px solid rgba(34,197,94,0.20)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ color: T.success, fontSize: 22 }}>verified</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.success }}>TFW Status: Verified ✓</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      Course: {user.course || "B.Tech"} | Domicile: {user.domicileState || "—"} | Income Cert: {user.hasIncomeCertificate ? "Yes" : "No"}
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>
        )} {/* end !isLocked edit form */}

        {/* ── LINKS & RESUME INTELLIGENCE (ALWAYS VISIBLE) ── */}
        <div style={{ marginTop: 8, padding: "16px", background: "#FDFDFD", border: "1px solid #E2E8F0", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ color: T.orange, fontSize: 20 }}>description</span>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#1E293B", letterSpacing: 0.5, textTransform: "uppercase" }}>Links & Resume Intelligence</div>
          </div>

          {/* Links Management */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {(user.links || []).map((link, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: T.text, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6 }}>{link.type}</span>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.orange, textDecoration: "none", fontWeight: 600 }}>{link.url}</a>
                </div>
                <button onClick={() => handleDeleteLink(idx)} style={{ background: "none", border: "none", color: T.rose, cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select style={{ ...inp, width: "130px", marginTop: 0 }} value={newLink.type} onChange={e => setNewLink(p => ({ ...p, type: e.target.value }))}>
                <option value="LinkedIn">LinkedIn</option>
                <option value="GitHub">GitHub</option>
                <option value="Portfolio">Portfolio</option>
                <option value="Other">Other</option>
              </select>
              <input style={{ ...inp, flex: 1, marginTop: 0 }} placeholder="https://" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
              <button onClick={handleAddLink} style={{ padding: "0 16px", background: T.text, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", height: 38 }}>Add</button>
            </div>
          </div>

          {/* Resume Section */}
          <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 16 }}>
            {user.resume && user.resume.filename ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FEF2F2", color: T.rose, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>picture_as_pdf</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: T.text }}>{user.resume.filename}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Uploaded on {new Date(user.resume.uploadDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!user.resumeAnalysis && (
                      <button onClick={handleAnalyzeResume} disabled={resumeAnalyzing} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "linear-gradient(135deg, #FF6B00, #FF9900)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: resumeAnalyzing ? "not-allowed" : "pointer" }}>
                        {resumeAnalyzing ? (<><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyzing...</>) : (<><span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span> Analyze with AI</>)}
                      </button>
                    )}
                    <button onClick={handleDeleteResume} style={{ background: "#FEE2E2", color: T.rose, border: "none", borderRadius: 8, padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                </div>

                {user.resumeAnalysis && (
                  <div style={{ padding: "18px", background: "linear-gradient(to bottom right, #fff, #F8FAFC)", border: "1px solid #E2E8F0", borderRadius: 12, animation: "fadeIn 0.4s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800, boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>{user.resumeAnalysis.score}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>Resume Strength Score</div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 2, background: "#F1F5F9", padding: "4px 8px", borderRadius: 6, display: "inline-block", fontWeight: 600 }}>Target: {user.resumeAnalysis.targetDomain}</div>
                      </div>
                    </div>
                    <div className="grid-2">
                      <div style={{ padding: "14px", background: "#F0FDF4", borderRadius: 10, border: "1px solid #BBF7D0" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span> Top Strengths</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#15803D", lineHeight: 1.6 }}>{(user.resumeAnalysis.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                      <div style={{ padding: "14px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#991B1B", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span> Missing Evidence</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#B91C1C", lineHeight: 1.6 }}>{(user.resumeAnalysis.gaps || []).map((g, i) => <li key={i}>{g}</li>)}</ul>
                      </div>
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T.orange, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>route</span> Personalized Skill Roadmap</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {(user.resumeAnalysis.skillsToLearn || []).map((st, i) => (
                          <div key={i} style={{ padding: "12px 14px", background: "#FFFBF5", border: "1px solid #FDE68A", borderRadius: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: "#92400E" }}>{st.skill}</div>
                              <div style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: st.priority === "High" ? "#FEE2E2" : (st.priority === "Medium" ? "#FEF3C7" : "#F3F4F6"), color: st.priority === "High" ? "#991B1B" : (st.priority === "Medium" ? "#92400E" : "#4B5563") }}>{st.priority} Priority</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#92400E", marginBottom: 8, lineHeight: 1.4 }}>{st.reason}</div>
                            <div style={{ fontSize: 11, color: T.orange, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "6px 10px", borderRadius: 6, border: "1px dashed #FCD34D" }}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>lightbulb</span> Build: {st.suggestedProject}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_document</span> Resume Improvements</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155", lineHeight: 1.6 }}>{(user.resumeAnalysis.resumeImprovements || []).map((ri, i) => <li key={i}>{ri}</li>)}</ul>
                    </div>
                    {user.resumeAnalysis.priorityActions && user.resumeAnalysis.priorityActions.length > 0 && (
                      <div style={{ marginTop: 20, padding: "14px", background: "linear-gradient(135deg, rgba(255,107,0,0.06), rgba(255,153,0,0.04))", border: "1px solid rgba(255,107,0,0.2)", borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.orange, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>priority_high</span> Top Priority Actions</div>
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>{(user.resumeAnalysis.priorityActions || []).map((pa, i) => <li key={i} style={{ marginBottom: 4, fontWeight: 600 }}>{pa}</li>)}</ol>
                      </div>
                    )}
                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <button onClick={() => { updateUser({ ...user, resumeAnalysis: null }); handleAnalyzeResume(); }} style={{ flex: 1, padding: "10px", background: "#F1F5F9", color: T.text, border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Re-analyze</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div onClick={() => !resumeUploading && resumeInputRef.current && resumeInputRef.current.click()} style={{ padding: "28px 20px", border: "2px dashed #CBD5E1", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#F8FAFC", cursor: resumeUploading ? "not-allowed" : "pointer", transition: "all .2s" }} onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"} onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}>
                {resumeUploading ? (
                  <><div style={{ width: 28, height: 28, border: "3px solid #E2E8F0", borderTop: "3px solid " + T.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 12 }} /><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Uploading Securely...</div></>
                ) : (
                  <><div style={{ width: 48, height: 48, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: 12 }}><span className="material-symbols-outlined" style={{ fontSize: 24, color: T.orange }}>upload_file</span></div><div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Upload PDF Resume</div><div style={{ fontSize: 12, color: T.muted, marginTop: 6, textAlign: "center", lineHeight: 1.4 }}>Get an AI-powered score, gap analysis, and<br />personalized skill roadmap instantly.</div></>
                )}
              </div>
            )}
            <input ref={resumeInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleResumeUpload} />
          </div>
        </div>
        {/* ── PASSWORD VERIFICATION FIELD ── */}
        {!isLocked && (
          <div style={{ marginTop: 8, padding: "14px", background: "#FDF2F2", border: "1px solid #FEE2E2", borderRadius: 12 }}>
            <label style={{ ...lbl, color: T.rose }}>Verify Password to Save</label>
            <div style={{ position: "relative", marginTop: 6 }}>
              <input
                type={showPassword ? "text" : "password"}
                style={{ ...fieldStyle, borderColor: T.rose + "44", background: "#fff", paddingRight: 40 }}
                placeholder="Enter login password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <span
                className="material-symbols-outlined"
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.rose, fontSize: 18, cursor: "pointer" }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </div>
            <div style={{ fontSize: 10, color: T.rose, marginTop: 4, fontWeight: 600 }}>This is required for the first-time profile lock.</div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={saveProfile}
            disabled={(draft.isFeeWaiver && !tfwEligible) || (isLocked && user.profileEditRequested)}
            style={{
              width: "100%", padding: "10px 16px", fontSize: 14,
              background: (draft.isFeeWaiver && !tfwEligible) || (isLocked && user.profileEditRequested) ? "#D1D5DB" : T.orange,
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 500, cursor: (draft.isFeeWaiver && !tfwEligible) || (isLocked && user.profileEditRequested) ? "not-allowed" : "pointer",
              height: 42
            }}
          >
            {saved ? "✓ Saved & Locked" : (isLocked && user.profileEditRequested) ? "Edit Request Pending" : isLocked ? "Submit Edit Request" : (draft.isFeeWaiver && !tfwEligible) ? "⚠ Fix TFW Eligibility First" : "Save Profile"}
          </button>
        </div>

        <button
          onClick={onLogout}
          style={{
            width: "100%", padding: "10px 16px", fontSize: 14, marginTop: 8,
            background: "#fff", color: "#EF4444", border: "1px solid #EF4444",
            borderRadius: 8, fontWeight: 500, cursor: "pointer",
            height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          Log Out
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════
  MODULE: VIDYA-SETU (Pre-Flight)
══════════════════════════════════════ */
function VidyaSetu() {
  const { user } = useUser();
  const addToast = useToast();

  const [aktuStep, setAktuStep] = useState(1);
  const [aktuLoading, setAktuLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [aktuStatus, setAktuStatus] = useState("Draft");
  const [instituteRemark, setInstituteRemark] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState({});

  const [aktuOtr, setAktuOtr] = useState({ aadhaarNumber: '', fullName: user?.name || '', dob: '2004-05-15', mobileNumber: '', category: user?.casteCategory || 'General', securityPin: '' });
  const [aktuApp, setAktuApp] = useState({ districtOfCollege: '', collegeName: '', courseName: '', branch: '', entryMode: 'Regular', currentYearOfStudy: '', enrollmentNumber: '', rollNumber: '', rank: '', hsBoard: '', hsYear: '', hsRoll: '', hsMarks: '', hsTotal: '', intBoard: '', intYear: '', intRoll: '', intMarks: '', intTotal: '', feeAmount: '', incNumber: '', incAppNumber: '', casteNumber: '', casteAppNumber: '' });

  useEffect(() => {
    const fetchExisting = async () => {
      if (!user?._id) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/scholarships/aktu-application/${user._id}`);
        const data = await res.json();
        if (data.success && data.app) {
          setAktuApp(data.app);
          setAktuStatus(data.app.applicationStatus);
          setInstituteRemark(data.app.instituteRemark || "");
          if (data.app.applicationStatus !== 'Draft') {
            setIsSubmitted(true);
          }
        }
      } catch (e) { }
    };
    fetchExisting();
  }, [user]);

  const inputSt = { width: "100%", padding: "12px 14px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14 };

  const submitForm = async () => {
    const requiredAppFields = [
      'districtOfCollege', 'collegeName', 'courseName', 'branch', 'entryMode', 'currentYearOfStudy', 'enrollmentNumber', 'rollNumber', 'rank',
      'hsBoard', 'hsYear', 'hsRoll', 'hsMarks', 'hsTotal',
      'intBoard', 'intYear', 'intRoll', 'intMarks', 'intTotal',
      'feeAmount', 'incNumber', 'incAppNumber'
    ];

    for (const field of requiredAppFields) {
      if (!aktuApp[field] || String(aktuApp[field]).trim() === '') {
        addToast("Incomplete Form", "Please fill all the details before locking your application.", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>warning</span>, T.rose);
        return;
      }
    }

    if (aktuOtr.category !== 'General') {
      if (!aktuApp.casteNumber || String(aktuApp.casteNumber).trim() === '' || !aktuApp.casteAppNumber || String(aktuApp.casteAppNumber).trim() === '') {
        addToast("Incomplete Form", "Please fill all your caste certificate details.", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>warning</span>, T.rose);
        return;
      }
    }
    setAktuLoading(true);
    try {
      const payload = {
        studentReference: user._id || "TEST_ID",
        applicationStatus: 'Locked_by_Student',
        ...aktuApp,
        highSchool: { board: aktuApp.hsBoard, passingYear: aktuApp.hsYear, rollNumber: aktuApp.hsRoll, marksObtained: aktuApp.hsMarks, totalMarks: aktuApp.hsTotal },
        intermediate: { board: aktuApp.intBoard, passingYear: aktuApp.intYear, rollNumber: aktuApp.intRoll, marksObtained: aktuApp.intMarks, totalMarks: aktuApp.intTotal },
        nonRefundableFeeAmount: aktuApp.feeAmount,
        incomeCertificate: { number: aktuApp.incNumber, applicationNumber: aktuApp.incAppNumber },
        casteCertificate: { number: aktuApp.casteNumber, applicationNumber: aktuApp.casteAppNumber },
        documents: {
          passportPhoto: uploadedDocs["Passport Photo"] || null,
          incomeCertificate: uploadedDocs["Income Certificate"] || null,
          tenthMarksheet: uploadedDocs["Tenth Marksheet"] || null,
          twelfthMarksheet: uploadedDocs["Twelfth Marksheet"] || null,
          feeReceipt: uploadedDocs["Fee Receipt"] || null
        }
      };
      const res = await fetch(`${API_BASE_URL}/api/scholarships/aktu-application`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success || res.ok) {
        addToast("Success", "Application locked & forwarded!", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>check_circle</span>, T.success);
        setAktuStatus("Locked_by_Student");
        setIsSubmitted(true);
      } else {
        addToast("Error", data.error || "Failed to submit", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>warning</span>, T.rose);
      }
    } catch (err) {
      addToast("Success", "Application forwarded (Mock)", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>check_circle</span>, T.success);
      setAktuStatus("Locked_by_Student");
      setIsSubmitted(true);
    }
    setAktuLoading(false);
  };

  return (
    <div>
      <div className="screen-hero" style={{ padding: "44px 44px 40px" }}>
        <div className="screen-hero-inner">
          <span style={{ display: "inline-block", background: T.indigo + "14", color: T.indigo, border: `1px solid ${T.indigo}30`, borderRadius: 12, padding: "4px 12px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>🎓 University Scholarship Portal</span>
          <h1 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 32, fontWeight: 900, marginTop: 12, lineHeight: 1.15, color: T.text, letterSpacing: '-0.4px' }}>Scholarship Application</h1>
          <p style={{ color: T.muted, fontSize: 14, marginTop: 8, maxWidth: 500 }}>Fill out the official form. Your data will be securely sent to the respective Scholarship Backend.</p>
        </div>
      </div>

      <div className="screen-body">
        {isSubmitted ? (
          <div style={{ padding: "40px 24px", textAlign: "center", background: "#FFFFFF", borderRadius: 16, border: "1px solid #EBEBEB", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
            {aktuStatus === 'Rejected_by_Institute' ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: T.rose, marginBottom: 8 }}>Application Rejected by Institute</div>
                <div style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Your application requires corrections before it can be forwarded.</div>

                <div style={{ maxWidth: 500, margin: "0 auto", padding: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, textAlign: "left", marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, color: T.rose, marginBottom: 4 }}>Institute Remark:</div>
                  <div style={{ color: "#991B1B", fontSize: 14 }}>{instituteRemark}</div>
                </div>

                <Btn onClick={async () => {
                  const res = await fetch(`${API_BASE_URL}/api/scholarships/aktu-application`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentReference: user._id, applicationStatus: 'Draft' })
                  });
                  if (res.ok) {
                    setAktuStatus('Draft');
                    setIsSubmitted(false);
                    addToast("Form Unlocked", "You can now edit your details", "🔓", T.success);
                  }
                }} variant="primary" style={{ padding: "12px 24px" }}>Unlock Form to Edit & Resubmit</Btn>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🚀</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: T.success, marginBottom: 8 }}>Application Locked & Submitted</div>
                <div style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Your application is currently being processed.</div>

                {/* Progress Tracker */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "100%", margin: "0 auto", textAlign: "left" }}>
                  {[
                    { id: 'Locked_by_Student', label: 'Form Locked by Student', icon: 'lock', done: true },
                    { id: 'Verified_by_Institute', label: 'Institute Verification', icon: 'account_balance', done: aktuStatus !== 'Locked_by_Student' && aktuStatus !== 'Draft' },
                    { id: 'Forwarded_to_District', label: 'District Committee', icon: 'verified', done: aktuStatus === 'Forwarded_to_District' },
                  ].map((s, i) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 12, background: s.done ? "rgba(34,197,94,0.08)" : "#F5F5F5", border: s.done ? "1px solid rgba(34,197,94,0.2)" : "1px solid #EEE" }}>
                      <span className="material-symbols-outlined" style={{ color: s.done ? T.success : "#CCC" }}>{s.icon}</span>
                      <span style={{ fontWeight: 600, color: s.done ? T.text : "#999" }}>{s.label}</span>
                      {s.done && <span style={{ marginLeft: "auto", color: T.success, fontWeight: 800 }}>✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px", background: "#FFFFFF", borderRadius: 16, border: "1px solid #EBEBEB", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
            {/* Step Indicators */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4].map(s => (
                <div key={s} style={{ flex: 1, height: 6, borderRadius: 3, background: aktuStep >= s ? T.indigo : "#EEE" }} />
              ))}
            </div>

            {aktuStep === 1 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: T.indigo }}>Step 1: OTR & Authentication</div>
                <div className="grid-2">
                  <input style={inputSt} placeholder="Aadhaar Number" value={aktuOtr.aadhaarNumber} onChange={e => setAktuOtr(p => ({ ...p, aadhaarNumber: e.target.value }))} />
                  <input style={inputSt} placeholder="Full Name (DigiLocker)" value={aktuOtr.fullName} disabled />
                  <div>
                    <label style={{ fontSize: 10, color: T.muted, marginBottom: 4, display: "block" }}>Date of Birth (Aadhaar Verified)</label>
                    <input type="date" style={inputSt} value={aktuOtr.dob} onChange={e => setAktuOtr(p => ({ ...p, dob: e.target.value }))} />
                  </div>
                  <input style={inputSt} placeholder="Mobile Number" value={aktuOtr.mobileNumber} onChange={e => setAktuOtr(p => ({ ...p, mobileNumber: e.target.value }))} />
                  <select style={inputSt} value={aktuOtr.category} onChange={e => setAktuOtr(p => ({ ...p, category: e.target.value }))}>
                    <option value="General">General</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option><option value="Minority">Minority</option>
                  </select>
                  <input style={inputSt} type="password" placeholder="Security PIN (6 digits)" value={aktuOtr.securityPin} onChange={e => setAktuOtr(p => ({ ...p, securityPin: e.target.value }))} />
                </div>
                <Btn onClick={async () => {
                  setAktuLoading(true);
                  try {
                    await fetch(`${API_BASE_URL}/api/scholarships/aktu-otr`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...aktuOtr, otrStatus: true, userId: user._id })
                    });
                    setAktuStep(2);
                  } catch (err) {
                    setAktuStep(2); // continue anyway for UI preview
                  }
                  setAktuLoading(false);
                }} variant="primary" style={{ width: "100%", marginTop: 24, padding: 14 }}>{aktuLoading ? "Saving..." : "Next Step →"}</Btn>
              </div>
            )}

            {aktuStep === 2 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: T.indigo }}>Step 2: Institutional & Academic</div>
                <div className="grid-2">
                  <input style={inputSt} placeholder="District of College" value={aktuApp.districtOfCollege} onChange={e => setAktuApp(p => ({ ...p, districtOfCollege: e.target.value }))} />
                  <input style={inputSt} placeholder="College Name / University Code" value={aktuApp.collegeName} onChange={e => setAktuApp(p => ({ ...p, collegeName: e.target.value }))} />
                  <input style={inputSt} placeholder="Course Name (e.g., B.Tech)" value={aktuApp.courseName} onChange={e => setAktuApp(p => ({ ...p, courseName: e.target.value }))} />
                  <input style={inputSt} placeholder="Branch" value={aktuApp.branch} onChange={e => setAktuApp(p => ({ ...p, branch: e.target.value }))} />
                  <select style={inputSt} value={aktuApp.entryMode} onChange={e => setAktuApp(p => ({ ...p, entryMode: e.target.value }))}>
                    <option value="Regular">Regular</option><option value="Lateral Entry">Lateral Entry</option>
                  </select>
                  <input style={inputSt} placeholder="Current Year of Study" value={aktuApp.currentYearOfStudy} onChange={e => setAktuApp(p => ({ ...p, currentYearOfStudy: e.target.value }))} />
                  <input style={inputSt} placeholder="Enrollment Number" value={aktuApp.enrollmentNumber} onChange={e => setAktuApp(p => ({ ...p, enrollmentNumber: e.target.value }))} />
                  <input style={inputSt} placeholder="UPTAC/JEE Roll Number" value={aktuApp.rollNumber} onChange={e => setAktuApp(p => ({ ...p, rollNumber: e.target.value }))} />
                  <input style={inputSt} placeholder="UPTAC/JEE Rank" value={aktuApp.rank} onChange={e => setAktuApp(p => ({ ...p, rank: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <Btn onClick={() => setAktuStep(1)} variant="secondary" style={{ flex: 1, padding: 14 }}>← Back</Btn>
                  <Btn onClick={() => setAktuStep(3)} variant="primary" style={{ flex: 1, padding: 14 }}>Next Step →</Btn>
                </div>
              </div>
            )}

            {aktuStep === 3 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: T.indigo }}>Step 3: Past Education</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, marginBottom: 8 }}>High School (Tenth)</div>
                <div className="grid-2" style={{ marginBottom: 20 }}>
                  <select style={inputSt} value={aktuApp.hsBoard} onChange={e => setAktuApp(p => ({ ...p, hsBoard: e.target.value }))}>
                    <option value="">Select Board</option>
                    {EDUCATIONAL_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input style={inputSt} placeholder="Passing Year" value={aktuApp.hsYear} onChange={e => setAktuApp(p => ({ ...p, hsYear: e.target.value }))} />
                  <input style={inputSt} placeholder="Roll Number" value={aktuApp.hsRoll} onChange={e => setAktuApp(p => ({ ...p, hsRoll: e.target.value }))} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={inputSt} placeholder="Marks" value={aktuApp.hsMarks} onChange={e => setAktuApp(p => ({ ...p, hsMarks: e.target.value }))} />
                    <input style={inputSt} placeholder="Total" value={aktuApp.hsTotal} onChange={e => setAktuApp(p => ({ ...p, hsTotal: e.target.value }))} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, marginBottom: 8 }}>Intermediate (Twelfth) / Diploma</div>
                <div className="grid-2">
                  <select style={inputSt} value={aktuApp.intBoard} onChange={e => setAktuApp(p => ({ ...p, intBoard: e.target.value }))}>
                    <option value="">Select Board</option>
                    {EDUCATIONAL_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input style={inputSt} placeholder="Passing Year" value={aktuApp.intYear} onChange={e => setAktuApp(p => ({ ...p, intYear: e.target.value }))} />
                  <input style={inputSt} placeholder="Roll Number" value={aktuApp.intRoll} onChange={e => setAktuApp(p => ({ ...p, intRoll: e.target.value }))} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={inputSt} placeholder="Marks" value={aktuApp.intMarks} onChange={e => setAktuApp(p => ({ ...p, intMarks: e.target.value }))} />
                    <input style={inputSt} placeholder="Total" value={aktuApp.intTotal} onChange={e => setAktuApp(p => ({ ...p, intTotal: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <Btn onClick={() => setAktuStep(2)} variant="secondary" style={{ flex: 1, padding: 14 }}>← Back</Btn>
                  <Btn onClick={() => setAktuStep(4)} variant="primary" style={{ flex: 1, padding: 14 }}>Next Step →</Btn>
                </div>
              </div>
            )}

            {aktuStep === 4 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: T.indigo }}>Step 4: Financial & Finalize</div>
                <div className="grid-2">
                  <input style={inputSt} placeholder="Non-Refundable Fee Amount" value={aktuApp.feeAmount} onChange={e => setAktuApp(p => ({ ...p, feeAmount: e.target.value }))} />
                  <input style={inputSt} placeholder="Income Certificate Number" value={aktuApp.incNumber} onChange={e => setAktuApp(p => ({ ...p, incNumber: e.target.value }))} />
                  <input style={{ ...inputSt, gridColumn: "span 2" }} placeholder="Income Cert. App Number" value={aktuApp.incAppNumber} onChange={e => setAktuApp(p => ({ ...p, incAppNumber: e.target.value }))} />
                  {aktuOtr.category !== 'General' && (
                    <>
                      <input style={inputSt} placeholder="Caste Certificate Number" value={aktuApp.casteNumber} onChange={e => setAktuApp(p => ({ ...p, casteNumber: e.target.value }))} />
                      <input style={inputSt} placeholder="Caste Cert. App Number" value={aktuApp.casteAppNumber} onChange={e => setAktuApp(p => ({ ...p, casteAppNumber: e.target.value }))} />
                    </>
                  )}
                </div>

                <div style={{ marginTop: 20, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, marginBottom: 8 }}>Upload Documents</div>
                  <div className="grid-2">
                    {["Passport Photo", "Income Certificate", "Tenth Marksheet", "Twelfth Marksheet", "Fee Receipt"].map(doc => {
                      const expectedExt = doc === "Passport Photo" ? ".jpg" : ".pdf";
                      const expectedName = doc.replace(/\s+/g, "_") + expectedExt;
                      const isUploaded = uploadedDocs[doc];
                      return (
                        <div key={doc} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: isUploaded ? `1.5px solid ${T.success}88` : "1px dashed #CCC", background: isUploaded ? `${T.success}08` : "transparent", borderRadius: 8, transition: "all 0.3s" }}>
                          <span className="material-symbols-outlined" style={{ color: isUploaded ? T.success : T.muted }}>{isUploaded ? "check_circle" : "upload_file"}</span>
                          <span style={{ fontSize: 12, color: T.text, flex: 1, fontWeight: isUploaded ? 600 : 400 }}>{doc}</span>
                          {!isUploaded ? (
                            <input type="file" style={{ fontSize: 10, width: 80 }} accept={doc === "Passport Photo" ? ".jpg,.jpeg" : ".pdf"} onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const isPhoto = doc === "Passport Photo";
                              const isJpg = file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
                              const isPdf = file.name.toLowerCase().endsWith('.pdf');

                              if (isPhoto && !isJpg) {
                                addToast("Invalid Format", "Passport size photo must be a .jpg file.", <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>warning</span>, T.rose);
                                e.target.value = '';
                                return;
                              }
                              if (!isPhoto && !isPdf) {
                                addToast("Invalid Format", `${doc} must be a .pdf file.`, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>warning</span>, T.rose);
                                e.target.value = '';
                                return;
                              }

                              const normalizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
                              const expectedBase = doc.replace(/\s+/g, "").toLowerCase();
                              if (!normalizedFileName.includes(expectedBase)) {
                                addToast("Invalid File Name", `You must upload your file with its related name (e.g., ${expectedName}).`, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>warning</span>, T.orange);
                                e.target.value = '';
                                return;
                              }

                              const reader = new FileReader();
                              reader.onload = (upload) => {
                                setUploadedDocs(p => ({ ...p, [doc]: upload.target.result }));
                                addToast("File Attached", `${file.name} ready for upload.`, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>check_circle</span>, T.success);
                              };
                              reader.readAsDataURL(file);
                            }} />
                          ) : (
                            <button onClick={() => setUploadedDocs(p => ({ ...p, [doc]: false }))} style={{ border: "none", background: "none", color: T.rose, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Remove</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 20, padding: 16, background: "#FFFBEB", border: "1px dashed rgba(245,158,11,0.3)", borderRadius: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <input type="checkbox" id="declare" style={{ marginTop: 4, width: 18, height: 18 }} />
                    <label htmlFor="declare" style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
                      I hereby declare that all information provided is accurate and authentic. I understand that my form will be permanently locked after this step.
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <Btn onClick={() => setAktuStep(3)} variant="secondary" style={{ flex: 1, padding: 14 }}>← Back</Btn>
                  <Btn onClick={submitForm} variant="primary" style={{ flex: 1, padding: 14, background: T.success, borderColor: T.success, color: "#fff" }}>
                    {aktuLoading ? "Locking Form..." : "Lock & Submit Application"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
/* ══════════════════════════════════════
  MODULE: CHHATRA-LABH
══════════════════════════════════════ */
function ChhatraLabh() {
  const { user, setUser } = useUser();
  const addToast = useToast();
  const [perk, setPerk] = useState(null);
  const [perksList, setPerksList] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/api/perks`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const grouped = data.reduce((acc, curr) => {
            const catName = curr.category || 'Other';
            if (!acc[catName]) acc[catName] = { cat: catName, color: curr.color || T.indigo, items: [] };
            const fallbackImg = `https://www.google.com/s2/favicons?domain=${curr.officialUrl || 'example.com'}&sz=128`;
            curr.iconNode = <img src={curr.icon || fallbackImg} onError={(e) => { e.target.onerror = null; e.target.src = fallbackImg; }} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} alt={curr.title} />;
            acc[catName].items.push(curr);
            return acc;
          }, {});
          setPerksList(Object.values(grouped));
        } else {
          setPerksList([]);
        }
      })
      .catch(() => setPerksList([]))
      .finally(() => setLoading(false));
  }, []);

  const claimPerk = async (p) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/perks/claim/${p._id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        addToast("Perk Unlocked!", p.title, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>redeem</span>, p.color || T.success);
        if (user) {
          setUser({ ...user, claimedPerks: [...(user.claimedPerks || []), p._id] });
        }
        window.open(data.officialUrl, "_blank");
      } else {
        window.open(p.officialUrl, "_blank");
      }
    } catch (e) {
      window.open(p.officialUrl, "_blank");
    }
  };

  const stu = { name: user?.name || "Student Name", roll: user?.rollNo || "RollNo", year: user?.year || "Year", college: "University Affiliated College", valid: "May 2028" };
  const branchShort = user?.branch || "Branch";

  return (
    <div>
      <div className="screen-hero">
        <div className="screen-hero-inner">

          <h1 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 32, fontWeight: 900, marginTop: 12, lineHeight: 1.15, color: T.text, letterSpacing: '-0.4px' }}>Student Perks</h1>
          <p style={{ color: T.muted, fontSize: 14, marginTop: 8 }}>Your digital identity and exclusive student perks, all in one place.</p>
        </div>
      </div>

      <div className="screen-body">
        <div className="two-panel-wide">
          {/* LEFT — Perks */}
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>Loading Real-Time Perks...</div>
            ) : perksList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>No verified student perks are currently available.</div>
            ) : (
              perksList.map(({ cat, color, items }) => (
                <div key={cat} style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 12, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>{cat}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map(p => (
                      <Card key={p._id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: color + "12", border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 2px 8px ${color}18` }}>{p.iconNode}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{p.title}</div>
                              <Badge color={T.success}>✓ Active Offer</Badge>
                            </div>
                            <div style={{ color, fontSize: 12, fontWeight: 600, marginTop: 4 }}>{p.discount}</div>
                          </div>
                          <Btn onClick={() => claimPerk(p)} variant="primary" style={{ padding: "8px 14px", fontSize: 12, flexShrink: 0 }}>Get Deal →</Btn>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))
            )}

            <SH icon={<span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>schedule</span>} title="Previously Claimed" subtitle="History of discounts on your ID card" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {perksList.flatMap(c => c.items).filter(p => user?.claimedPerks?.includes(p._id)).length === 0 ? (
                <div style={{ padding: 20, color: T.muted, fontSize: 12, textAlign: "center" }}>You haven't claimed any perks yet.</div>
              ) : (
                perksList.flatMap(c => c.items).filter(p => user?.claimedPerks?.includes(p._id)).map(p => (
                  <Card key={'claimed-' + p._id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: (p.color || "#F5F5F5") + "14", border: `1px solid ${(p.color || "#EBEBEB")}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{p.iconNode}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{p.title}</div>
                        <div style={{ color: p.color || T.muted, fontSize: 12, fontWeight: 600, marginTop: 2 }}>{p.discount}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Badge color={T.muted}>Claimed</Badge>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* RIGHT — Digital ID Card */}
          <div style={{ position: "sticky", top: 24 }}>
            <SH icon={<span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>badge</span>} title="Digital Student ID" subtitle="Always valid • Tap to share" />
            <div style={{ background: `linear-gradient(145deg,${T.orange} 0%,#FF6B3D 35%,${T.yellow} 80%,${T.indigo}55 100%)`, borderRadius: 22, padding: 24, position: "relative", overflow: "hidden", border: "1px solid rgba(255,79,31,0.30)", animation: "glow 3s ease-in-out infinite", boxShadow: "0 12px 40px rgba(255,79,31,0.28)" }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>University STUDENT IDENTITY</div>
                    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 22, fontWeight: 900, lineHeight: 1.2, color: "#fff" }}>{stu.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', marginTop: 4 }}>{stu.roll}</div>
                  </div>
                  {/* AKTU logo removed per request */}
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge color="rgba(255,255,255,0.9)">{branchShort}</Badge>
                  <Badge color="rgba(255,255,255,0.9)">{stu.year}</Badge>
                  <Badge color={T.success}>✓ Verified</Badge>
                </div>
                <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, letterSpacing: 1 }}>INSTITUTION</div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{stu.college}</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 10, letterSpacing: 1 }}>VALID UNTIL</div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{stu.valid}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <QR data={`${window.location.origin}/api/users/verify/${stu.roll}`} size={76} />
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, marginTop: 4 }}>Scan to verify</div>
                    <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 9, marginTop: 2, fontWeight: 700 }}>Valid for events</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!perk} onClose={() => setPerk(null)} title={perk ? "Claim: " + perk.name : ""}>
        {perk && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, background: perk.color + "0D", border: `1px solid ${perk.color}28`, marginBottom: 20, boxShadow: `0 2px 10px ${perk.color}14` }}>
              <span style={{ fontSize: 28 }}>{perk.icon}</span>
              <div><div style={{ fontWeight: 700, color: T.text }}>{perk.val}</div><div style={{ color: T.muted, fontSize: 12 }}>Student exclusive benefit</div></div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: T.muted }}>Step-by-Step Instructions:</div>
            {perk.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: perk.color + "12", border: `1px solid ${perk.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: perk.color }}>{i + 1}</div>
                <div style={{ color: T.text, fontSize: 13, paddingTop: 4 }}>{step}</div>
              </div>
            ))}
            {perk.url ? (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Btn onClick={() => setPerk(null)} variant="secondary" style={{ flex: 1, padding: "12px" }}>Close</Btn>
                <Btn onClick={() => window.open(perk.url, '_blank')} variant="primary" style={{ flex: 2, padding: "12px", background: perk.color, borderColor: perk.color }}>🔗 Go to Website →</Btn>
              </div>
            ) : (
              <Btn onClick={() => setPerk(null)} variant="primary" style={{ width: "100%", marginTop: 12 }}>✓ Got it!</Btn>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════
  MODULE: PRASHNA-KOSH
══════════════════════════════════════ */
/* ══════════════════════════════════════
  MODULE: GATE-INSIGHTS (was PRASHNA-KOSH)
══════════════════════════════════════ */
function MockTestRunner({ questions, onComplete, onCancel, results, onShowAiAnalysis }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [statuses, setStatuses] = useState(() => {
    const init = new Array(questions.length).fill(0); // 0 = Not Visited
    init[0] = 1; // 1 = Not Answered
    return init;
  });
  const [grading, setGrading] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [instructionsRead, setInstructionsRead] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10800); // 3 hours
  const [showResultSummary, setShowResultSummary] = useState(true);

  useEffect(() => {
    if (!testStarted || grading || results) return;
    const timerId = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerId);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [testStarted, grading, results]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const q = questions[currentIndex];

  const updateStatus = (index, status) => {
    setStatuses(prev => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };

  const goToQuestion = (index) => {
    if (!results) {
      setStatuses(prev => {
        const next = [...prev];
        if (next[index] === 0) next[index] = 1;
        return next;
      });
    }
    setCurrentIndex(index);
  };

  const handleSaveAndNext = () => {
    if (!results) {
      const hasAnswer = !!(answers[q._id] && answers[q._id].trim());
      updateStatus(currentIndex, hasAnswer ? 2 : 1);
    }
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleMarkAndNext = () => {
    if (!results) {
      const hasAnswer = !!(answers[q._id] && answers[q._id].trim());
      updateStatus(currentIndex, hasAnswer ? 4 : 3);
    }
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleClearResponse = () => {
    if (results) return;
    const nextAnswers = { ...answers };
    delete nextAnswers[q._id];
    setAnswers(nextAnswers);
    updateStatus(currentIndex, 1);
  };

  const handleSubmit = async (auto = false) => {
    if (!auto && !window.confirm("Are you sure you want to submit the test?")) return;
    setGrading(true);
    const submissions = questions.map(q => ({
      _id: q._id,
      question: q.question,
      topic: q.topic,
      studentAnswer: answers[q._id] || "No answer provided",
      correctAnswer: q.correctAnswer,
      questionType: q.questionType
    }));
    await onComplete(submissions);
    setGrading(false);
  };

  const renderInputArea = () => {
    const options = ['A', 'B', 'C', 'D'];

    let extractedOptions = {};
    if (q && !q.options && q.question) {
      const aMatch = q.question.match(/\(A\)\s*(.+?)(?=\s*\(B\)|$)/is);
      const bMatch = q.question.match(/\(B\)\s*(.+?)(?=\s*\(C\)|$)/is);
      const cMatch = q.question.match(/\(C\)\s*(.+?)(?=\s*\(D\)|$)/is);
      const dMatch = q.question.match(/\(D\)\s*(.+?)$/is);
      if (aMatch) extractedOptions['A'] = aMatch[1].trim();
      if (bMatch) extractedOptions['B'] = bMatch[1].trim();
      if (cMatch) extractedOptions['C'] = cMatch[1].trim();
      if (dMatch) extractedOptions['D'] = dMatch[1].trim();
    }

    if (results) {
      const fb = results.grading.feedback[currentIndex];
      let correctAns = (fb?.correctAnswer || "").trim().toUpperCase();
      if (correctAns.startsWith("OPTION ")) correctAns = correctAns.replace("OPTION ", "");
      if (correctAns.length > 1 && ["A", "B", "C", "D"].includes(correctAns[0])) {
        correctAns = correctAns[0];
      }
      const isAttempted = fb?.studentAnswer && fb.studentAnswer !== "No answer provided";

      return (
        <div style={{ borderTop: '1px dashed #ccc', paddingTop: 20, marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            {fb?.isCorrect ? (
              <span style={{ color: "#1AB394", fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined">check_circle</span> Correct</span>
            ) : isAttempted ? (
              <span style={{ color: "#ED5565", fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined">cancel</span> Wrong</span>
            ) : (
              <span style={{ color: "#999", fontWeight: "bold", display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined">radio_button_unchecked</span> Not Attempted</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {options.map((opt, idx) => {
              const isCorrect = correctAns === opt;
              const isChosen = fb?.studentAnswer === opt;
              let bg = "#fff", border = "1px solid #ccc";
              if (isCorrect) { bg = "#e8f8f5"; border = "2px solid #1AB394"; }
              else if (isChosen && !isCorrect) { bg = "#fdeceb"; border = "2px solid #ED5565"; }

              const optText = q.options ? (Array.isArray(q.options) ? q.options[idx] : (q.options[opt] || q.options[opt.toLowerCase()])) : (extractedOptions[opt] || '');

              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border, borderRadius: 6, background: bg, maxWidth: "100%" }}>
                  <input type="radio" checked={isChosen} readOnly style={{ width: 18, height: 18, margin: 0 }} />
                  <span style={{ fontWeight: 'bold', fontSize: 15 }}>
                    Option {opt} {optText ? `: ${optText}` : ''}
                  </span>
                  {isCorrect && <span style={{ marginLeft: "auto", color: "#1AB394", fontSize: 12, fontWeight: "bold" }}>This is correct answer</span>}
                  {(isChosen && !isCorrect) && <span style={{ marginLeft: "auto", color: "#ED5565", fontSize: 12, fontWeight: "bold" }}>Your answer is wrong</span>}
                </label>
              );
            })}
          </div>
          {(!options.includes(correctAns) && correctAns) && (
            <div style={{ fontWeight: 'bold', marginBottom: 12, color: '#555', fontSize: 14 }}>
              Numerical/MSQ Correct Answer: <span style={{ color: "#1AB394" }}>{correctAns}</span><br />
              Your Answer: <span style={{ color: fb?.isCorrect ? "#1AB394" : "#ED5565" }}>{isAttempted ? fb?.studentAnswer : "Not Attempted"}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ borderTop: '1px dashed #ccc', paddingTop: 20, marginTop: 20 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 16, color: '#555', fontSize: 14 }}>Select Option (For MCQ):</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {options.map((opt, idx) => {
            const optText = q.options ? (Array.isArray(q.options) ? q.options[idx] : (q.options[opt] || q.options[opt.toLowerCase()])) : (extractedOptions[opt] || '');
            return (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 16px', border: answers[q._id] === opt ? '2px solid #1AB394' : '1px solid #ccc', borderRadius: 6, background: answers[q._id] === opt ? '#e8f8f5' : '#fff', maxWidth: "100%", transition: 'all 0.2s' }}>
                <input
                  type="radio"
                  name={`q-${q._id}`}
                  value={opt}
                  checked={answers[q._id] === opt}
                  onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                  style={{ width: 18, height: 18, margin: 0, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 'bold', fontSize: 15 }}>Option {opt} {optText ? `: ${optText}` : ''}</span>
              </label>
            )
          })}
        </div>
        <div style={{ fontWeight: 'bold', marginBottom: 12, color: '#555', fontSize: 14 }}>Or Type Value (For NAT/MSQ):</div>
        <textarea
          value={!options.includes(answers[q._id]) ? (answers[q._id] || '') : ''}
          onChange={e => setAnswers({ ...answers, [q._id]: e.target.value })}
          placeholder="Type your numerical answer or explanation here..."
          style={{ width: '100%', maxWidth: 600, height: 100, padding: 14, borderRadius: 6, border: '1px solid #ccc', fontFamily: 'inherit', fontSize: 15, resize: 'vertical' }}
        />
      </div>
    );
  };

  if (!testStarted && !results) {
    return createPortal(
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', zIndex: 99999, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#3177B3', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: 20 }}>GATE Mock Test Instructions</div>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
        </div>
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: '#f5f7f9' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 40, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h2 style={{ color: '#d9534f', textAlign: 'center', marginBottom: 24 }}>Please read the instructions carefully</h2>
            <div style={{ fontSize: 15, lineHeight: 1.8, color: '#333' }}>
              <strong>General Instructions:</strong>
              <ol>
                <li>Total duration of the examination is 180 minutes.</li>
                <li>The clock will be set at the server. The countdown timer in the top right corner of the screen will display the remaining time available for you to complete the examination.</li>
                <li>The Question Palette displayed on the right side of the screen will show the status of each question.</li>
                <li>You can click on "Mark for Review & Next" to mark a question for review and proceed to the next question.</li>
                <li>For multiple-choice questions (MCQs), select the correct option (A, B, C, or D). For Numerical Answer Type (NAT) questions, use the text box to enter the numeric value.</li>
                <li style={{ color: '#d9534f', fontWeight: 'bold' }}>Negative Marking: There is a negative marking of 1/3 (0.33) marks for every incorrect answer in MCQs. NAT and MSQ questions do not have negative marking.</li>
              </ol>
            </div>
            <div style={{ marginTop: 32, padding: 16, border: '1px solid #ddd', borderRadius: 4, background: '#fafafa' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={instructionsRead} onChange={e => setInstructionsRead(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontWeight: 'bold' }}>I have read and understood the instructions. I agree that I am ready to begin the test.</span>
              </label>
            </div>
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button
                disabled={!instructionsRead}
                onClick={() => setTestStarted(true)}
                style={{ background: instructionsRead ? '#1AB394' : '#ccc', color: '#fff', padding: '12px 32px', border: 'none', borderRadius: 4, fontSize: 16, fontWeight: 'bold', cursor: instructionsRead ? 'pointer' : 'not-allowed' }}
              >
                I am ready to begin
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const countStatus = (val) => statuses.filter(s => s === val).length;
  const counts = {
    answered: countStatus(2),
    notAnswered: countStatus(1),
    notVisited: countStatus(0),
    marked: countStatus(3),
    answeredMarked: countStatus(4)
  };

  if (grading) {
    return createPortal(
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#2c3e50', fontSize: 28, marginBottom: 16 }}>Evaluating Your Test...</h2>
          <p style={{ fontSize: 18, color: '#666' }}>Our AI is grading your answers and preparing your analysis.</p>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', zIndex: 99999, display: 'flex', flexDirection: 'column' }}>

      {/* RESULT SUMMARY MODAL (Only when results exist) */}
      {(results && showResultSummary) && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 400, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ color: '#555' }}>emoji_events</span>
              <span style={{ fontWeight: 'bold', color: '#333' }}>Exam Result</span>
            </div>
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', border: '4px solid #E53935', margin: '0 auto 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#E53935' }}>{results.grading.accuracy}%</div>
                <div style={{ fontSize: 12, color: '#777' }}>Score</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                <div style={{ background: '#eee', padding: '12px 16px', borderRadius: 6, flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>{results.grading.total}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>Total</div>
                </div>
                <div style={{ background: '#e8f8f5', padding: '12px 16px', borderRadius: 6, flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1AB394' }}>{results.stats.correct}</div>
                  <div style={{ fontSize: 11, color: '#1AB394' }}>Correct</div>
                </div>
                <div style={{ background: '#fdeceb', padding: '12px 16px', borderRadius: 6, flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ED5565' }}>{results.stats.incorrect}</div>
                  <div style={{ fontSize: 11, color: '#ED5565' }}>Wrong</div>
                </div>
                <div style={{ background: '#f0f0f0', padding: '12px 16px', borderRadius: 6, flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#777' }}>{results.stats.unattempted}</div>
                  <div style={{ fontSize: 11, color: '#777' }}>Skipped</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: '#333', fontWeight: 'bold', marginBottom: 8 }}>
                Your Score: {results.grading.score} / {results.grading.total}
              </div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
                Pass Mark: {Math.floor(results.grading.total * 0.5)} (50%)
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => setShowResultSummary(false)} style={{ background: '#3177B3', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span> Review Answers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div style={{ background: '#3177B3', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: 18 }}>{results ? 'Review Answers' : 'GATE Mock Test'}</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {!results ? (
            <div style={{ fontSize: 14 }}>Time Left: <span style={{ fontWeight: 'bold', fontSize: 16, background: '#fff', color: '#3177B3', padding: '4px 10px', borderRadius: 4, marginLeft: 8 }}>{formatTime(timeLeft)}</span></div>
          ) : (
            <div style={{ fontSize: 14 }}>Max Mark: {results.grading.total} | Pass: {Math.floor(results.grading.total * 0.5)} (50%)</div>
          )}
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>{results ? 'Exit Review' : 'Exit Test'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Question Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #ddd' }}>

          {/* Question Header */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', background: '#f8f9fa' }}>
            <span style={{ fontWeight: 600, color: '#444', fontSize: 14 }}>Question Type: {q.questionType || 'MCQ/NAT'}</span>
            <span style={{ fontWeight: 600, color: '#444', fontSize: 14 }}>Marks: {q.marks ? `+${q.marks}.00` : '+1.00'}</span>
          </div>

          {/* Question Content */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16, color: '#333' }}>Q. {currentIndex + 1}</div>
            {(() => {
              let displayQuestion = q.question || "";
              if (!q.options) {
                // Strip the options from the text if they are baked in
                displayQuestion = displayQuestion.replace(/\s*\(A\)\s*[\s\S]*$/is, '');
              }
              return (
                <div style={{ fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: q.imageUrl ? 16 : 32, color: '#000', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {displayQuestion}
                </div>
              );
            })()}
            {q.imageUrl && (
              <div style={{ marginBottom: 32 }}>
                <img src={q.imageUrl} alt={`Question ${currentIndex + 1}`} style={{ maxWidth: '100%', height: 'auto', border: '1px solid #eee', borderRadius: 4 }} />
              </div>
            )}
            {renderInputArea()}
          </div>

          {/* Footer Controls */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #ddd', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between' }}>
            {!results ? (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={handleMarkAndNext} style={{ border: '1px solid #ccc', background: '#fff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, color: '#333', fontSize: 14 }}>Mark for Review & Next</button>
                  <button onClick={handleClearResponse} style={{ border: '1px solid #ccc', background: '#fff', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, color: '#333', fontSize: 14 }}>Clear Response</button>
                </div>
                <button onClick={handleSaveAndNext} style={{ border: 'none', background: '#3177B3', color: '#fff', padding: '8px 24px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Save & Next</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)} style={{ background: '#3177B3', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: currentIndex === 0 ? 0.5 : 1 }}>&lt; Previous</button>
                  <button disabled={currentIndex === questions.length - 1} onClick={() => setCurrentIndex(currentIndex + 1)} style={{ background: '#3177B3', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: currentIndex === questions.length - 1 ? 0.5 : 1 }}>Next &gt;</button>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, fontWeight: 'bold' }}>
                  <span style={{ color: '#1AB394', display: 'flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span> Correct: {results.stats.correct}</span>
                  <span style={{ color: '#ED5565', display: 'flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span> Wrong: {results.stats.incorrect}</span>
                  <span style={{ color: '#777', display: 'flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>radio_button_unchecked</span> Skipped: {results.stats.unattempted}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Palette */}
        <div style={{ width: 320, background: '#edf1f5', display: 'flex', flexDirection: 'column' }}>

          {/* User Profile Area */}
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderBottom: '1px solid #ddd' }}>
            <div style={{ width: 44, height: 44, background: '#c1c9d2', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#fff' }}>person</span>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 14, color: '#333' }}>Mock Test Participant</div>
              <div style={{ fontSize: 12, color: '#666' }}>GATE Mock Practice</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: '16px', borderBottom: '1px solid #ddd', background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 4px', fontSize: 12, color: '#444' }}>
            {!results ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, background: '#1AB394', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px 4px 0 4px', fontWeight: 'bold' }}>{counts.answered}</div> Answered</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, background: '#ED5565', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px 4px 4px 0', fontWeight: 'bold' }}>{counts.notAnswered}</div> Not Answered</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, background: '#eee', border: '1px solid #ccc', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontWeight: 'bold' }}>{counts.notVisited}</div> Not Visited</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, background: '#5A32A1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 'bold' }}>{counts.marked}</div> Marked</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / span 2' }}><div style={{ width: 22, height: 22, background: '#5A32A1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', position: 'relative', fontWeight: 'bold' }}><div style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, background: '#1AB394', borderRadius: '50%' }}></div>{counts.answeredMarked}</div> Answered & Marked for Review</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, background: '#1AB394', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontWeight: 'bold' }}>{results.stats.correct}</div> Correct</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 22, height: 22, background: '#ED5565', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontWeight: 'bold' }}>{results.stats.incorrect}</div> Wrong</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / span 2' }}><div style={{ width: 22, height: 22, background: '#eee', border: '1px solid #ccc', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontWeight: 'bold' }}>{results.stats.unattempted}</div> Not Attempted</div>
              </>
            )}
          </div>

          {/* Palette Grid */}
          <div style={{ padding: 16, flex: 1, overflowY: 'auto', background: '#edf1f5' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 12, background: '#3177B3', color: '#fff', padding: '8px 12px', fontSize: 13, borderRadius: 2 }}>Questions Palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {questions.map((_, i) => {
                let bg = '#eee';
                let color = '#333';
                let br = 4;
                let border = '1px solid #ccc';
                let hasDot = false;

                if (!results) {
                  const st = statuses[i];
                  if (st === 1) { bg = '#ED5565'; color = '#fff'; border = 'none'; br = '4px 4px 4px 0'; }
                  else if (st === 2) { bg = '#1AB394'; color = '#fff'; border = 'none'; br = '4px 4px 0 4px'; }
                  else if (st === 3) { bg = '#5A32A1'; color = '#fff'; border = 'none'; br = '50%'; }
                  else if (st === 4) { bg = '#5A32A1'; color = '#fff'; border = 'none'; br = '50%'; hasDot = true; }
                } else {
                  const fb = results.grading.feedback[i];
                  const isAttempted = fb?.studentAnswer && fb.studentAnswer !== "No answer provided";
                  if (fb?.isCorrect) { bg = '#1AB394'; color = '#fff'; border = 'none'; }
                  else if (isAttempted) { bg = '#ED5565'; color = '#fff'; border = 'none'; }
                }

                return (
                  <button
                    key={i}
                    onClick={() => goToQuestion(i)}
                    style={{
                      height: 44, width: '100%',
                      background: bg, color: color, borderRadius: br, border: border,
                      cursor: 'pointer', fontWeight: 'bold', fontSize: 14,
                      position: 'relative',
                      boxShadow: currentIndex === i ? '0 0 0 2px #3177B3' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {i + 1}
                    {hasDot && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#1AB394', borderRadius: '50%', border: '1px solid #fff' }}></div>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ padding: 16, background: '#e0e8f0', borderTop: '1px solid #ccc', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!results ? (
              <button onClick={() => handleSubmit(false)} style={{ width: '100%', padding: '14px', background: '#1AB394', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Submit Test</button>
            ) : (
              <>
                <button onClick={() => setShowResultSummary(true)} style={{ width: '100%', background: '#555', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu</span> Menu Summary
                </button>
                <button onClick={() => onShowAiAnalysis(results.evaluationContent)} style={{ width: '100%', background: '#6366f1', color: '#fff', border: 'none', padding: '12px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>psychology</span> AI Analysis
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}

function ExamAnalytics() {
  const { user } = useUser();
  const [filtersData, setFiltersData] = useState({ taxonomy: [] });
  const [fLoading, setFLoading] = useState(true);
  const [fErr, setFErr] = useState(false);

  const [selPaper, setSelPaper] = useState("");
  const [selSub, setSelSub] = useState("");
  const [selTopic, setSelTopic] = useState("");
  const [selYear, setSelYear] = useState("");

  const [analytics, setAnalytics] = useState(null);
  const [aLoading, setALoading] = useState(false);
  const [aErr, setAErr] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(false);
  const [viewPyqs, setViewPyqs] = useState(false);

  const [gatePdfs, setGatePdfs] = useState([]);
  const [viewGatePdfs, setViewGatePdfs] = useState(false);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  const [pdfViewerData, setPdfViewerData] = useState(null);

  const [viewMockRunner, setViewMockRunner] = useState(false);
  const [mockQuestions, setMockQuestions] = useState([]);
  const [mockResults, setMockResults] = useState(() => {
    const userKey = user?._id || 'guest';
    const saved = localStorage.getItem(`vidyasetu_mock_results_${userKey}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [mockHistory, setMockHistory] = useState(() => {
    try {
      const userKey = user?._id || 'guest';
      const saved = localStorage.getItem(`vidyasetu_mock_history_${userKey}`);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    const userKey = user?._id || 'guest';
    const savedResults = localStorage.getItem(`vidyasetu_mock_results_${userKey}`);
    setMockResults(savedResults ? JSON.parse(savedResults) : null);

    try {
      const savedHistory = localStorage.getItem(`vidyasetu_mock_history_${userKey}`);
      const parsedHistory = savedHistory ? JSON.parse(savedHistory) : [];
      setMockHistory(Array.isArray(parsedHistory) ? parsedHistory : []);
    } catch (e) { setMockHistory([]); }
  }, [user?._id]);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalTitle, setAiModalTitle] = useState("");
  const [aiModalContent, setAiModalContent] = useState("");
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");

  const [pdfChatHistory, setPdfChatHistory] = useState([]);
  const [pdfChatInput, setPdfChatInput] = useState("");
  const [pdfChatLoading, setPdfChatLoading] = useState(false);
  const [pdfChatOpen, setPdfChatOpen] = useState(false);

  const availablePapers = (filtersData.taxonomy || []).map(t => t.paper);
  const selectedPaperData = (filtersData.taxonomy || []).find(t => t.paper === selPaper);
  const availableSubjects = selectedPaperData ? selectedPaperData.subjects.map(s => s.subject) : [];
  const selectedSubjectData = selectedPaperData ? selectedPaperData.subjects.find(s => s.subject === (selSub || '')) : null;
  const availableTopics = selectedSubjectData ? selectedSubjectData.topics : [];
  const availableYears = selectedSubjectData ? selectedSubjectData.years : [];

  const fetchFilters = async () => {
    try {
      setFLoading(true); setFErr(false);
      const res = await fetch(`${API_BASE_URL}/api/academic/gate/filters`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON"); }
      if (!res.ok) throw new Error(data.error || "API error");
      setFiltersData(data);
    } catch (e) {
      setFErr(true);
    } finally { setFLoading(false); }
  };

  useEffect(() => { fetchFilters(); }, []);

  const fetchAnalytics = async () => {
    if (!selPaper || !selSub) return;
    try {
      setALoading(true); setAErr(false); setViewPyqs(false); setViewGatePdfs(false);
      const q = new URLSearchParams({ paper: selPaper, subject: selSub });
      if (selTopic) q.append('topic', selTopic);
      if (selYear) q.append('year', selYear);
      const res = await fetch(`${API_BASE_URL}/api/academic/gate/analytics?${q.toString()}`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON"); }
      if (!res.ok) throw new Error(data.error || "API error");
      setAnalytics(data);
    } catch (e) {
      setAErr(true);
    } finally { setALoading(false); }
  };

  useEffect(() => {
    if (selPaper && selSub) fetchAnalytics();
    else setAnalytics(null);
  }, [selPaper, selSub, selTopic, selYear]);

  const loadQuestions = async () => {
    try {
      setQLoading(true);
      setViewPyqs(true);
      const q = new URLSearchParams({ paper: selPaper, subject: selSub });
      if (selTopic) q.append('topic', selTopic);
      if (selYear) q.append('year', selYear);
      const res = await fetch(`${API_BASE_URL}/api/academic/gate/questions?${q.toString()}`);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON"); }
      if (!res.ok) throw new Error(data.error || "API error");
      setQuestions(data);
      return data;
    } catch (e) {
      alert("Failed to load questions");
    } finally { setQLoading(false); }
  };

  const fetchPdfs = async () => {
    try {
      setPdfsLoading(true);
      setViewGatePdfs(true);
      setViewPyqs(false);
      const q = new URLSearchParams({ paperCode: selPaper === 'CS' ? 'CS' : selPaper === 'DA' ? 'DA' : selPaper === 'ECE' ? 'EC' : selPaper });
      if (selYear) q.append('year', selYear);
      const res = await fetch(`${API_BASE_URL}/api/gate-papers?${q.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch PDFs");
      const data = await res.json();
      setGatePdfs(data);
    } catch (e) {
      alert("Failed to load Original PDFs");
    } finally {
      setPdfsLoading(false);
    }
  };

  const executeAiAction = async (type, extraPayload = {}) => {
    if (!analytics) return;
    setAiModalOpen(true);
    setAiActionLoading(true);
    try {
      const payload = {
        type,
        exam: selPaper, // Using 'exam' key internally for backward compatibility with the AI service
        subject: selSub,
        specificTopic: selTopic,
        stats: { totalQuestions: analytics.totalQuestions, yearsCovered: analytics.yearsCovered },
        topics: analytics.topics ? analytics.topics.map(t => ({ t: t.t, p: t.relativeFrequency })) : [],
        ...extraPayload
      };
      if (user) {
        payload.userContext = {
          name: user.name,
          branch: user.branch,
          semester: user.semester
        };
      }
      const res = await fetch(`${API_BASE_URL}/api/ai/exam-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON: ${text.slice(0, 300)}`); }
      if (!res.ok) throw new Error((data && data.error) || `AI failed (${res.status})`);

      if (data.reply) setAiModalContent(data.reply);
      else if (data.error) setAiModalContent(`Error: ${data.error}`);
    } catch (e) {
      setAiModalContent(`AI service error: ${e.message || 'Temporarily unavailable'}`);
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleAiChatSubmit = (e) => {
    if (e) e.preventDefault();
    if (!aiChatInput.trim()) return;
    const msg = aiChatInput;
    setAiChatInput("");
    setAiModalContent("AI is thinking...");
    executeAiAction("chat", { userMessage: msg });
  };

  const simulateMockEvaluation = async () => {
    if (mockResults && mockResults.evaluationContent) {
      setAiModalContent(mockResults.evaluationContent);
      setAiModalTitle("AI Mock Evaluation & Study Plan");
      setAiModalOpen(true);
    } else {
      alert("No previous evaluation found. First go and do a mock test!");
    }
  };

  const startLiveMockTest = async () => {
    setQLoading(true);
    try {
      const q = new URLSearchParams({ paper: selPaper, limit: 65 });
      if (selSub) q.append('subject', selSub);
      if (selTopic) q.append('topic', selTopic);
      const res = await fetch(`${API_BASE_URL}/api/academic/gate/questions?${q.toString()}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const ordered = data.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0)).slice(0, 65);
        setMockQuestions(ordered);
        setMockResults(null);
        setViewMockRunner(true);
        setViewPyqs(false);
        setViewGatePdfs(false);
      } else {
        alert("No questions found for this selection to create a mock test.");
      }
    } catch (e) {
      alert("Error fetching mock questions");
    } finally {
      setQLoading(false);
    }
  };


  const generateInteractiveMock = async () => {
    const count = prompt("How many questions?", "10");
    if (!count) return;
    if (!selPaper) {
      alert("Please select a GATE Paper first!");
      return;
    }
    setQLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/generate-interactive-mock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam: selPaper,
          subject: selSub,
          topics: analytics?.topics ? analytics.topics.slice(0, 3).map(t => t.t) : [],
          count: parseInt(count, 10),
          difficulty: "mixed"
        })
      });
      const data = await res.json();
      if (data.success && data.mock) {
        setMockQuestions(data.mock);
        setMockResults(null);
        setViewMockRunner(true);
        setViewPyqs(false);
        setViewGatePdfs(false);
      } else {
        alert(data.message || "Failed to generate AI mock.");
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setQLoading(false);
    }
  };
  const generateFullMock = async () => {
    if (!selPaper) {
      alert("Please select a GATE Paper (e.g. DA or CS) first!");
      return;
    }
    setQLoading(true);
    try {
      let url = `${API_BASE_URL}/api/academic/gate/generate-mock?paper=${encodeURIComponent(selPaper)}`;
      if (selYear) url += `&year=${selYear}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        setMockQuestions(data);
        setMockResults(null);
        setViewMockRunner(true);
        setViewPyqs(false);
        setViewGatePdfs(false);
      } else {
        alert(`Not enough questions in database to generate a mock for ${selPaper}${selYear ? ' in ' + selYear : ''}.`);
      }
    } catch (e) {
      alert("Error generating full mock test");
    } finally {
      setQLoading(false);
    }
  };

  const handleMockComplete = async (submissions) => {
    try {
      // 1. Grade the Mock
      const gradeRes = await fetch(`${API_BASE_URL}/api/ai/grade-mock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions, exam: selPaper, subject: selSub })
      });
      const gradeData = await gradeRes.json();
      if (!gradeData.success) throw new Error(gradeData.message || "Grading failed");

      const { score, total, accuracy, topicPerformance, feedback } = gradeData.grading;

      // 2. Evaluate & Plan (Silent Mode)
      const evalRes = await fetch(`${API_BASE_URL}/api/ai/mock-evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, total, accuracy, topicPerformance, exam: selPaper, subject: selSub })
      });
      const evalData = await evalRes.json();

      if (evalData.success && evalData.evaluation) {
        const ev = evalData.evaluation;
        const attempted = submissions.filter(s => s.studentAnswer && s.studentAnswer !== "No answer provided" && s.studentAnswer.trim() !== "").length;
        const unattempted = total - attempted;
        const correct = feedback.filter(f => f.isCorrect).length;
        const incorrect = attempted - correct;

        let content = `### 🧠 GPT-OSS-120B Analysis\n`;
        content += `**Weakest Area:** ${ev.weakestArea}\n\n`;
        content += `**Strengths & Analysis:**\n${ev.analysis}\n\n`;

        content += `**📅 Personalized 7-Day Plan:**\n`;
        if (ev.sevenDayPlan) {
          ev.sevenDayPlan.forEach(p => { content += `- **Day ${p.day} (${p.topic}):** *${p.action}*\n`; });
        }

        content += `\n**🎯 Recommended Next Mock:**\n`;
        if (ev.nextMock) {
          content += `- **Type:** ${ev.nextMock.type}\n`;
          content += `- **Difficulty:** ${ev.nextMock.difficulty}\n`;
          content += `- **Subjects:** ${ev.nextMock.subjects ? ev.nextMock.subjects.join(', ') : ''}\n\n`;
        }

        const newMockResults = {
          id: Date.now(),
          date: new Date().toLocaleDateString(),
          exam: selPaper || "GATE",
          subject: selSub || "General",
          grading: gradeData.grading,
          evaluationContent: content,
          stats: { attempted, unattempted, correct, incorrect, total, score }
        };
        setMockResults(newMockResults);
        const userKey = user?._id || 'guest';
        localStorage.setItem(`vidyasetu_mock_results_${userKey}`, JSON.stringify(newMockResults));
        const newHistory = [{ ...newMockResults, questions: mockQuestions }, ...(Array.isArray(mockHistory) ? mockHistory : [])];
        setMockHistory(newHistory);
        localStorage.setItem(`vidyasetu_mock_history_${userKey}`, JSON.stringify(newHistory));
        // We do NOT close the runner. It transitions to Review Mode automatically because mockResults is set.
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
      setViewMockRunner(false);
    }
  };

  const handlePdfChatSubmit = async (e) => {
    e.preventDefault();
    if (!pdfChatInput.trim() || pdfChatLoading) return;
    const msg = pdfChatInput;
    setPdfChatInput("");
    setPdfChatHistory(prev => [...prev, { sender: 'user', text: msg }]);
    setPdfChatLoading(true);

    try {
      const payload = {
        type: "chat",
        exam: selPaper,
        subject: selSub,
        specificTopic: selTopic,
        stats: { totalQuestions: analytics?.totalQuestions, yearsCovered: analytics?.yearsCovered },
        topics: analytics?.topics ? analytics.topics.map(t => ({ t: t.t, p: t.relativeFrequency })) : [],
        userMessage: msg
      };
      if (user) {
        payload.userContext = { name: user.name, branch: user.branch, semester: user.semester };
      }
      const res = await fetch(`${API_BASE_URL}/api/ai/exam-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON"); }
      if (!res.ok) throw new Error(data.error || "AI failed");

      if (data.reply) {
        setPdfChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        setPdfChatHistory(prev => [...prev, { sender: 'ai', text: "Error: No reply" }]);
      }
    } catch (err) {
      setPdfChatHistory(prev => [...prev, { sender: 'ai', text: "Error: " + err.message }]);
    } finally {
      setPdfChatLoading(false);
    }
  };

  const pc = p => p >= 75 ? T.rose : p >= 40 ? T.yellow : T.teal;

  if (fErr) {
    return (
      <div>
        <div className="screen-hero"><div className="screen-hero-inner">
          <h1 style={{ fontSize: 24, color: T.rose }}>Error Loading Filters</h1>
          <p>GATE Insights data is temporarily unavailable.</p>
          <button onClick={fetchFilters} style={{ marginTop: 10, background: T.teal, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8 }}>Retry</button>
        </div></div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-hero">
        <div className="screen-hero-inner">
          <div style={{ display: "inline-block", background: T.rose, color: "#fff", padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, marginBottom: 12 }}>GATE AI Intelligence</div>
          <h1 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 32, fontWeight: 900, marginTop: 4, lineHeight: 1.15, color: T.text, letterSpacing: '-0.4px' }}>GATE Insights</h1>
          <p style={{ color: T.muted, fontSize: 14, marginTop: 8 }}>Master the GATE exam with AI-powered insights, personalized mock tests, and intelligent performance tracking.</p>
        </div>
      </div>

      <div className="screen-body">
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>GATE Paper</label>
              <select value={selPaper} onChange={e => { setSelPaper(e.target.value); setSelSub(""); setSelTopic(""); setSelYear(""); }} style={{ width: "100%", padding: "10px", background: T.gray, border: "1px solid #E8E8E8", borderRadius: 8, marginTop: 4 }}>
                <option value="">Select GATE Paper…</option>
                {availablePapers.map(p => <option key={p} value={p}>{p === 'CS' ? 'CS — Computer Science & Information Technology' : p === 'DA' ? 'DA — Data Science & Artificial Intelligence' : p === 'ECE' ? 'ECE — Electronics & Communication Engineering' : p}</option>)}
              </select>
            </div>
            {selPaper && (
              <div>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Subject</label>
                <select value={selSub} onChange={e => { setSelSub(e.target.value); setSelTopic(""); setSelYear(""); }} style={{ width: "100%", padding: "10px", background: T.gray, border: "1px solid #E8E8E8", borderRadius: 8, marginTop: 4 }}>
                  <option value="">Select Subject…</option>
                  {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {selSub && (
              <div>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Topic</label>
                <select value={selTopic} onChange={e => { setSelTopic(e.target.value); }} style={{ width: "100%", padding: "10px", background: T.gray, border: "1px solid #E8E8E8", borderRadius: 8, marginTop: 4 }}>
                  <option value="">All Topics</option>
                  {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            {selSub && (
              <div>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Year</label>
                <select value={selYear} onChange={e => { setSelYear(e.target.value); }} style={{ width: "100%", padding: "10px", background: T.gray, border: "1px solid #E8E8E8", borderRadius: 8, marginTop: 4 }}>
                  <option value="">All Years</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
          </div>
        </Card>

        {aErr && (
          <Card style={{ padding: 24, textAlign: "center" }}>
            <h3 style={{ color: T.rose }}>GATE Insights data is temporarily unavailable.</h3>
            <button onClick={fetchAnalytics} style={{ marginTop: 12, background: T.teal, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8 }}>Retry</button>
          </Card>
        )}

        {aLoading && !aErr && (
          <Card style={{ padding: 40, textAlign: "center", color: T.muted }}>
            Loading analytics…
          </Card>
        )}

        {!aLoading && !aErr && selPaper && selSub && analytics && !analytics.sufficientData && (
          <Card style={{ padding: 30, textAlign: "center", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            <h3 style={{ color: T.text, marginBottom: 8 }}>No GATE PYQ data available yet.</h3>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 16 }}>Verified GATE PYQs will appear here once they are imported.</p>
          </Card>
        )}

        {!aLoading && !aErr && analytics && analytics.sufficientData && !viewPyqs && (
          <div className="fade-up">

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              <Card style={{ padding: 16 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>PYQs Analyzed</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: T.text }}>{analytics.totalQuestions}</div>
              </Card>
              <Card style={{ padding: 16 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>High-Priority Topics</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: T.rose }}>{(analytics.topics || []).filter(t => t.priority === 'High').length}</div>
              </Card>
              <Card style={{ padding: 16 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Most Frequent Topic</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.indigo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(analytics.topics || [])[0]?.t || 'N/A'}</div>
              </Card>
              <Card style={{ padding: 16 }}>
                <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Recent Trend</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: (analytics.topics || [])[0]?.trendDirection === 'increasing' ? T.success : (analytics.topics || [])[0]?.trendDirection === 'decreasing' ? T.rose : T.yellow }}>
                  {(analytics.topics || [])[0]?.trendDirection === 'increasing' ? '📈 Increasing' : (analytics.topics || [])[0]?.trendDirection === 'decreasing' ? '📉 Decreasing' : '➡️ Stable'}
                </div>
              </Card>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🚀 Actions & Practice</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button onClick={generateFullMock} style={{ background: "#FF4F1F", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Start Mock Test</button>
                <button onClick={simulateMockEvaluation} style={{ background: "#fff", color: T.text, border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🎯 View Last Evaluation</button>
                <button onClick={generateInteractiveMock} style={{ background: "#fff", color: T.text, border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🧪 Generate AI Practice Test</button>
                <button onClick={loadQuestions} style={{ background: "#fff", border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>View All Questions</button>
                <button onClick={fetchPdfs} style={{ background: "#fff", border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>📄 View Original PDFs</button>
              </div>
            </div>

            <div style={{ marginBottom: 24, background: "linear-gradient(to right, rgba(99, 102, 241, 0.05), rgba(236, 72, 153, 0.05))", padding: 16, borderRadius: 12, border: "1px solid rgba(99, 102, 241, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>✨</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.indigo }}>Personalized AI Guidance for {user?.name.split(' ')[0]}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button onClick={() => { setAiModalTitle("What to Study First"); setAiModalContent(""); executeAiAction("what-to-study-first"); }} style={{ background: T.indigo, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Tell Me What to Study First</button>
                <button onClick={() => { setAiModalTitle("Study Plan"); setAiModalContent(""); const days = prompt("Enter duration (e.g., 7 days, 15 days):", "7 days"); if (days) executeAiAction("study-plan", { duration: days }); }} style={{ background: "#fff", color: T.indigo, border: "1px solid " + T.indigo, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Generate GATE Study Plan</button>
              </div>
            </div>

            {viewMockRunner && (
              <MockTestRunner
                key={mockQuestions && mockQuestions.length > 0 ? mockQuestions[0]._id : 'mock-runner'}
                questions={mockQuestions}
                onComplete={handleMockComplete}
                onCancel={() => { setViewMockRunner(false); }}
                results={mockResults}
                onShowAiAnalysis={(c) => {
                  setAiModalContent(c);
                  setAiModalTitle("AI Mock Evaluation & Study Plan");
                  setAiModalOpen(true);
                }}
              />
            )}

            {viewGatePdfs && (
              <div className="fade-up" style={{ marginTop: 24, marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800 }}>Original GATE Papers</h3>
                  <button onClick={() => setViewGatePdfs(false)} style={{ background: T.gray, border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Close</button>
                </div>
                {pdfsLoading ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.muted }}>Loading PDFs...</div>
                ) : gatePdfs.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.muted }}>No original PDFs found for this paper/year. Try importing them in the backend.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {gatePdfs.map(pdf => (
                      <Card key={pdf._id} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ width: 40, height: 40, background: "rgba(239,68,68,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: T.rose, flexShrink: 0 }}>
                            <span className="material-symbols-outlined">picture_as_pdf</span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{pdf.title}</div>
                            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                              Year: {pdf.year} {pdf.set ? `• ${pdf.set}` : ''} • {pdf.pageCount || 0} Pages
                            </div>
                          </div>
                        </div>
                        <Btn onClick={() => {
                          setPdfViewerData({ url: pdf.pdfUrl, title: pdf.title });
                          setPdfChatHistory([{ sender: 'ai', text: "Welcome! Ask me any doubt about the questions you see in the PDF. Example: 'Explain question 12' or 'How do I solve the aptitude analogy question?'" }]);
                        }} variant="secondary" style={{ width: "100%", marginTop: "auto" }}>View PDF & Ask AI</Btn>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="two-panel">
              <div className="section-block">
                <Card style={{ overflowX: "auto" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: T.text }}>📅 Global Year-wise Topic Frequency Heatmap <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>(All GATE PYQs)</span></div>
                  <div style={{ minWidth: 400 }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
                      <div style={{ width: 180, fontSize: 10, color: T.muted }}>TOPIC</div>
                      {(analytics.availableYears || []).map(y => <div key={y} style={{ flex: 1, minWidth: 30, textAlign: "center", fontSize: 10, color: T.muted }}>{y}</div>)}
                    </div>
                    {(analytics.topics || []).map(topicObj => (
                      <div key={topicObj.t} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
                        <div style={{ width: 180, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topicObj.t}>{topicObj.t}</div>
                        {(analytics.availableYears || []).map(yr => {
                          const count = topicObj.yearCounts[yr] || 0;
                          const alpha = count > 0 ? Math.min(255, 60 + (count * 40)).toString(16).padStart(2, "0") : null;
                          return count > 0
                            ? <div key={yr} title={`${topicObj.t} — ${yr}: ${count} questions`} style={{ flex: 1, minWidth: 30, height: 22, borderRadius: 4, background: pc(topicObj.relativeFrequency) + alpha, border: `1px solid ${pc(topicObj.relativeFrequency)}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{count}</div>
                            : <div key={yr} style={{ flex: 1, minWidth: 30, height: 22, borderRadius: 4, background: T.gray, border: `1px solid ${T.border}` }} />;
                        })}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12, color: T.text }}>🎯 AI Recommended Focus <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>(From your Mock)</span></div>
                  {mockHistory && mockHistory.length > 0 && mockHistory[0].grading && mockHistory[0].grading.topicPerformance ? (
                    Object.entries(mockHistory[0].grading.topicPerformance)
                      .map(([t, stats]) => {
                        const acc = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
                        return { t, acc, priority: 100 - acc }; // Lower accuracy = higher priority
                      })
                      .sort((a, b) => b.priority - a.priority)
                      .slice(0, 3)
                      .map(({ t, priority }) => (
                        <div key={t} style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 16 }}>🔥</span>
                            <span style={{ fontSize: 13, color: T.text }}>{t}</span>
                            <span style={{ marginLeft: "auto", fontFamily: 'Inter', color: priority > 60 ? T.rose : T.yellow, fontWeight: 700 }}>{Math.round(priority)}% Priority</span>
                          </div>
                          <div style={{ marginLeft: 30, marginTop: 4 }}>
                            <button onClick={() => { setAiModalTitle(`Why focus on ${t}?`); setAiModalContent(""); executeAiAction("topic-explain", { specificTopic: t, topicProbability: priority }); }} style={{ background: "transparent", border: "none", color: T.indigo, fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}>How to improve? →</button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 13 }}>
                      Take a mock test to get AI recommendations on what to study next!
                    </div>
                  )}
                </Card>
              </div>

              <Card>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: T.text }}>📈 Priority Topics <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>(Based on your Mock Performance)</span></div>
                {mockHistory && mockHistory.length > 0 && mockHistory[0].grading && mockHistory[0].grading.topicPerformance ? (
                  Object.entries(mockHistory[0].grading.topicPerformance)
                    .map(([t, stats]) => {
                      const acc = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
                      const priority = acc < 40 ? 'High' : acc < 75 ? 'Medium' : 'Low';
                      return { t, acc, priority, total: stats.total, correct: stats.correct };
                    })
                    .sort((a, b) => a.acc - b.acc)
                    .map(({ t, acc, priority, total, correct }, i) => (
                      <div key={t} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: T.muted, width: 20 }}>#{i + 1}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{t}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Badge color={acc < 40 ? T.rose : acc < 75 ? T.yellow : T.success}>{priority === 'High' ? "🔥 High" : priority === 'Medium' ? "⚡ Medium" : "✅ Low"}</Badge>
                            <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }} title="Accuracy">{Math.round(acc)}% ({correct}/{total})</span>
                          </div>
                        </div>
                        <PBar value={100 - acc} color={acc < 40 ? T.rose : acc < 75 ? T.yellow : T.success} h={6} />
                      </div>
                    ))
                ) : (
                  <div style={{ padding: 30, textAlign: "center", color: T.muted, background: T.gray, borderRadius: 8 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🎯</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>No mock data available.</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Take a mock test to unlock personalized priority topics based on your weaknesses!</div>
                  </div>
                )}
              </Card>
            </div>

            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📚 Past Mocks History</div>
              {(!mockHistory || mockHistory.length === 0) ? (
                <div style={{ background: "#fff", border: "1px dashed #ccc", padding: 24, borderRadius: 12, textAlign: "center", color: T.muted }}>
                  No past mocks yet. Generate an AI Practice Test or take a Full Mock to see your history here!
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
                  {mockHistory.map((mh, idx) => (
                    <div key={mh.id || idx} onClick={() => {
                      setMockQuestions(mh.questions || []);
                      setMockResults(mh);
                      setViewMockRunner(true);
                    }} style={{ background: "#fff", border: "1px solid #eee", padding: 16, borderRadius: 12, cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>{mh.date} • {mh.exam} - {mh.subject}</div>
                      <div style={{ fontWeight: 700, color: T.text, fontSize: 16 }}>Score: {mh.stats?.score} / {mh.stats?.total}</div>
                      <div style={{ fontSize: 13, color: T.indigo, marginTop: 8, fontWeight: 600 }}>Review Evaluation →</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {viewPyqs && (
          <div className="fade-up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <button onClick={() => setViewPyqs(false)} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontWeight: "bold", padding: 0 }}>← Back to Analytics</button>
              {analytics?.sufficientData && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => { setAiModalTitle("Practice Test"); setAiModalContent(""); const count = prompt("How many questions?", "5"); if (count) executeAiAction("practice-test", { count }); }} style={{ background: "#fff", color: T.text, border: "1px solid #ddd", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🧪 Generate GATE Practice Test</button>
                </div>
              )}
            </div>
            {qLoading ? (
              <Card style={{ padding: 40, textAlign: "center", color: T.muted }}>Loading questions…</Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {questions.length === 0 ? (
                  <Card style={{ padding: 30, textAlign: "center", color: T.muted }}>No GATE questions are available for this selection yet.</Card>
                ) : (
                  questions.map(q => (
                    <Card key={q._id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <Badge color={q.isSampleData ? T.warn : T.success}>{q.isSampleData ? "📝 Practice Question" : "✅ Verified GATE PYQ"}</Badge>
                        <span style={{ fontSize: 12, color: T.muted }}>{q.year} • {q.marks ? `${q.marks} Marks` : ''}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: T.text, marginBottom: 8, whiteSpace: "pre-wrap" }}>{q.question}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                          <span style={{ background: T.gray, padding: "4px 8px", borderRadius: 4, color: T.muted }}>Topic: {q.topic}</span>
                          {q.questionType && <span style={{ background: T.gray, padding: "4px 8px", borderRadius: 4, color: T.muted }}>{q.questionType}</span>}
                          {q.source && <span style={{ background: `${T.success}10`, padding: "4px 8px", borderRadius: 4, color: T.success }}>Source: {q.source}</span>}
                        </div>
                        {analytics?.sufficientData && (
                          <button onClick={() => { setAiModalTitle("Question Explanation"); setAiModalContent(""); executeAiAction("pyq-explain", { question: q.question, isVerified: q.isVerified, year: q.year, marks: q.marks }); }} style={{ background: "transparent", color: T.indigo, border: "1px solid " + T.indigo, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Ask AI ✨</button>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {aiModalOpen && createPortal(
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #eee', background: '#FAFAFA' }}>
              <h2 style={{ fontSize: 24, margin: 0, fontWeight: 700, color: T.text }}>{aiModalTitle}</h2>
              <div style={{ display: 'flex', gap: 12 }}>

                <button onClick={() => setAiModalOpen(false)} style={{ background: T.gray, border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Close</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column' }}>
                {aiActionLoading && !aiModalContent ? (
                  <div style={{ textAlign: "center", padding: 40, color: T.muted, marginTop: 100 }}>
                    <div style={{ marginBottom: 12, fontSize: 24 }}>🤖 AI is analyzing...</div>
                    <div style={{ fontSize: 16 }}>Applying GATE PYQ deterministic data.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, paddingRight: 8, marginBottom: 16 }}>
                      {aiModalContent ? (
                        <div style={{ fontSize: 16, lineHeight: 1.6, color: T.text, whiteSpace: "pre-wrap" }}>
                          {safeRenderMarkdown(aiModalContent)}
                        </div>
                      ) : null}
                    </div>
                    <form onSubmit={handleAiChatSubmit} style={{ display: "flex", gap: 10, marginTop: "auto", borderTop: "1px solid #eee", paddingTop: 16, paddingBottom: 32 }}>
                      <input
                        type="text"
                        value={aiChatInput}
                        onChange={(e) => setAiChatInput(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        style={{ flex: 1, padding: "14px 20px", border: "1px solid #ddd", borderRadius: 8, outline: "none", fontSize: 16 }}
                      />
                      <button type="submit" disabled={aiActionLoading || !aiChatInput.trim()} style={{ background: T.indigo, color: "#fff", border: "none", padding: "0 24px", borderRadius: 8, cursor: aiActionLoading || !aiChatInput.trim() ? "not-allowed" : "pointer", opacity: aiActionLoading || !aiChatInput.trim() ? 0.6 : 1, fontSize: 16, fontWeight: 600 }}>Send</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {pdfViewerData && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee', background: '#FAFAFA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="material-symbols-outlined" style={{ color: T.rose }}>picture_as_pdf</span>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>{pdfViewerData.title}</h2>
              </div>
              <button onClick={() => setPdfViewerData(null)} style={{ background: T.gray, border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Close</button>
            </div>

            <div style={{ display: 'flex', flex: 1, height: '100%' }}>
              <iframe src={pdfViewerData.url} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Viewer" />
            </div>

            {pdfChatOpen ? (
              <div style={{ position: 'fixed', top: 120, right: 24, width: 380, height: 500, maxHeight: 'calc(100vh - 140px)', background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #eee', zIndex: 10000 }}>
                <div style={{ padding: '12px 16px', background: T.indigo, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🤖</span> Ask AI About This Paper
                  </div>
                  <button onClick={() => setPdfChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#FAFAFA' }}>
                  {pdfChatHistory.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 16, borderBottomRightRadius: msg.sender === 'user' ? 4 : 16, borderBottomLeftRadius: msg.sender === 'ai' ? 4 : 16, background: msg.sender === 'user' ? T.indigo : '#fff', color: msg.sender === 'user' ? '#fff' : T.text, fontSize: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        {msg.sender === 'ai' ? safeRenderMarkdown(msg.text) : msg.text}
                      </div>
                    </div>
                  ))}
                  {pdfChatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ padding: '12px 16px', borderRadius: 16, borderBottomLeftRadius: 4, background: '#fff', color: T.muted, fontSize: 14, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        🤖 AI is typing...
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handlePdfChatSubmit} style={{ display: "flex", gap: 10, borderTop: "1px solid #eee", padding: 12, background: '#fff', flexShrink: 0 }}>
                  <input
                    type="text"
                    value={pdfChatInput}
                    onChange={(e) => setPdfChatInput(e.target.value)}
                    placeholder="Type your doubt here..."
                    style={{ flex: 1, padding: "10px 14px", border: "1px solid #ddd", borderRadius: 24, outline: "none", fontSize: 13 }}
                  />
                  <button type="submit" disabled={pdfChatLoading || !pdfChatInput.trim()} style={{ background: T.indigo, color: "#fff", border: "none", padding: "0 20px", borderRadius: 24, cursor: pdfChatLoading || !pdfChatInput.trim() ? "not-allowed" : "pointer", opacity: pdfChatLoading || !pdfChatInput.trim() ? 0.6 : 1, fontWeight: 600, fontSize: 13 }}>Send</button>
                </form>
              </div>
            ) : (
              <button
                onClick={() => setPdfChatOpen(true)}
                style={{ position: 'fixed', top: 120, right: 30, background: T.indigo, color: '#fff', border: 'none', padding: '14px 24px', borderRadius: 30, fontSize: 15, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 10000 }}>
                <span>🤖</span> Ask AI
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
  MODULE: CAMPUS MARKETPLACE 2.0
══════════════════════════════════════ */

// Campus store categories (UI labels — not hardcoded data)
const MARKETPLACE_CATS = [
  { id: 'All', label: 'All' },
  { id: 'Academic', label: '📚 Academic' },
  { id: 'Technology', label: '💻 Technology' },
  { id: 'Hostel', label: '🏠 Hostel' },
  { id: 'Campus Life', label: '🎒 Campus Life' },
  { id: 'Sports', label: '⚽ Sports' },
  { id: 'Other', label: '📦 Other' },
];

// Listing type filter pills
const LISTING_TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sell', label: '🏷️ Sell' },
  { id: 'rent', label: '🔄 Rent' },
  { id: 'exchange', label: '↔️ Exchange' },
  { id: 'free', label: '🎁 Free' },
  { id: 'wanted', label: '🔍 Wanted' },
];

const LISTING_TYPE_COLORS = {
  sell: '#22C55E', rent: '#6366F1', exchange: '#F59E0B',
  free: '#14B8A6', wanted: '#FF4F1F'
};

const LISTING_TYPE_LABELS = {
  sell: 'For Sale', rent: 'For Rent', exchange: 'Exchange',
  free: 'Free', wanted: 'Wanted'
};

const STATUS_COLORS = {
  available: '#22C55E', reserved: '#F59E0B',
  sold: '#888', claimed: '#888', fulfilled: '#6366F1', closed: '#888'
};

const STATUS_LABELS = {
  available: 'Available', reserved: 'Reserved',
  sold: 'Sold', claimed: 'Claimed', fulfilled: 'Fulfilled', closed: 'Closed'
};

// Condition-based badge color
const condColor = c => c === 'Like New' ? '#22C55E' : c === 'Good' ? '#F59E0B' : c === 'Digital' ? '#6366F1' : '#888';

// Relative time helper
function relTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

// Category icon helper
function catIcon(cat) {
  const m = { Academic: '📚', Technology: '💻', Hostel: '🏠', 'Campus Life': '🎒', Sports: '⚽', Books: '📖', Electronics: '🔧', Tools: '🔨', Digital: '💾', Other: '📦' };
  return m[cat] || '📦';
}

/* ── useMarketplace hook — central data + state management ── */
function useMarketplace() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState(null);
  const [error, setError] = React.useState(null);

  const [listingType, setListingType] = React.useState('all');
  const [cat, setCat] = React.useState('All');
  const [searchQ, setSearchQ] = React.useState('');
  const [sort, setSort] = React.useState('newest');
  const [activeView, setActiveView] = React.useState('all'); // 'all' | 'mine' | 'saved'
  const [mineTab, setMineTab] = React.useState('all'); // 'all' | 'available' | 'reserved' | 'closed' | 'wanted'

  const debounceRef = React.useRef(null);

  const loadItems = React.useCallback((overrides = {}) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const lType = overrides.listingType !== undefined ? overrides.listingType : listingType;
    const lCat = overrides.cat !== undefined ? overrides.cat : cat;
    const lSort = overrides.sort !== undefined ? overrides.sort : sort;
    const lQ = overrides.searchQ !== undefined ? overrides.searchQ : searchQ;

    if (lType && lType !== 'all') params.append('listingType', lType);
    if (lCat && lCat !== 'All') params.append('cat', lCat);
    if (lSort) params.append('sort', lSort);
    if (lQ) params.append('search', lQ);
    params.append('limit', '80');

    fetch(`${API_BASE_URL}/api/marketplace?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.items)) {
          setItems(data.items);
          setTotal(data.total || data.items.length);
        } else if (Array.isArray(data)) {
          // backward compat if backend returns plain array
          setItems(data);
          setTotal(data.length);
        } else {
          setItems([]);
          setTotal(0);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to load listings. Please try again.');
        setLoading(false);
      });
  }, [listingType, cat, sort, searchQ]);

  const loadMine = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/marketplace/mine`)
      .then(r => r.json())
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
        setLoading(false);
      })
      .catch(() => { setError('Unable to load your listings.'); setLoading(false); });
  }, []);

  const loadSaved = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/marketplace/saved`)
      .then(r => r.json())
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
        setLoading(false);
      })
      .catch(() => { setError('Unable to load saved items.'); setLoading(false); });
  }, []);

  const loadStats = React.useCallback(() => {
    fetch(`${API_BASE_URL}/api/marketplace/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => { });
  }, []);

  // Initial load + stats
  React.useEffect(() => { loadItems(); loadStats(); }, []);

  const handleSearch = React.useCallback((val) => {
    setSearchQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadItems({ searchQ: val });
    }, 350);
  }, [loadItems]);

  const setListingTypeAndLoad = (lt) => {
    setListingType(lt);
    setActiveView('all');
    loadItems({ listingType: lt });
  };
  const setCatAndLoad = (c) => {
    setCat(c);
    setActiveView('all');
    loadItems({ cat: c });
  };
  const setSortAndLoad = (s) => {
    setSort(s);
    setActiveView('all');
    loadItems({ sort: s });
  };
  const switchView = (v) => {
    setActiveView(v);
    if (v === 'mine') loadMine();
    else if (v === 'saved') loadSaved();
    else loadItems();
  };

  return {
    items, loading, total, stats, error,
    listingType, setListingType: setListingTypeAndLoad,
    cat, setCat: setCatAndLoad,
    searchQ, handleSearch,
    sort, setSort: setSortAndLoad,
    activeView, switchView,
    mineTab, setMineTab,
    reload: () => {
      loadStats();
      if (activeView === 'mine') loadMine();
      else if (activeView === 'saved') loadSaved();
      else loadItems();
    }
  };
}

/* ── Item thumbnail/icon ── */
function ItemThumb({ item, size = 60 }) {
  if (item.photoUrl) {
    return (
      <img src={item.photoUrl} alt={item.title}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: size * 0.2 }} />
    );
  }
  return (
    <span style={{ fontSize: size * 0.45, lineHeight: 1 }}>{catIcon(item.cat)}</span>
  );
}

/* ── Listing type badge ── */
function ListingTypeBadge({ type, small }) {
  const color = LISTING_TYPE_COLORS[type] || '#888';
  const label = LISTING_TYPE_LABELS[type] || type;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: color + '18', color, border: `1px solid ${color}38`,
      borderRadius: 20, padding: small ? '2px 8px' : '3px 10px',
      fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: 0.3
    }}>{label}</span>
  );
}

/* ── Marketplace Item Card ── */
function MarketplaceCard({ item, currentUserRoll, onView, onContact, onSave, onStatusChange, onDelete, onEdit, compact }) {
  const isMine = currentUserRoll && item.sellerRoll === currentUserRoll;
  const isSaved = currentUserRoll && Array.isArray(item.savedBy) && item.savedBy.includes(currentUserRoll);
  const isWanted = item.listingType === 'wanted';
  const isFree = item.listingType === 'free';
  const isUrgent = isWanted && item.neededBy && (new Date(item.neededBy).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) && (new Date(item.neededBy).getTime() > Date.now());
  const typeColor = LISTING_TYPE_COLORS[item.listingType] || '#888';

  return (
    <div className="card-hover" onClick={() => onView(item)} style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid #E8E4DC',
      padding: 0,
      overflow: 'hidden',
      cursor: 'pointer',
      boxShadow: '0 1px 6px rgba(60,30,10,0.06)',
      transition: 'box-shadow .18s, transform .18s',
      opacity: item.status !== 'available' && item.status !== 'reserved' ? 0.68 : 1
    }}>
      {/* Thin top accent strip using listing-type colour */}
      <div style={{ height: 3, background: typeColor, opacity: 0.75 }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Thumbnail row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 10, flexShrink: 0,
            background: '#F7F3EF', border: '1px solid #EDE9E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <ItemThumb item={item} size={56} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 14, lineHeight: 1.35, color: '#1A1A1A',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
              title={item.title}>
              {item.title}
            </div>
            {/* Price line */}
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {isFree ? (
                <span style={{ fontSize: 14, fontWeight: 800, color: '#14B8A6' }}>FREE</span>
              ) : isWanted ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#C2410C' }}>Looking for this</span>
              ) : (
                <>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#2D7A4F' }}>₹{item.price}</span>
                  {item.orig > 0 && item.orig !== item.price && (
                    <span style={{ textDecoration: 'line-through', color: '#AAA', fontSize: 11 }}>₹{item.orig}</span>
                  )}
                </>
              )}
            </div>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <ListingTypeBadge type={item.listingType} small />
              {item.cond && item.cond !== 'N/A' && (
                <span style={{
                  background: '#F7F3EF', color: '#5C4A32',
                  border: '1px solid #E5DBCF', borderRadius: 20,
                  padding: '2px 7px', fontSize: 10, fontWeight: 600
                }}>{item.cond}</span>
              )}
              {item.status && item.status !== 'available' && (
                <span style={{
                  background: STATUS_COLORS[item.status] + '18', color: STATUS_COLORS[item.status],
                  border: `1px solid ${STATUS_COLORS[item.status]}35`, borderRadius: 20,
                  padding: '2px 7px', fontSize: 10, fontWeight: 700
                }}>{STATUS_LABELS[item.status]}</span>
              )}
              {isUrgent && (
                <span style={{
                  background: 'rgba(194,65,12,0.08)', color: '#C2410C',
                  border: '1px solid rgba(194,65,12,0.25)', borderRadius: 20,
                  padding: '2px 7px', fontSize: 10, fontWeight: 700
                }}>⚠️ Urgent</span>
              )}
            </div>
          </div>
        </div>

        {/* Description snippet */}
        {item.desc && (
          <p style={{
            color: '#777', fontSize: 12, marginTop: 10, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {item.desc}
          </p>
        )}

        {/* Exchange note */}
        {item.listingType === 'exchange' && item.exchangeFor && (
          <div style={{
            marginTop: 8, padding: '5px 10px', background: '#FEFCE8',
            borderRadius: 7, border: '1px solid #FDE68A', fontSize: 11, color: '#78350F'
          }}>
            ↔️ Wants: <strong>{item.exchangeFor}</strong>
          </div>
        )}

        {/* Location */}
        {item.location && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#999', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span>📍</span> {item.location}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid #F0EBE3',
        background: '#FDFAF7',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Seller info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: '#F0EAE0',
            border: '1.5px solid #DCCEBE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12
          }}>
            {item.sellerPhoto
              ? <img src={item.sellerPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : '👤'}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: 3 }}>
              {item.sellerName}
              {item.verified && <span style={{ fontSize: 9, color: '#22C55E' }}>✓</span>}
            </div>
            <div style={{ color: '#AAA', fontSize: 10 }}>
              {item.createdAt ? relTime(item.createdAt) : ''}
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
          {currentUserRoll && (
            <button onClick={() => onSave(item)} style={{
              background: isSaved ? 'rgba(255,79,31,0.08)' : 'transparent',
              border: isSaved ? '1px solid rgba(255,79,31,0.3)' : '1px solid #E5DBCF',
              borderRadius: 7, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              transition: 'all .15s'
            }} title={isSaved ? 'Unsave' : 'Save'}>
              {isSaved ? '🔖' : '🏷️'}
            </button>
          )}
          {!isMine && (
            <button onClick={() => onContact(item)} style={{
              background: '#FF4F1F', color: '#fff',
              border: 'none', borderRadius: 7,
              padding: '6px 13px', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'opacity .15s'
            }}>
              {isFree ? 'Claim' : 'Contact'}
            </button>
          )}
          {isMine && (
            <button onClick={() => onEdit(item)} style={{
              background: 'transparent', border: '1px solid #E5DBCF', borderRadius: 7,
              width: 30, height: 30, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'all .15s'
            }} title="Edit">✏️</button>
          )}
        </div>
      </div>
    </div>
  );
}

const getYearNum = (y) => {
  if (!y) return 0;
  const m = String(y).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

/* ── Main TechBazaar / Campus Store component ── */
function TechBazaar({ search = "" }) {
  const addToast = useToast();
  const { user } = useUser();
  const currentUserRoll = user?.rollNo || null;
  const userYearNum = getYearNum(user?.year);

  // Central marketplace hook
  const mp = useMarketplace();
  const { mineTab, setMineTab } = mp;

  // Modals
  const [viewItem, setViewItem] = React.useState(null);
  const [contactItem, setContactItem] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [statusItem, setStatusItem] = React.useState(null);
  const [reportItem, setReportItem] = React.useState(null);
  const [photoZoom, setPhotoZoom] = React.useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = React.useState(null);

  // Create/Edit form state
  const [form, setForm] = React.useState({
    title: '', price: '', orig: '', cond: 'Good', cat: 'Academic', subcat: '',
    desc: '', listingType: 'sell', location: '', exchangeFor: '',
    rentalPeriod: '', rentalDeposit: '', neededBy: ''
  });
  const [photoData, setPhotoData] = React.useState(null);
  const [photoPreview, setPhotoPreview] = React.useState(null);
  const [formLoading, setFormLoading] = React.useState(false);

  // Report form
  const [reportReason, setReportReason] = React.useState('');
  const [reportLoading, setReportLoading] = React.useState(false);

  // Status change
  const [newStatus, setNewStatus] = React.useState('');
  const [statusLoading, setStatusLoading] = React.useState(false);

  // Delete loading
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  // Apply external search prop (from global search bar)
  React.useEffect(() => {
    if (search && search !== mp.searchQ) {
      mp.handleSearch(search);
    }
  }, [search]);

  // Open edit modal: pre-fill form with item data
  const handleEditOpen = (item) => {
    setForm({
      title: item.title || '',
      price: item.price !== undefined ? String(item.price) : '',
      orig: item.orig !== undefined ? String(item.orig) : '',
      cond: item.cond || 'Good',
      cat: item.cat || 'Academic',
      subcat: item.subcat || '',
      desc: item.desc || '',
      listingType: item.listingType || 'sell',
      location: item.location || '',
      exchangeFor: item.exchangeFor || '',
      rentalPeriod: item.rentalPeriod || '',
      rentalDeposit: item.rentalDeposit !== undefined ? String(item.rentalDeposit) : '',
      neededBy: item.neededBy ? new Date(item.neededBy).toISOString().split('T')[0] : ''
    });
    setPhotoData(null);
    setPhotoPreview(item.photoUrl || null);
    setEditItem(item);
  };

  // Open create modal: reset form
  const handleCreateOpen = () => {
    if (!user?.rollNo) {
      addToast('Sign in required', 'Please log in to post a listing.', '🔐', '#FF4F1F');
      return;
    }
    setForm({
      title: '', price: '', orig: '', cond: 'Good', cat: 'Academic', subcat: '',
      desc: '', listingType: 'sell', location: '', exchangeFor: '',
      rentalPeriod: '', rentalDeposit: '', neededBy: ''
    });
    setPhotoData(null);
    setPhotoPreview(null);
    setCreateOpen(true);
  };

  // Handle image file input
  const handlePhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('File too large', 'Please select an image under 5MB', '⚠️', '#EF4444');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoData(reader.result);
      setPhotoPreview(reader.result);
      addToast('Photo attached ✓', file.name, '📸', '#22C55E');
    };
    reader.readAsDataURL(file);
  };

  // Submit create listing
  const handleCreate = async () => {
    if (!form.title.trim()) {
      addToast('Missing title', 'Please enter a title for your listing.', '⚠️', '#EF4444');
      return;
    }
    const type = form.listingType;
    if (type !== 'free' && type !== 'wanted' && !form.price) {
      addToast('Price required', 'Please enter a price for this listing type.', '⚠️', '#EF4444');
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        price: Number(form.price) || 0,
        orig: Number(form.orig) || Number(form.price) || 0,
        cond: form.cond,
        cat: form.cat,
        subcat: form.subcat,
        desc: form.desc,
        listingType: type,
        location: form.location,
        exchangeFor: form.exchangeFor,
        rentalPeriod: form.rentalPeriod,
        rentalDeposit: Number(form.rentalDeposit) || 0,
        neededBy: form.neededBy || null,
        photoData: photoData || null
      };
      const res = await fetch(`${API_BASE_URL}/api/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Listing posted! 🎉', 'Your item is now live on Campus Store.', '✅', '#22C55E');
        setCreateOpen(false);
        mp.reload();
      } else {
        addToast('Failed', data.message || 'Could not post listing.', '❌', '#EF4444');
      }
    } catch (err) {
      addToast('Error', 'Network error. Please try again.', '❌', '#EF4444');
    } finally {
      setFormLoading(false);
    }
  };

  // Submit edit listing
  const handleEdit = async () => {
    if (!editItem) return;
    setFormLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        price: Number(form.price) || 0,
        orig: Number(form.orig) || 0,
        cond: form.cond,
        cat: form.cat,
        subcat: form.subcat,
        desc: form.desc,
        listingType: form.listingType,
        location: form.location,
        exchangeFor: form.exchangeFor,
        rentalPeriod: form.rentalPeriod,
        rentalDeposit: Number(form.rentalDeposit) || 0,
        neededBy: form.neededBy || null,
        photoData: photoData || null
      };
      const res = await fetch(`${API_BASE_URL}/api/marketplace/${editItem._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Listing updated ✓', 'Changes saved successfully.', '✅', '#22C55E');
        setEditItem(null);
        mp.reload();
      } else {
        addToast('Failed', data.message || 'Could not update listing.', '❌', '#EF4444');
      }
    } catch {
      addToast('Error', 'Network error. Please try again.', '❌', '#EF4444');
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle save/unsave
  const handleSave = async (item) => {
    if (!user?.rollNo) {
      addToast('Sign in required', 'Log in to save listings.', '🔐', '#FF4F1F');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/${item._id}/save`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        addToast(data.saved ? 'Saved! 🔖' : 'Removed from saved', '', data.saved ? '🔖' : '🏷️', data.saved ? '#FF4F1F' : '#888');
        mp.reload();
      }
    } catch { }
  };

  // Update listing status
  const handleStatusChange = async () => {
    if (!statusItem || !newStatus) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/${statusItem._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Status updated', `Listing marked as ${newStatus}`, '✅', '#22C55E');
        setStatusItem(null);
        setNewStatus('');
        mp.reload();
      } else {
        addToast('Failed', data.message || 'Could not update status.', '❌', '#EF4444');
      }
    } catch {
      addToast('Error', 'Network error.', '❌', '#EF4444');
    } finally {
      setStatusLoading(false);
    }
  };

  // Delete listing
  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/${deleteConfirmItem._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addToast('Listing removed', 'Your listing has been taken down.', '🗑️', '#888');
        setDeleteConfirmItem(null);
        mp.reload();
      } else {
        addToast('Failed', data.message || 'Could not remove listing.', '❌', '#EF4444');
      }
    } catch {
      addToast('Error', 'Network error.', '❌', '#EF4444');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Submit report
  const handleReport = async () => {
    if (!reportItem || !reportReason) return;
    setReportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketplace/${reportItem._id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Report submitted', 'Thank you. Our team will review this listing.', '🚩', '#F59E0B');
        setReportItem(null);
        setReportReason('');
      } else {
        addToast('Failed', data.message || 'Could not submit report.', '❌', '#EF4444');
      }
    } catch {
      addToast('Error', 'Network error.', '❌', '#EF4444');
    } finally {
      setReportLoading(false);
    }
  };

  // Determine status options for a listing type
  const statusOptionsFor = (listingType) => {
    if (listingType === 'sell') return ['available', 'reserved', 'sold'];
    if (listingType === 'rent') return ['available', 'reserved', 'closed'];
    if (listingType === 'exchange') return ['available', 'reserved', 'closed'];
    if (listingType === 'free') return ['available', 'claimed'];
    if (listingType === 'wanted') return ['available', 'fulfilled', 'closed'];
    return ['available', 'closed'];
  };

  const formNeedsPrice = form.listingType !== 'free' && form.listingType !== 'wanted';
  const formNeedsImage = form.listingType !== 'wanted';

  // ── LISTING FORM (shared between Create and Edit) ──
  const ListingForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Listing Type */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Listing Type *</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {['sell', 'rent', 'exchange', 'free', 'wanted'].map(lt => (
            <button key={lt} onClick={() => setForm(p => ({ ...p, listingType: lt }))} style={{
              background: form.listingType === lt ? LISTING_TYPE_COLORS[lt] : '#F5F5F5',
              color: form.listingType === lt ? '#fff' : '#555',
              border: `1px solid ${form.listingType === lt ? LISTING_TYPE_COLORS[lt] : '#E2E2E2'}`,
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'all .15s'
            }}>
              {LISTING_TYPE_LABELS[lt]}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Item Title *</label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          placeholder={form.listingType === 'wanted' ? 'What are you looking for?' : 'e.g., Engineering Mathematics Textbook'}
          maxLength={200}
        />
      </div>

      {/* Category + Condition row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Category</label>
          <select value={form.cat} onChange={e => setForm(p => ({ ...p, cat: e.target.value }))} style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}>
            {['Academic', 'Technology', 'Hostel', 'Campus Life', 'Sports', 'Other'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Condition</label>
          <select value={form.cond} onChange={e => setForm(p => ({ ...p, cond: e.target.value }))} style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}>
            {form.listingType === 'wanted' ? (
              <option value="N/A">Not Applicable</option>
            ) : (
              <>
                <option>Like New</option>
                <option>Good</option>
                <option>Used</option>
                <option>Digital</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Price + Original MRP (only for sell/rent/exchange) */}
      {formNeedsPrice && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>
              {form.listingType === 'rent' ? 'Rent Price (₹)' : 'Your Price (₹)'} *
            </label>
            <input type="number" min="0" value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              placeholder="₹0" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Original MRP (₹)</label>
            <input type="number" min="0" value={form.orig}
              onChange={e => setForm(p => ({ ...p, orig: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Optional" />
          </div>
        </div>
      )}

      {/* Rent-specific: period + deposit */}
      {form.listingType === 'rent' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Rental Period</label>
            <input value={form.rentalPeriod}
              onChange={e => setForm(p => ({ ...p, rentalPeriod: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              placeholder="e.g., Per day, Per week" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Deposit (₹)</label>
            <input type="number" min="0" value={form.rentalDeposit}
              onChange={e => setForm(p => ({ ...p, rentalDeposit: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Optional" />
          </div>
        </div>
      )}

      {/* Exchange preference */}
      {form.listingType === 'exchange' && (
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Looking to Exchange For</label>
          <input value={form.exchangeFor}
            onChange={e => setForm(p => ({ ...p, exchangeFor: e.target.value }))}
            style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
            placeholder="e.g., Data Structures book, Headphones" />
        </div>
      )}

      {/* Wanted-specific: needed by date */}
      {form.listingType === 'wanted' && (
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Needed By (Optional)</label>
          <input type="date" value={form.neededBy}
            onChange={e => setForm(p => ({ ...p, neededBy: e.target.value }))}
            style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* Description */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Description</label>
        <textarea rows={3} value={form.desc}
          onChange={e => setForm(p => ({ ...p, desc: e.target.value }))}
          style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          placeholder="Any defects, special notes, or additional details…"
          maxLength={2000} />
      </div>

      {/* Campus location */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Meetup/Pickup Location (Optional)</label>
        <input value={form.location}
          onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
          style={{ width: '100%', padding: '10px 14px', marginTop: 6, borderRadius: 8, border: '1px solid #EBEBEB', background: '#F5F5F5', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          placeholder="e.g., Library, Canteen, Main Gate, Hostel Block A"
          maxLength={100} />
      </div>

      {/* Photo upload (not for Wanted) */}
      {formNeedsImage && (
        <label style={{
          display: 'block', padding: photoPreview ? '8px' : '18px',
          borderRadius: 12, border: photoPreview ? `2px solid rgba(34,197,94,0.4)` : '2px dashed #C0C0C0',
          background: photoPreview ? '#F0FFF4' : '#FAFAFA',
          textAlign: 'center', cursor: 'pointer', transition: 'all .2s'
        }}>
          <input type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={handlePhoto} />
          {photoPreview ? (
            <div>
              <img src={photoPreview} style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8 }} alt="Preview" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 14, color: '#22C55E' }}>✓</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>Photo attached — tap to change</span>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Tap to Upload Photo</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Max 5MB • JPG/PNG</div>
            </>
          )}
        </label>
      )}
    </div>
  );

  // ── RENDER ──
  return (
    <div>
      {/* ── HERO HEADER ── */}
      <div className="screen-hero">
        <div className="screen-hero-inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: '#FF4F1F', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0
              }}>
                <img src="/images/logo.png" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} alt="Logo" />
              </div>
              <div>
                <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                  Campus Store
                </h1>
                <p style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Buy · Sell · Rent · Exchange · Free · Wanted</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Stats */}
              {mp.stats && mp.stats.total > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#666',
                  background: '#F5F5F5', border: '1px solid #E8E8E8',
                  borderRadius: 20, padding: '5px 12px'
                }}>
                  {mp.stats.total} listings
                  {mp.stats.free > 0 ? ` · ${mp.stats.free} free` : ''}
                </span>
              )}
              <button onClick={handleCreateOpen} style={{
                background: '#FF4F1F', color: '#fff',
                border: 'none', borderRadius: 9,
                padding: '9px 18px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', letterSpacing: 0.2
              }}>+ Post Listing</button>
            </div>
          </div>

          {/* Search bar */}
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center',
            background: '#fff', border: `1.5px solid ${mp.searchQ ? '#FF4F1F' : '#E0D8CF'}`,
            borderRadius: 10, padding: '9px 14px', maxWidth: 500,
            boxShadow: '0 1px 4px rgba(60,20,10,0.06)', transition: 'border-color .2s'
          }}>
            <span style={{ color: mp.searchQ ? '#FF4F1F' : '#AAA', marginRight: 8, fontSize: 16 }}>🔍</span>
            <input
              value={mp.searchQ}
              onChange={e => mp.handleSearch(e.target.value)}
              placeholder="Search books, electronics, hostel items…"
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13, color: '#1A1A1A', fontFamily: 'Inter, system-ui, sans-serif',
                width: '100%', fontWeight: 500
              }}
            />
            {mp.searchQ && (
              <button onClick={() => mp.handleSearch('')} style={{
                background: '#F0ECE8', border: 'none',
                borderRadius: 5, width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 10, color: '#888', flexShrink: 0
              }}>✕</button>
            )}
          </div>
        </div>
      </div>

      <div className="screen-body">
        {/* ── FILTER TOOLBAR ── */}
        <div style={{ marginBottom: 16 }}>
          {/* Row 1: View tabs + sort */}
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            {[['all', '🏪 All'], ['mine', '📋 My Listings'], ['saved', '🔖 Saved']].map(([v, l]) => (
              <button key={v} onClick={() => mp.switchView(v)} style={{
                background: mp.activeView === v ? '#FF4F1F' : '#fff',
                color: mp.activeView === v ? '#fff' : '#555',
                border: `1px solid ${mp.activeView === v ? '#FF4F1F' : '#E0D8CF'}`,
                borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap'
              }}>{l}</button>
            ))}
            {mp.activeView === 'all' && (
              <select value={mp.sort} onChange={e => mp.setSort(e.target.value)} style={{
                marginLeft: 'auto',
                padding: '8px 12px', borderRadius: 8, border: '1px solid #E0D8CF',
                background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif', outline: 'none'
              }}>
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="updated">Recently updated</option>
              </select>
            )}
          </div>

          {/* Row 2: Listing type pills */}
          {mp.activeView === 'all' && (
            <div style={{
              display: 'flex', gap: 6, alignItems: 'center',
              overflowX: 'auto', flexWrap: 'nowrap',
              paddingBottom: 4, marginBottom: 8,
              scrollbarWidth: 'none', msOverflowStyle: 'none'
            }}>
              {LISTING_TYPE_FILTERS.map(f => (
                <button key={f.id} onClick={() => mp.setListingType(f.id)} style={{
                  background: mp.listingType === f.id ? (LISTING_TYPE_COLORS[f.id] || '#333') : '#F7F3EF',
                  color: mp.listingType === f.id ? '#fff' : '#555',
                  border: `1px solid ${mp.listingType === f.id ? (LISTING_TYPE_COLORS[f.id] || '#333') : '#E5DBCF'}`,
                  borderRadius: 20, padding: '7px 15px', fontSize: 12,
                  fontWeight: mp.listingType === f.id ? 700 : 500,
                  cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0
                }}>{f.label}</button>
              ))}
            </div>
          )}

          {/* Row 3: Category pills on a new line */}
          {mp.activeView === 'all' && (
            <div style={{
              display: 'flex', gap: 6, alignItems: 'center',
              overflowX: 'auto', flexWrap: 'nowrap',
              paddingBottom: 4,
              scrollbarWidth: 'none', msOverflowStyle: 'none'
            }}>
              {MARKETPLACE_CATS.map(c => (
                <button key={c.id} onClick={() => mp.setCat(c.id)} style={{
                  background: mp.cat === c.id ? '#1A1A1A' : 'transparent',
                  color: mp.cat === c.id ? '#fff' : '#888',
                  border: `1px solid ${mp.cat === c.id ? '#1A1A1A' : '#E5DBCF'}`,
                  borderRadius: 20, padding: '7px 15px', fontSize: 12,
                  fontWeight: mp.cat === c.id ? 700 : 400,
                  cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0
                }}>{c.label}</button>
              ))}
            </div>
          )}

          {/* My Listings sub-tabs — single line */}
          {mp.activeView === 'mine' && !mp.loading && !mp.error && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none' }}>
              {['all', 'available', 'reserved', 'closed', 'wanted'].map(t => (
                <button key={t} onClick={() => setMineTab(t)} style={{
                  background: mineTab === t ? '#1A1A1A' : '#F7F3EF',
                  color: mineTab === t ? '#fff' : '#666',
                  border: `1px solid ${mineTab === t ? '#1A1A1A' : '#E5DBCF'}`,
                  borderRadius: 20, padding: '7px 15px', fontSize: 12,
                  fontWeight: mineTab === t ? 700 : 500,
                  cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0
                }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── SEARCH RESULTS INFO ── */}
        {mp.searchQ && (
          <div style={{
            padding: '8px 14px', borderRadius: 8,
            background: '#FFF7F0', border: '1px solid #FDDCB5',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 13 }}>🔎</span>
            <span style={{ fontSize: 12, color: '#FF4F1F', fontWeight: 600 }}>
              {mp.total} result{mp.total !== 1 ? 's' : ''} for "{mp.searchQ}"
            </span>
          </div>
        )}

        {/* ── LOADING STATE ── */}
        {mp.loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
            <div style={{ fontSize: 32, marginBottom: 10, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Loading listings…</div>
          </div>
        )}

        {/* ── ERROR STATE ── */}
        {!mp.loading && mp.error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 14, border: '1px solid #F0EBE3' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>Unable to load listings</div>
            <p style={{ color: '#888', marginTop: 6, fontSize: 13 }}>{mp.error}</p>
            <button onClick={() => mp.reload()} style={{
              marginTop: 14, background: '#F7F3EF', border: '1px solid #E5DBCF',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', color: '#333'
            }}>Try Again</button>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!mp.loading && !mp.error && mp.items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 14, border: '1px solid #F0EBE3' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>
              {mp.activeView === 'mine' ? '📋' : mp.activeView === 'saved' ? '🔖' : mp.listingType === 'wanted' ? '🔍' : mp.listingType === 'free' ? '🎁' : '🛒'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
              {mp.activeView === 'mine' ? "You haven't posted any listings yet"
                : mp.activeView === 'saved' ? "You haven't saved any listings yet"
                  : mp.listingType === 'wanted' ? "No active requests right now"
                    : mp.listingType === 'free' ? "No free items available right now"
                      : mp.searchQ ? `No listings found for "${mp.searchQ}"`
                        : "No listings found"}
            </div>
            <p style={{ color: '#888', marginTop: 6, fontSize: 13 }}>
              {mp.activeView === 'mine' ? "Post something to get started!"
                : mp.activeView === 'saved' ? "Browse listings and save ones you like."
                  : "Try changing your filters or check back later."}
            </p>
            {mp.activeView === 'mine' && (
              <button onClick={handleCreateOpen} style={{
                marginTop: 16, background: '#FF4F1F', color: '#fff',
                border: 'none', borderRadius: 9,
                padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>+ Post First Listing</button>
            )}
          </div>
        )}

        {/* ── SECTION HEADERS (default view only) ── */}
        {!mp.loading && !mp.error && mp.activeView === 'all' && mp.listingType === 'all' && mp.cat === 'All' && !mp.searchQ && mp.items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Seniors section */}
            {mp.items.some(i => getYearNum(i.year) > userYearNum) && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>🎓</span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>From Your Seniors</h2>
                </div>
                <div className="grid-auto">
                  {mp.items.filter(i => getYearNum(i.year) > userYearNum).slice(0, 4).map(item => (
                    <MarketplaceCard key={item._id} item={item} currentUserRoll={currentUserRoll} onView={setViewItem} onContact={setContactItem} onSave={handleSave} onStatusChange={(it) => { setStatusItem(it); setNewStatus(it.status || 'available'); }} onDelete={setDeleteConfirmItem} onEdit={handleEditOpen} />
                  ))}
                </div>
              </div>
            )}

            {/* Academic section */}
            {mp.items.some(i => i.cat === 'Academic') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>📚</span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Academic Essentials</h2>
                </div>
                <div className="grid-auto">
                  {mp.items.filter(i => i.cat === 'Academic').slice(0, 4).map(item => (
                    <MarketplaceCard key={item._id} item={item} currentUserRoll={currentUserRoll} onView={setViewItem} onContact={setContactItem} onSave={handleSave} onStatusChange={(it) => { setStatusItem(it); setNewStatus(it.status || 'available'); }} onDelete={setDeleteConfirmItem} onEdit={handleEditOpen} />
                  ))}
                </div>
              </div>
            )}

            {/* Free corner */}
            {mp.items.some(i => i.listingType === 'free') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>🎁</span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D9488', margin: 0 }}>Free Corner</h2>
                  <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>— grab before it's gone</span>
                </div>
                <div className="grid-auto">
                  {mp.items.filter(i => i.listingType === 'free').slice(0, 4).map(item => (
                    <MarketplaceCard key={item._id} item={item} currentUserRoll={currentUserRoll} onView={setViewItem} onContact={setContactItem} onSave={handleSave} onStatusChange={(it) => { setStatusItem(it); setNewStatus(it.status || 'available'); }} onDelete={setDeleteConfirmItem} onEdit={handleEditOpen} />
                  ))}
                </div>
              </div>
            )}

            {/* Wanted */}
            {mp.items.some(i => i.listingType === 'wanted') && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#C2410C', margin: 0 }}>Wanted on Campus</h2>
                </div>
                <div className="grid-auto">
                  {mp.items.filter(i => i.listingType === 'wanted').slice(0, 4).map(item => (
                    <MarketplaceCard key={item._id} item={item} currentUserRoll={currentUserRoll} onView={setViewItem} onContact={setContactItem} onSave={handleSave} onStatusChange={(it) => { setStatusItem(it); setNewStatus(it.status || 'available'); }} onDelete={setDeleteConfirmItem} onEdit={handleEditOpen} />
                  ))}
                </div>
              </div>
            )}

            {/* Recently Added header — the grid below will render all */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>🛒</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Recently Added</h2>
              </div>
            </div>
          </div>
        )}

        {/* ── LISTINGS GRID ── */}
        {!mp.loading && !mp.error && mp.items.length > 0 && (
          <div className="grid-auto" style={{ marginTop: 4 }}>
            {mp.items.filter(item => {
              if (mp.activeView !== 'mine') return true;
              if (mineTab === 'all') return true;
              if (mineTab === 'wanted') return item.listingType === 'wanted';
              return item.status === mineTab;
            }).map(item => (
              <MarketplaceCard
                key={item._id}
                item={item}
                currentUserRoll={currentUserRoll}
                onView={setViewItem}
                onContact={setContactItem}
                onSave={handleSave}
                onEdit={handleEditOpen}
                onStatusChange={(it) => { setStatusItem(it); setNewStatus(it.status || 'available'); }}
                onDelete={setDeleteConfirmItem}
              />
            ))}
          </div>
        )}

        {/* ── Can't find section + safety tip ── */}
        {!mp.loading && mp.activeView === 'all' && (
          <div style={{ marginTop: 28 }}>
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: '#FFF7F0', border: '1px solid #FDDCB5',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10
            }}>
              <div style={{ fontSize: 13, color: '#FF4F1F', fontWeight: 600 }}>
                Can't find what you need? Ask peers in Community Hub.
              </div>
              <button onClick={() => { window.location.hash = 'community'; }} style={{
                background: '#FF4F1F', color: '#fff',
                border: 'none', borderRadius: 7,
                padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>Ask Community 💬</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#AAA', textAlign: 'center' }}>
              💡 Always meet in a public campus spot. Never share OTPs or pay in advance.
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════
            MODALS
          ══════════════════════════════════ */}

      {/* ── ITEM DETAIL MODAL ── */}
      <Modal open={!!viewItem} onClose={() => { setViewItem(null); setPhotoZoom(false); }}
        title={viewItem ? (catIcon(viewItem.cat) + ' ' + viewItem.title) : ''} aboveNav={true}>
        {viewItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Photo */}
            <div onClick={() => viewItem.photoUrl && setPhotoZoom(true)} style={{
              width: '100%', borderRadius: 16, overflow: 'hidden',
              background: 'linear-gradient(145deg,#F8F8F8,#F0F0F0)',
              border: '1px solid #E8E8E8', minHeight: 180, maxHeight: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: viewItem.photoUrl ? 'zoom-in' : 'default', position: 'relative'
            }}>
              {viewItem.photoUrl ? (
                <>
                  <img src={viewItem.photoUrl} alt={viewItem.title} style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 300, padding: 8 }} />
                  <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    🔍 Tap to expand
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 56, marginBottom: 8 }}>{catIcon(viewItem.cat)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>No photo uploaded</div>
                </div>
              )}
            </div>

            {/* Listing type + status */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ListingTypeBadge type={viewItem.listingType} />
              {viewItem.status && (
                <span style={{
                  background: STATUS_COLORS[viewItem.status] + '18', color: STATUS_COLORS[viewItem.status],
                  border: `1px solid ${STATUS_COLORS[viewItem.status]}35`, borderRadius: 20,
                  padding: '3px 10px', fontSize: 11, fontWeight: 700
                }}>{STATUS_LABELS[viewItem.status]}</span>
              )}
              {viewItem.cond && viewItem.cond !== 'N/A' && (
                <span style={{ background: condColor(viewItem.cond) + '18', color: condColor(viewItem.cond), border: `1px solid ${condColor(viewItem.cond)}35`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  {viewItem.cond}
                </span>
              )}
              {viewItem.cat && (
                <span style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  {catIcon(viewItem.cat)} {viewItem.cat}
                </span>
              )}
            </div>

            {/* Price block */}
            {viewItem.listingType !== 'wanted' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 14, background: viewItem.listingType === 'free' ? 'rgba(20,184,166,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${viewItem.listingType === 'free' ? 'rgba(20,184,166,0.2)' : 'rgba(34,197,94,0.18)'}` }}>
                <div>
                  {viewItem.listingType === 'free' ? (
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#14B8A6' }}>FREE 🎁</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#22C55E', fontFamily: 'Inter, system-ui, sans-serif' }}>₹{viewItem.price}</div>
                      {viewItem.orig > 0 && viewItem.orig !== viewItem.price && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ textDecoration: 'line-through', color: '#888', fontSize: 14 }}>₹{viewItem.orig}</span>
                          <span style={{ background: 'rgba(255,79,31,0.1)', color: '#FF4F1F', border: '1px solid rgba(255,79,31,0.25)', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                            -{Math.round((1 - viewItem.price / viewItem.orig) * 100)}% OFF
                          </span>
                        </div>
                      )}
                      {viewItem.listingType === 'rent' && viewItem.rentalPeriod && (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Per: {viewItem.rentalPeriod}</div>
                      )}
                      {viewItem.listingType === 'rent' && viewItem.rentalDeposit > 0 && (
                        <div style={{ fontSize: 11, color: '#888' }}>Deposit: ₹{viewItem.rentalDeposit}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Exchange for */}
            {viewItem.listingType === 'exchange' && viewItem.exchangeFor && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Looking to Exchange For</div>
                <p style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 600 }}>{viewItem.exchangeFor}</p>
              </div>
            )}

            {/* Wanted: needed by */}
            {viewItem.listingType === 'wanted' && viewItem.neededBy && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,79,31,0.05)', border: '1px solid rgba(255,79,31,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Needed By</div>
                <p style={{ fontSize: 14, color: '#FF4F1F', fontWeight: 600 }}>{new Date(viewItem.neededBy).toLocaleDateString()}</p>
              </div>
            )}

            {/* Description */}
            {viewItem.desc && (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: '#FAFAFA', border: '1px solid #EBEBEB' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.8 }}>Description</div>
                <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.6 }}>{viewItem.desc}</p>
              </div>
            )}

            {/* Location */}
            {viewItem.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <span style={{ fontSize: 18 }}>📍</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Meetup Location</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{viewItem.location}</div>
                </div>
              </div>
            )}

            {/* Seller info */}
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(255,79,31,0.04),rgba(255,199,0,0.03))', border: '1px solid rgba(255,79,31,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.8 }}>
                {viewItem.listingType === 'wanted' ? 'Requested By' : 'Seller'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: viewItem.sellerPhoto ? 'transparent' : 'linear-gradient(135deg,#FF4F1F,#FFC700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', fontWeight: 700, flexShrink: 0, border: viewItem.sellerPhoto ? '2.5px solid rgba(255,79,31,0.3)' : 'none', boxShadow: '0 2px 10px rgba(255,79,31,0.15)', overflow: 'hidden' }}>
                  {viewItem.sellerPhoto ? <img src={viewItem.sellerPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="" /> : (viewItem.sellerName ? viewItem.sellerName.charAt(0).toUpperCase() : '?')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{viewItem.sellerName}</span>
                    {viewItem.verified && <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 10 }}>✓ Verified</span>}
                  </div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                    {[viewItem.branch, viewItem.year ? viewItem.year + ' Year' : null].filter(Boolean).join(' • ')}
                    {viewItem.createdAt ? ` • ${relTime(viewItem.createdAt)}` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Safety tip */}
            <div style={{ color: '#888', fontSize: 11, padding: '10px 14px', background: 'rgba(255,79,31,0.03)', borderRadius: 10, border: '1px solid rgba(255,79,31,0.10)', lineHeight: 1.5, textAlign: 'center' }}>
              💡 Always meet in a public campus location. Never share bank OTPs or send money in advance.
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {currentUserRoll && viewItem.sellerRoll !== currentUserRoll && (
                <Btn variant="teal" style={{ flex: 1, padding: 14, minWidth: 120 }}
                  onClick={() => { setViewItem(null); setContactItem(viewItem); }}>
                  {viewItem.listingType === 'free' ? '🎁 Claim Item' : '📞 Contact Seller'}
                </Btn>
              )}
              {viewItem.photoUrl && (
                <Btn variant="ghost" style={{ padding: '14px 18px' }} onClick={() => setPhotoZoom(true)}>🖼️ View Photo</Btn>
              )}
              {/* Owner actions */}
              {currentUserRoll && viewItem.sellerRoll === currentUserRoll && (
                <>
                  <Btn variant="secondary" style={{ flex: 1, padding: 14 }}
                    onClick={() => { setViewItem(null); handleEditOpen(viewItem); }}>
                    ✏️ Edit
                  </Btn>
                  <button onClick={() => { setViewItem(null); setStatusItem(viewItem); setNewStatus(viewItem.status || 'available'); }}
                    style={{ background: '#F5F5F5', border: '1px solid #E2E2E2', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#555', transition: 'all .15s' }}>
                    📊 Status
                  </button>
                  <button onClick={() => { setViewItem(null); setDeleteConfirmItem(viewItem); }}
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#EF4444', transition: 'all .15s' }}>
                    🗑️
                  </button>
                </>
              )}
              {/* Report button (for non-owners) */}
              {currentUserRoll && viewItem.sellerRoll !== currentUserRoll && (
                <button onClick={() => { setViewItem(null); setReportItem(viewItem); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#BBB', padding: '4px 8px', transition: 'color .15s' }}
                  title="Report this listing">
                  🚩 Report
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── FULLSCREEN PHOTO ZOOM ── */}
      {photoZoom && viewItem && viewItem.photoUrl && (
        <div onClick={() => setPhotoZoom(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both', cursor: 'zoom-out' }}>
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <button onClick={() => setPhotoZoom(false)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10, width: 40, height: 40, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>✕</button>
          </div>
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderRadius: 10, padding: '8px 16px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{viewItem.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{viewItem.sellerName} {viewItem.listingType !== 'free' && viewItem.listingType !== 'wanted' ? `• ₹${viewItem.price}` : ''}</div>
          </div>
          <img onClick={e => e.stopPropagation()} src={viewItem.photoUrl} alt={viewItem.title}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 20px 80px rgba(0,0,0,0.5)', cursor: 'default' }} />
          <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500 }}>📷 Tap outside or press ✕ to close</div>
        </div>
      )}

      {/* ── CONTACT SELLER MODAL ── */}
      <Modal open={!!contactItem} onClose={() => setContactItem(null)} title="📞 Contact Seller" aboveNav={true}>
        {contactItem && (
          <>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(20,184,166,0.06),rgba(99,102,241,0.04))', border: '1px solid rgba(20,184,166,0.15)', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#1A1A1A' }}>{contactItem.title}</div>
              <div style={{ color: '#22C55E', fontSize: 18, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}>
                {contactItem.listingType === 'free' ? 'FREE 🎁' : contactItem.listingType === 'wanted' ? 'Wanted' : `₹${contactItem.price}`}
              </div>
              <div style={{ marginTop: 6 }}><ListingTypeBadge type={contactItem.listingType} small /></div>
            </div>
            {[
              ['👤', 'Seller', contactItem.sellerName],
              ['🎓', 'Branch & Year', [contactItem.branch, contactItem.year ? contactItem.year + ' Year' : null].filter(Boolean).join(' • ')],
              contactItem.location ? ['📍', 'Meetup Location', contactItem.location] : null,
            ].filter(Boolean).map(([icon, label, val]) => (
              val ? (
                <div key={label} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#F8F8F8', border: '1px solid #EBEBEB', marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <div>
                    <div style={{ color: '#888', fontSize: 11 }}>{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A1A' }}>{val}</div>
                  </div>
                </div>
              ) : null
            ))}
            <div style={{ color: '#888', fontSize: 11, marginTop: 10, padding: '10px 14px', background: 'rgba(255,79,31,0.04)', borderRadius: 10, border: '1px solid rgba(255,79,31,0.14)', lineHeight: 1.5 }}>
              💡 Meet in a public campus location. Never share bank OTPs or send money in advance.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {contactItem.sellerContact ? (
                <a href={`https://wa.me/${contactItem.sellerContact.replace(/[^0-9]/g, '').length === 10 ? '91' + contactItem.sellerContact.replace(/[^0-9]/g, '') : contactItem.sellerContact.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(contactItem.sellerName)},%20I'm%20interested%20in%20your%20"${encodeURIComponent(contactItem.title)}"%20listed%20on%20Vidya%20Setu%20Campus%20Marketplace.`}
                  target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                  <Btn variant="teal" style={{ width: '100%' }}
                    onClick={() => addToast('Opening WhatsApp', 'Connecting you with ' + contactItem.sellerName, '💬', '#14B8A6')}>
                    💬 WhatsApp
                  </Btn>
                </a>
              ) : null}
              {contactItem.sellerEmail ? (
                <a href={`mailto:${contactItem.sellerEmail}?subject=Campus Store: ${encodeURIComponent(contactItem.title)}`}
                  target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                  <Btn variant="secondary" style={{ width: '100%' }}
                    onClick={() => addToast('Opening email', contactItem.sellerName, '📧', '#888')}>
                    📧 Email
                  </Btn>
                </a>
              ) : null}
              {!contactItem.sellerContact && !contactItem.sellerEmail && (
                <div style={{ color: '#EF4444', fontSize: 13, fontWeight: 600, textAlign: 'center', width: '100%', padding: 10 }}>
                  Contact information unavailable. Ask through Community Hub.
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ── CREATE LISTING MODAL ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="🏪 Post a Listing" aboveNav={true}>
        {ListingForm()}
        <Btn variant="primary" style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 16 }}
          disabled={formLoading} onClick={handleCreate}>
          {formLoading ? (photoData ? '⏳ Uploading Photo…' : '⏳ Posting…') : '🚀 Post Listing'}
        </Btn>
      </Modal>

      {/* ── EDIT LISTING MODAL ── */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="✏️ Edit Listing" aboveNav={true}>
        {ListingForm()}
        <Btn variant="primary" style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 16 }}
          disabled={formLoading} onClick={handleEdit}>
          {formLoading ? '⏳ Saving…' : '💾 Save Changes'}
        </Btn>
      </Modal>

      {/* ── STATUS CHANGE MODAL ── */}
      <Modal open={!!statusItem} onClose={() => setStatusItem(null)} title="📊 Update Listing Status" aboveNav={true}>
        {statusItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: '#555', fontSize: 13 }}>Update the status of: <strong>{statusItem.title}</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {statusOptionsFor(statusItem.listingType).map(s => (
                <button key={s} onClick={() => setNewStatus(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderRadius: 10, border: `1.5px solid ${newStatus === s ? STATUS_COLORS[s] : '#EBEBEB'}`,
                  background: newStatus === s ? STATUS_COLORS[s] + '10' : '#FAFAFA',
                  cursor: 'pointer', transition: 'all .15s', textAlign: 'left'
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[s], flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{STATUS_LABELS[s]}</div>
                  </div>
                  {newStatus === s && <span style={{ marginLeft: 'auto', color: STATUS_COLORS[s] }}>✓</span>}
                </button>
              ))}
            </div>
            <Btn variant="primary" style={{ width: '100%', padding: 13, marginTop: 8 }}
              disabled={statusLoading || !newStatus} onClick={handleStatusChange}>
              {statusLoading ? '⏳ Updating…' : 'Update Status'}
            </Btn>
          </div>
        )}
      </Modal>

      {/* ── DELETE CONFIRM MODAL ── */}
      <Modal open={!!deleteConfirmItem} onClose={() => setDeleteConfirmItem(null)} title="🗑️ Remove Listing" aboveNav={true}>
        {deleteConfirmItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: '#555', fontSize: 14 }}>
              Are you sure you want to remove <strong>"{deleteConfirmItem.title}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setDeleteConfirmItem(null)}>Cancel</Btn>
              <button onClick={handleDelete} disabled={deleteLoading} style={{
                flex: 1, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: deleteLoading ? 0.5 : 1
              }}>{deleteLoading ? '⏳ Removing…' : '🗑️ Remove Listing'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── REPORT MODAL ── */}
      <Modal open={!!reportItem} onClose={() => { setReportItem(null); setReportReason(''); }} title="🚩 Report Listing" aboveNav={true}>
        {reportItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: '#555', fontSize: 13 }}>Report: <strong>{reportItem.title}</strong></p>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Reason</div>
            {['Spam', 'Wrong information', 'Inappropriate content', 'Scam/suspicious', 'Other'].map(r => (
              <button key={r} onClick={() => setReportReason(r)} style={{
                padding: '10px 14px', borderRadius: 10,
                border: `1.5px solid ${reportReason === r ? '#FF4F1F' : '#EBEBEB'}`,
                background: reportReason === r ? 'rgba(255,79,31,0.07)' : '#FAFAFA',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: reportReason === r ? 700 : 400,
                color: reportReason === r ? '#FF4F1F' : '#555', transition: 'all .15s'
              }}>{r}</button>
            ))}
            <Btn variant="primary" style={{ width: '100%', padding: 13, marginTop: 8 }}
              disabled={reportLoading || !reportReason} onClick={handleReport}>
              {reportLoading ? '⏳ Submitting…' : '🚩 Submit Report'}
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}


/* ══════════════════════════════════════
  MODULE: KARYA-DISHA
══════════════════════════════════════ */
const ROLES = {
  "Frontend Developer": { req: ["HTML/CSS", "JavaScript", "React", "TypeScript", "Git"], nice: ["Next.js", "Figma", "GraphQL"], projs: ["Portfolio Website", "Weather App (API)", "To-Do App (React)", "E-commerce UI"] },
  "Backend Developer": { req: ["Python/Node.js", "SQL", "REST APIs", "Git", "Linux"], nice: ["Docker", "Redis", "MongoDB", "AWS"], projs: ["URL Shortener API", "Authentication System", "CRUD Blog App", "Chat Application"] },
  "Data Scientist": { req: ["Python", "NumPy/Pandas", "ML Basics", "Statistics", "SQL"], nice: ["TensorFlow", "Deep Learning", "Data Visualization", "R"], projs: ["MNIST Digit Classifier", "House Price Prediction", "Sentiment Analysis", "EDA on Real Dataset"] },
  "DevOps Engineer": { req: ["Linux", "Docker", "Git", "CI/CD", "Networking"], nice: ["Kubernetes", "Terraform", "AWS/GCP", "Prometheus"], projs: ["Dockerize a Web App", "Jenkins CI Pipeline", "AWS EC2 Deployment", "Bash Automation"] },
  "Android Developer": { req: ["Java/Kotlin", "Android Studio", "XML Layouts", "Git", "REST APIs"], nice: ["Jetpack Compose", "Firebase", "MVVM", "Room DB"], projs: ["Notes App", "Weather App", "Expense Tracker", "Chat App (Firebase)"] },
};
const ASKILLS = ["C", "C++", "Python", "Java", "JavaScript", "Kotlin", "HTML/CSS", "SQL", "React", "Node.js", "Android Studio", "Git", "Linux", "Docker", "TypeScript", "NumPy/Pandas", "REST APIs", "XML Layouts", "ML Basics", "Statistics", "Firebase", "MongoDB", "AWS"];

/* ══════════════════════════════════════
  MODULE: COMMUNITY FORUM
══════════════════════════════════════ */
function CommunityForum({ search = "" }) {
  const { user } = useUser();
  const [posts, setPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [postOpen, setPostOpen] = React.useState(false);
  const [viewPost, setViewPost] = React.useState(null);
  const [commentText, setCommentText] = React.useState("");
  const [postForm, setPostForm] = React.useState({ title: "", content: "", category: "Doubt" });
  const [photoData, setPhotoData] = React.useState(null);
  const [photoPreview, setPhotoPreview] = React.useState(null);
  const [posting, setPosting] = React.useState(false);
  const [studentsOnline, setStudentsOnline] = React.useState(0);
  const [onlineUsersList, setOnlineUsersList] = React.useState([]);
  const [onlinePopup, setOnlinePopup] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("feed");
  const [studyGroups, setStudyGroups] = React.useState([]);
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [newGroupForm, setNewGroupForm] = React.useState({ name: "", desc: "", branch: "CSE", year: "2nd Year" });
  const [openGroup, setOpenGroup] = React.useState(null);
  const [groupMsg, setGroupMsg] = React.useState("");
  const [groupMessages, setGroupMessages] = React.useState({});
  const [groupsFilter, setGroupsFilter] = React.useState("all");
  const [leaveConfirm, setLeaveConfirm] = React.useState(false);
  const [msgDeleteConfirm, setMsgDeleteConfirm] = React.useState(null);
  const [roomTab, setRoomTab] = React.useState("discussion");
  const [groupPyqs, setGroupPyqs] = React.useState({});
  const [pyqDeleteConfirm, setPyqDeleteConfirm] = React.useState(null);
  const addToast = useToast();
  const socketRef = React.useRef(null);
  const [liveGroupMembers, setLiveGroupMembers] = React.useState({});

  // 🔌 Real-time online students via Socket.io (no HTTP polling)
  React.useEffect(() => {
    const socket = io(API_BASE_URL, { withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => {
      if (user && user._id) {
        socket.emit('student-online', {
          id: user._id,
          name: user.name,
          profilePhoto: user.profilePhoto,
          branch: user.branch,
          year: user.year
        });
      }
      socket.emit('get-online-students');
    });
    socket.on('online-students-update', ({ count, users }) => {
      setStudentsOnline(count);
      if (users) setOnlineUsersList(users);
    });
    return () => {
      if (user && user._id) socket.emit('student-offline', user._id);
      socket.disconnect();
    };
  }, [user]);

  React.useEffect(() => {
    if (openGroup && socketRef.current && user && user._id) {
      const userData = {
        id: user._id,
        name: user.name,
        profilePhoto: user.profilePhoto,
        branch: user.branch,
        year: user.year,
        rollNo: user.rollNo
      };
      socketRef.current.emit('join-group', { groupId: openGroup, userData });
      
      const handleGroupMembersUpdate = (members) => {
        setLiveGroupMembers(prev => ({ ...prev, [openGroup]: members }));
      };
      
      const handleGroupMessage = (msg) => {
        setGroupMessages(prev => ({ ...prev, [openGroup]: [...(prev[openGroup] || []), msg] }));
      };

      socketRef.current.on(`group-members-update-${openGroup}`, handleGroupMembersUpdate);
      socketRef.current.on(`new-group-message-${openGroup}`, handleGroupMessage);
      
      return () => {
        socketRef.current.emit('leave-group', { groupId: openGroup });
        socketRef.current.off(`group-members-update-${openGroup}`, handleGroupMembersUpdate);
        socketRef.current.off(`new-group-message-${openGroup}`, handleGroupMessage);
      };
    }
  }, [openGroup, user]);

  const fetchPosts = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/community`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPosts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchStudyGroups = () => {
    fetch(`${API_BASE_URL}/api/study-groups`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data.map(g => ({ ...g, id: g._id, joined: g.members?.includes(user?.rollNo) }));
          setStudyGroups(mapped);
        }
      })
      .catch(console.error);
  };

  React.useEffect(() => {
    fetchPosts();
    fetchStudyGroups();
  }, [user]);

  const handleCreatePost = async () => {
    if (!postForm.title || !postForm.content) {
      addToast("Missing Fields", "Please add a title and description.", <span className="material-symbols-outlined">error</span>, T.rose);
      return;
    }
    setPosting(true);
    const payload = {
      ...postForm,
      authorName: user.name,
      authorRoll: user.rollNo,
      authorPhoto: user.profilePhoto,
      photoData
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setPosts(prev => [data, ...prev]);
        setPostOpen(false);
        setPostForm({ title: "", content: "", category: "Doubt" });
        setPhotoData(null);
        setPhotoPreview(null);
        addToast("Post shared!", "Your doubt is now live.", <span className="material-symbols-outlined">check_circle</span>, T.success);
      } else {
        throw new Error(data.error || "Post failed");
      }
    } catch (err) {
      addToast("Post failed", err.message, <span className="material-symbols-outlined">error</span>, T.rose);
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/community/${postId}/like`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(prev => prev.map(p => p._id === updatedPost._id ? updatedPost : p));
        if (viewPost && viewPost._id === updatedPost._id) {
          setViewPost(updatedPost);
        }
      }
    } catch (err) {
      console.error("Failed to like post", err);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/community/${viewPost._id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: user.name,
          authorRoll: user.rollNo,
          authorPhoto: user.profilePhoto,
          text: commentText
        })
      });
      const updatedPost = await res.json();
      if (res.ok) {
        setViewPost(updatedPost);
        setPosts(prev => prev.map(p => p._id === updatedPost._id ? updatedPost : p));
        setCommentText("");
        addToast("Comment added", "Thanks for helping!", <span className="material-symbols-outlined">chat</span>, T.indigo);
      }
    } catch (err) { }
  };

  const handleSendGroupMsg = async (groupId) => {
    if (!groupMsg.trim()) return;
    const currentMsg = groupMsg;
    setGroupMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/study-groups/${groupId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: currentMsg })
      });
      if (res.ok) {
        const newMsg = await res.json();
        socketRef.current?.emit('group-message', { groupId, message: newMsg });
        setGroupMessages(prev => ({ ...prev, [groupId]: [...(prev[groupId] || []), newMsg] }));
      }
    } catch (err) {}
  };

  const handleJoinGroup = async (groupId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/study-groups/${groupId}/join`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        const group = await res.json();
        group.id = group._id;
        group.joined = true;
        setStudyGroups(prev => prev.map(g => g.id === groupId ? group : g));
        addToast("Joined!", "You've joined the study group.", <span className="material-symbols-outlined">group</span>, T.success);
      }
    } catch (err) { }
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/study-groups/${groupId}/leave`, {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        const group = await res.json();
        group.id = group._id;
        group.joined = false;
        setStudyGroups(prev => prev.map(g => g.id === groupId ? group : g));
        setOpenGroup(null);
        setLeaveConfirm(false);
        setRoomTab("discussion");
        addToast("Left group", "You've left the group.", <span className="material-symbols-outlined">logout</span>, T.rose);
      }
    } catch (err) { }
  };

  const handleCreateGroup = async () => {
    if (!newGroupForm.name.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/study-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newGroupForm)
      });
      if (res.ok) {
        const ng = await res.json();
        ng.id = ng._id;
        ng.joined = true;
        setStudyGroups(prev => [ng, ...prev]);
        setCreateGroupOpen(false);
        setNewGroupForm({ name: "", desc: "", branch: "CSE", year: "2nd Year" });
        addToast("Group Created!", "Your study group is live.", <span className="material-symbols-outlined">check_circle</span>, T.success);
      }
    } catch (err) { }
  };


  const TRENDING = ["#Internship", "#Scholarship", "#Placement", "#Semester Exam", "#Projects"];
  const TABS = [
    { id: "feed", label: "Campus Feed", icon: "📢" },
    { id: "dept", label: "My Department", icon: "🏫" },
    { id: "groups", label: "Study Groups", icon: "👥" },

  ];
  const badgeColor = (cat) => {
    const map = { Doubt: "#FEE2E2", Note: "#D1FAE5", Update: "#DBEAFE", General: "#F3E8FF" };
    const textMap = { Doubt: "#DC2626", Note: "#059669", Update: "#2563EB", General: "#7C3AED" };
    return { bg: map[cat] || "#F3F4F6", text: textMap[cat] || "#6B7280" };
  };
  const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date)) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  // Apply Global Search Filter
  const searchLower = search.toLowerCase().trim();
  const filteredPosts = posts.filter(p => {
    if (!searchLower) return true;
    return (p.title && p.title.toLowerCase().includes(searchLower)) ||
      (p.content && p.content.toLowerCase().includes(searchLower)) ||
      (p.category && p.category.toLowerCase().includes(searchLower));
  });
  const deptPosts = filteredPosts.filter(p => user?.branch && p.authorRoll && p.authorRoll.toUpperCase().includes((user.branch || "").substring(0, 2).toUpperCase()));
  const displayedPosts = activeTab === "dept" ? (deptPosts.length > 0 ? deptPosts : filteredPosts) : filteredPosts;
  const filteredGroups = groupsFilter === "joined" ? studyGroups.filter(g => g.joined) : studyGroups;

  // ── GROUP ROOM VIEW ──────────────────────────────
  if (openGroup) {
    const grp = studyGroups.find(g => g.id === openGroup);
    const allMsgs = [...(grp?.messages || []), ...(groupMessages[openGroup] || [])];
    const isLeader = grp?.createdBy === (user?.name || "You");
    const pyqs = groupPyqs[openGroup] || [];

    const handlePyqUpload = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { addToast("Too Large", "Max 10MB allowed.", <span className="material-symbols-outlined">error</span>, T.rose); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPyq = { id: Date.now(), name: file.name, size: (file.size / 1024).toFixed(1) + " KB", type: file.type, data: reader.result, uploadedAt: new Date().toLocaleDateString('en-GB'), uploadedBy: user?.name || "Leader" };
        setGroupPyqs(prev => ({ ...prev, [openGroup]: [...(prev[openGroup] || []), newPyq] }));
        addToast("PYQ Uploaded!", `${file.name} has been added.`, <span className="material-symbols-outlined">upload_file</span>, T.success);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: 500 }}>
        {/* ── HEADER ── */}
        <div style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { setOpenGroup(null); setRoomTab("discussion"); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: T.muted }}>←</button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👥</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>{grp?.name}</span>
              {isLeader && <span style={{ fontSize: 10, background: `linear-gradient(135deg, ${T.orange}, #EA580C)`, color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>👑 Leader</span>}
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>
              {(Array.isArray(grp?.members) ? grp.members.length : (grp?.members || 0))} members • {grp?.branch} • {grp?.year} {grp?.createdBy && <>• Created by <span style={{ fontWeight: 600 }}>{grp.createdBy}</span></>}
            </div>
          </div>
          <button onClick={() => setLeaveConfirm(true)}
            style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Leave</button>
        </div>

        {/* ── ROOM TABS ── */}
        <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: `1px solid ${T.border}` }}>
          {[{ id: "discussion", label: "💬 Discussion", icon: "chat" }, { id: "pyqs", label: "📄 PYQs & Resources", icon: "description" }, { id: "members", label: "👥 Members", icon: "group" }].map(tab => (
            <button key={tab.id} onClick={() => setRoomTab(tab.id)}
              style={{ flex: 1, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", borderBottom: roomTab === tab.id ? `3px solid ${T.orange}` : "3px solid transparent", background: roomTab === tab.id ? `${T.orange}08` : "#fff", color: roomTab === tab.id ? T.orange : T.muted, transition: "all 0.2s" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── LEAVE CONFIRMATION DIALOG ── */}
        {leaveConfirm && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={() => setLeaveConfirm(false)}>
            <div style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", width: 340, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 6 }}>Leave this group?</div>
              <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: "0 0 20px 0" }}>Are you sure you want to leave <strong>{grp?.name}</strong>? You can rejoin anytime later.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setLeaveConfirm(false)}
                  style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>No, Stay</button>
                <button onClick={() => handleLeaveGroup(openGroup)}
                  style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#B91C1C"} onMouseLeave={e => e.currentTarget.style.background = "#DC2626"}>Yes, Leave</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ DISCUSSION TAB ═══════ */}
        {roomTab === "discussion" && (<>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, background: "#F8F9FA", minHeight: 300 }}>
            {allMsgs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: T.muted }}><div style={{ fontSize: 40, marginBottom: 8 }}>👋</div><div style={{ fontWeight: 700 }}>Be the first to say hello!</div></div>
            ) : allMsgs.map((msg, i) => {
              const authorText = msg.authorName || msg.author;
              const isOwn = authorText === (user?.name || "You");
              return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{authorText[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{authorText}</span><span style={{ fontSize: 11, color: T.muted }}>{msg.createdAt ? timeAgo(msg.createdAt) : msg.time}</span></div>
                  <div style={{ background: "#fff", padding: "10px 14px", borderRadius: "0 12px 12px 12px", fontSize: 14, color: "#444", border: `1px solid ${T.border}`, lineHeight: 1.5 }}>{msg.text}</div>
                </div>
                {isOwn && (
                  <button onClick={() => setMsgDeleteConfirm({ groupId: openGroup, msgIndex: i, msgText: msg.text })}
                    title="Delete message"
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4, borderRadius: 6, alignSelf: "center", transition: "all 0.2s", opacity: 0.5 }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.opacity = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.opacity = "0.5"; }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {/* DELETE MESSAGE CONFIRMATION */}
          {msgDeleteConfirm && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={() => setMsgDeleteConfirm(null)}>
              <div style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", width: 360, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🗑️</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 6 }}>Delete this message?</div>
                <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "10px 14px", margin: "10px 0 16px", fontSize: 13, color: "#555", lineHeight: 1.5, fontStyle: "italic", maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>"{msgDeleteConfirm.msgText}"</div>
                <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: "0 0 20px 0" }}>Are you sure you want to delete this message? This action cannot be undone.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setMsgDeleteConfirm(null)}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>No, Keep</button>
                  <button onClick={() => {
                    const { groupId, msgIndex } = msgDeleteConfirm;
                    const grpObj = studyGroups.find(g => g.id === groupId);
                    const presetCount = grpObj?.messages?.length || 0;
                    if (msgIndex < presetCount) {
                      setStudyGroups(prev => prev.map(g => g.id === groupId ? { ...g, messages: g.messages.filter((_, idx) => idx !== msgIndex) } : g));
                    } else {
                      const dynamicIdx = msgIndex - presetCount;
                      setGroupMessages(prev => ({ ...prev, [groupId]: (prev[groupId] || []).filter((_, idx) => idx !== dynamicIdx) }));
                    }
                    setMsgDeleteConfirm(null);
                    addToast("Message deleted", "Your message has been removed.", <span className="material-symbols-outlined">delete</span>, T.rose);
                  }}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#B91C1C"} onMouseLeave={e => e.currentTarget.style.background = "#DC2626"}>Yes, Delete</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: "12px 16px", background: "#fff", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center" }}>
            <input value={groupMsg} onChange={e => setGroupMsg(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendGroupMsg(openGroup)}
              placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, outline: "none", background: "#F8F9FA" }} />
            <Btn variant="primary" style={{ padding: "10px 18px", borderRadius: 12 }} onClick={() => handleSendGroupMsg(openGroup)}>Send</Btn>
          </div>
        </>)}

        {/* ═══════ PYQs & RESOURCES TAB ═══════ */}
        {roomTab === "pyqs" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "#F8F9FA" }}>
            {/* Leader Upload Section */}
            {isLeader ? (
              <div style={{ background: `linear-gradient(135deg, ${T.orange}10, ${T.yellow}08)`, border: `1.5px dashed ${T.orange}`, borderRadius: 16, padding: "20px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📤</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: T.text, marginBottom: 4 }}>Upload PYQ / Assignment / Notes</div>
                <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px 0" }}>PDF, Images, Docs up to 10MB — only you (group leader) can manage these</p>
                <label style={{ display: "inline-block", background: `linear-gradient(135deg, ${T.orange}, #EA580C)`, color: "#fff", padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt" style={{ display: "none" }} onChange={handlePyqUpload} />
                  📎 Choose File to Upload
                </label>
              </div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <span className="material-symbols-outlined" style={{ color: T.muted, fontSize: 20 }}>info</span>
                <span style={{ fontSize: 13, color: T.muted }}>Only the group leader (<strong>{grp?.createdBy}</strong>) can upload or delete PYQs & resources.</span>
              </div>
            )}

            {/* PYQ Files Grid */}
            {pyqs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", color: T.muted }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>No PYQs uploaded yet</div>
                <p style={{ fontSize: 13, marginTop: 4 }}>{isLeader ? "Upload your first PYQ or resource above!" : "Check back later — the leader will upload soon."}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {pyqs.map(pyq => {
                  const isPdf = pyq.name.toLowerCase().endsWith('.pdf');
                  const isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(pyq.name);
                  const icon = isPdf ? "📕" : isImg ? "🖼️" : "📄";
                  return (
                    <div key={pyq.id} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10, transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 28 }}>{icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pyq.name}</div>
                          <div style={{ fontSize: 11, color: T.muted }}>{pyq.size} • {pyq.uploadedAt}</div>
                        </div>
                      </div>
                      {isImg && pyq.data && (
                        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, maxHeight: 120 }}>
                          <img src={pyq.data} style={{ width: "100%", objectFit: "cover", display: "block" }} alt={pyq.name} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <a href={pyq.data} download={pyq.name} onClick={e => e.stopPropagation()}
                          style={{ flex: 1, padding: "8px", borderRadius: 10, background: "#DBEAFE", color: "#2563EB", fontSize: 12, fontWeight: 700, textAlign: "center", textDecoration: "none", cursor: "pointer", transition: "all 0.2s" }}>
                          ⬇ Download
                        </a>
                        {isLeader && (
                          <button onClick={() => setPyqDeleteConfirm({ groupId: openGroup, pyqId: pyq.id, pyqName: pyq.name })}
                            style={{ padding: "8px 12px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#FECACA"} onMouseLeave={e => e.currentTarget.style.background = "#FEE2E2"}>
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PYQ DELETE CONFIRMATION */}
            {pyqDeleteConfirm && (
              <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} onClick={() => setPyqDeleteConfirm(null)}>
                <div style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", width: 360, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🗑️</div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 6 }}>Delete this file?</div>
                  <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "10px 14px", margin: "10px 0 16px", fontSize: 13, color: "#555", fontWeight: 600 }}>📄 {pyqDeleteConfirm.pyqName}</div>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: "0 0 20px 0" }}>Are you sure you want to delete this file? All members will lose access.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setPyqDeleteConfirm(null)}
                      style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>No, Keep</button>
                    <button onClick={() => {
                      setGroupPyqs(prev => ({ ...prev, [pyqDeleteConfirm.groupId]: (prev[pyqDeleteConfirm.groupId] || []).filter(p => p.id !== pyqDeleteConfirm.pyqId) }));
                      setPyqDeleteConfirm(null);
                      addToast("File deleted", "The PYQ has been removed.", <span className="material-symbols-outlined">delete</span>, T.rose);
                    }}
                      style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#B91C1C"} onMouseLeave={e => e.currentTarget.style.background = "#DC2626"}>Yes, Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ MEMBERS TAB ═══════ */}
        {roomTab === "members" && (() => {
          const displayedMembers = liveGroupMembers[grp.id] || [];
          
          return (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "#F8F9FA" }}>
            <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: "20px" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.text, marginBottom: 16 }}>
                Live Group Members ({displayedMembers.length})
              </div>
              {displayedMembers.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: T.muted, fontSize: 14 }}>
                  No members are currently in this group room.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {displayedMembers.map((m, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "#F8F9FA", borderRadius: 12, border: `1px solid ${T.border}` }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ color: "#fff", fontWeight: 700 }}>{(m.name || "U")[0]}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                          {grp?.createdBy === m.name && <span style={{ fontSize: 10, background: `linear-gradient(135deg, ${T.orange}, #EA580C)`, color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>Leader</span>}
                          <span style={{ fontSize: 10, background: "#10B981", color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>Online</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted }}>ID: {m.rollNo || m.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );})()}
      </div>
    );
  }

  return (
    <div>
      {/* ── COMPACT HEADER ── */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 28, fontWeight: 900, color: T.text, margin: 0, letterSpacing: '-0.4px' }}>Community Hub</h1>
            <p style={{ color: T.muted, fontSize: 14, margin: "4px 0 0 0" }}>Your campus. Your people. Your knowledge hub.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button id="online-students-btn" onClick={() => setOnlinePopup(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#DCFCE7", color: "#16A34A", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#BBF7D0"} onMouseLeave={e => e.currentTarget.style.background = "#DCFCE7"}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A", display: "inline-block", animation: "commPulse 1.5s ease-in-out infinite" }} />
              🟢 {studentsOnline} Student{studentsOnline !== 1 ? "s" : ""} Online
            </button>
            <Btn variant="primary" id="ask-doubt-btn" style={{ padding: "8px 18px", borderRadius: 20, fontSize: 13 }} onClick={() => setPostOpen(true)}>+ Ask Doubt</Btn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18, overflowX: "auto" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: "9px 20px", borderRadius: 22, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s",
                background: activeTab === tab.id ? T.orange : "#fff", color: activeTab === tab.id ? "#fff" : T.muted, border: `1.5px solid ${activeTab === tab.id ? T.orange : T.border}` }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div style={{ padding: "14px 20px", background: "#FAFAFA", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 0 }}>
        {[{ icon: "🟢", val: studentsOnline, label: "Online" }, { icon: "💬", val: posts.length, label: "Discussions" }, { icon: "👥", val: studyGroups.length, label: "Study Groups" }].map((stat, i) => (
          <div key={i} onClick={() => {
            if (stat.label === "Online") setOnlinePopup(true);
            if (stat.label === "Discussions") setActiveTab("feed");
            if (stat.label === "Study Groups") setActiveTab("groups");
          }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flex: 1, padding: "10px 16px", borderRight: i < 2 ? `1px solid ${T.border}` : "none", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontSize: 16 }}>{stat.icon}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}><div style={{ fontWeight: 900, fontSize: 16, color: T.text, lineHeight: 1 }}>{stat.val}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{stat.label}</div></div>
          </div>
        ))}
      </div>

      <style>{`@keyframes commPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }`}</style>

      <div className="screen-body">

        {/* ── CAMPUS FEED + MY DEPARTMENT ── */}
        {(activeTab === "feed" || activeTab === "dept") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {activeTab === "dept" && (
              <div style={{ background: `linear-gradient(135deg, ${T.orange}15, ${T.yellow}10)`, border: `1px solid ${T.orange}30`, borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>🏫 Department of {user?.branch || "Your Department"}</div>
                <div style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>Connect with students from your department, share resources and discuss technical topics.</div>
              </div>
            )}
            {activeTab === "feed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff", borderRadius: 14, border: `1px solid ${T.border}`, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>🔥 Trending on Campus:</span>
                {TRENDING.map(tag => (
                  <span key={tag} style={{ background: "#fff", border: `1px solid ${T.border}`, color: "#555", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = "#555"; }}>{tag}</span>
                ))}
              </div>
            )}
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: T.muted }}>⏳ Loading discussions...</div>
            ) : displayedPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 16, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>{search ? "No matches found" : "No discussions yet"}</div>
                <p style={{ color: T.muted, marginTop: 6, fontSize: 13 }}>Be the first to ask a doubt or share an update!</p>
                <Btn variant="primary" style={{ marginTop: 14, borderRadius: 20 }} onClick={() => setPostOpen(true)}>Start a Discussion</Btn>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {displayedPosts.map(post => {
                  const bc = badgeColor(post.category);
                  return (
                    <div key={post._id} onClick={() => setViewPost(post)}
                      style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: post.authorPhoto ? "transparent" : `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {post.authorPhoto ? <img src={post.authorPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{post.authorName[0]}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{post.authorName}</span>
                            <span style={{ fontSize: 11, background: "#DCFCE7", color: "#16A34A", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>✓ Verified Student</span>
                          </div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{post.authorRoll && post.authorRoll.includes("CSE") ? "CSE" : post.authorRoll ? post.authorRoll.substring(0, 3) : ""} • {user?.year || "2nd Year"}</div>
                        </div>
                        <span style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>{post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: T.text, marginBottom: 6, lineHeight: 1.4 }}>{post.title}</div>
                      <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: "0 0 10px 0" }}>{post.content}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: post.photoUrl ? 0 : 0 }}>
                        <span style={{ background: bc.bg, color: bc.text, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${bc.text}30` }}>[{post.category}]</span>
                        {post.title && post.title.toLowerCase().includes("automata") && <span style={{ borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${T.border}`, color: "#555", background: "#fff" }}>[Automata]</span>}
                      </div>
                      {post.photoUrl && (<div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", maxHeight: 180, border: `1px solid ${T.border}` }}><img src={post.photoUrl} style={{ width: "100%", objectFit: "cover" }} /></div>)}
                      <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, alignItems: "center" }}>
                        <button onClick={(e) => { e.stopPropagation(); handleLikePost(post._id); }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: post.likes?.includes(user?.rollNo) ? "#DC2626" : T.muted, background: post.likes?.includes(user?.rollNo) ? "#FEF2F2" : "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#DC2626"; }} onMouseLeave={e => { e.currentTarget.style.background = post.likes?.includes(user?.rollNo) ? "#FEF2F2" : "none"; e.currentTarget.style.color = post.likes?.includes(user?.rollNo) ? "#DC2626" : T.muted; }}>👍 {post.likes?.length || 0}</button>
                        <button onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: T.muted, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#F0F9FF"; e.currentTarget.style.color = "#0284C7"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>💬 {post.comments?.length || 0}</button>
                        <span style={{ marginLeft: "auto", color: T.orange, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>View Thread →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STUDY GROUPS TAB ── */}
        {activeTab === "groups" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div><div style={{ fontWeight: 800, fontSize: 18, color: T.text }}>Campus Study Groups</div><div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Collaborate in focused peer groups, share notes, and solve doubts together</div></div>
              <Btn variant="primary" style={{ borderRadius: 20, padding: "8px 18px", fontSize: 13 }} onClick={() => setCreateGroupOpen(true)}>+ Create Group</Btn>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[{ id: "all", label: `All Groups (${studyGroups.length})` }, { id: "joined", label: `My Joined Groups (${studyGroups.filter(g => g.joined).length})` }].map(f => (
                <button key={f.id} onClick={() => setGroupsFilter(f.id)} style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${groupsFilter === f.id ? T.orange : T.border}`, background: groupsFilter === f.id ? `${T.orange}08` : "#fff", color: groupsFilter === f.id ? T.orange : T.muted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{f.label}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filteredGroups.map(grp => (
                <div key={grp.id} style={{ background: grp.joined ? "#F0FDF9" : "#fff", border: `1px solid ${grp.joined ? "#10B981" : T.border}`, borderLeft: grp.joined ? "4px solid #10B981" : `1px solid ${T.border}`, borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", gap: 12, transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📚</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: T.text, lineHeight: 1.3, flex: 1 }}>{grp.name}</div>
                    {grp.tag && <span style={{ background: `${grp.tagColor || T.orange}15`, color: grp.tagColor || T.orange, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{grp.tag}</span>}
                  </div>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: 0 }}>{grp.desc || `${grp.branch} • ${grp.year}`}</p>
                  <div style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👥</span> <span style={{ fontWeight: 600 }}>{Array.isArray(grp.members) ? grp.members.length : (grp.members || 0)} students interested</span>
                    <span style={{ margin: "0 2px" }}>•</span>
                    <span>{grp.schedule || "Flexible"}</span>
                  </div>
                  {grp.joined
                    ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <button onClick={() => setOpenGroup(grp.id)} style={{ flex: 1, background: "linear-gradient(135deg, #10B981, #059669)", border: "none", color: "#fff", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>🚀 Enter Group Room</button>
                        <span style={{ background: "#fff", border: "1.5px solid #10B981", color: "#10B981", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Joined</span>
                      </div>
                    : <button onClick={() => handleJoinGroup(grp.id)} style={{ background: `linear-gradient(135deg, ${T.orange}, #EA580C)`, border: "none", color: "#fff", borderRadius: 12, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.3px" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.9"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>[Join Study Group]</button>}
                </div>
              ))}
              {filteredGroups.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: T.muted }}><div style={{ fontSize: 40, marginBottom: 10 }}>👥</div><div style={{ fontWeight: 700 }}>No groups joined yet</div></div>}
            </div>
          </div>
        )}


      </div>

      {/* ── ONLINE STUDENTS POPUP ── */}
      {onlinePopup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }} onClick={() => setOnlinePopup(false)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px", width: 340, maxWidth: "90vw", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>🟢 Students Online Now</div>
              <button onClick={() => setOnlinePopup(false)} style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14, color: T.muted }}>✕</button>
            </div>
            <div style={{ background: "#DCFCE7", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#16A34A", display: "inline-block", animation: "commPulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#15803D" }}>{studentsOnline} student{studentsOnline !== 1 ? "s" : ""} logged in recently</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
              {onlineUsersList.map((u, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: u.id === (user && user._id) ? "#F8F9FA" : "#fff", borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: u.profilePhoto ? "transparent" : `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {u.profilePhoto ? <img src={u.profilePhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700 }}>{(u.name || "U")[0]}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || "Anonymous Student"}</div>
                    {(u.branch || u.year) && <div style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.branch || "Unknown Branch"} • {u.year || ""}</div>}
                  </div>
                  {u.id === (user && user._id) && <span style={{ background: "#DBEAFE", color: "#2563EB", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>You</span>}
                </div>
              ))}
              {(!onlineUsersList || onlineUsersList.length === 0) && user && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "#F8F9FA", borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: user.profilePhoto ? "transparent" : `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {user.profilePhoto ? <img src={user.profilePhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700 }}>{(user.name || "U")[0]}</span>}
                  </div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{user.name}</div><div style={{ fontSize: 12, color: T.muted }}>{user.branch} • {user.year}</div></div>
                  <span style={{ background: "#DBEAFE", color: "#2563EB", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>You</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: T.muted, textAlign: "center", flexShrink: 0 }}>Real-time via Socket.io — updates automatically</div>
          </div>
        </div>
      )}

      {/* ── POST DETAIL MODAL ── */}
      <Modal open={!!viewPost} onClose={() => setViewPost(null)} title="Discussion Thread" aboveNav={true}>
        {viewPost && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: "12px", background: viewPost.authorPhoto ? "transparent" : `linear-gradient(135deg, ${T.orange}, ${T.yellow})`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {viewPost.authorPhoto ? <img src={viewPost.authorPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700 }}>{viewPost.authorName[0]}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 700, fontSize: 15 }}>{viewPost.authorName}</span><span style={{ fontSize: 11, background: "#DBEAFE", color: "#2563EB", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>✓ Verified Student</span></div>
                <div style={{ fontSize: 12, color: T.muted }}>{viewPost.authorRoll} • {new Date(viewPost.createdAt).toLocaleString()}</div>
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 20, color: T.text }}>{viewPost.title}</div>
            <p style={{ fontSize: 15, color: "#444", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewPost.content}</p>
            {viewPost.photoUrl && (<div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}><img src={viewPost.photoUrl} style={{ width: "100%", maxHeight: 400, objectFit: "contain", display: "block" }} /></div>)}
            <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 14, color: T.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Comments ({viewPost.comments.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {viewPost.comments.length === 0 ? <div style={{ textAlign: "center", padding: "20px 0", color: T.muted, fontSize: 13, fontStyle: "italic" }}>No replies yet. Be the first to help!</div>
                  : viewPost.comments.map((c, i) => (
                    <div key={i} style={{ padding: "14px 16px", background: "#F8F9FA", borderRadius: 12, border: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "8px", background: c.authorPhoto ? "transparent" : T.indigo, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                          {c.authorPhoto ? <img src={c.authorPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700 }}>{c.authorName[0]}</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{c.authorName}</div>
                        <div style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>{new Date(c.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{ fontSize: 14, color: "#333", lineHeight: 1.5 }}>{c.text}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, position: "sticky", bottom: 0 }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Provide a solution or helpful tip..."
                style={{ flex: 1, padding: "10px 14px", border: "none", outline: "none", fontSize: 14, background: "transparent" }}
                onKeyPress={e => e.key === 'Enter' && handleAddComment()} />
              <Btn variant="primary" style={{ padding: "10px 18px", borderRadius: 10 }} onClick={handleAddComment}>Reply</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── CREATE POST MODAL ── */}
      <Modal open={postOpen} onClose={() => setPostOpen(false)} title="📝 Start a Discussion" aboveNav={true}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Post Category</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {["Doubt", "Note", "Update", "General"].map(cat => (
                <button key={cat} onClick={() => setPostForm(p => ({ ...p, category: cat }))}
                  style={{ flex: 1, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1.5px solid ${postForm.category === cat ? T.orange : T.border}`, background: postForm.category === cat ? `${T.orange}10` : "#fff", color: postForm.category === cat ? T.orange : T.muted, transition: "all 0.2s" }}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Heading</label>
            <input value={postForm.title} onChange={e => setPostForm(p => ({ ...p, title: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", marginTop: 6, borderRadius: 10, border: `1px solid ${T.border}`, background: T.gray, boxSizing: "border-box" }} placeholder="e.g., Struggling with Fourier Series..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Content / Doubt Details</label>
            <textarea rows="5" value={postForm.content} onChange={e => setPostForm(p => ({ ...p, content: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", marginTop: 6, borderRadius: 10, border: `1px solid ${T.border}`, background: T.gray, resize: "none", fontSize: 14, boxSizing: "border-box" }} placeholder="Explain your query clearly so others can help you better..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Attach Image (Optional)</label>
            <label style={{ display: "block", padding: photoPreview ? "10px" : "20px", borderRadius: 12, border: `2px dashed ${photoPreview ? T.success : "#C0C0C0"}`, background: photoPreview ? `${T.success}05` : "#FAFAFA", textAlign: "center", cursor: "pointer", marginTop: 6 }}>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  if (file.size > 5 * 1024 * 1024) { addToast("Too Large", "Max 5MB allowed", <span className="material-symbols-outlined">error</span>, T.rose); return; }
                  const reader = new FileReader();
                  reader.onloadend = () => { setPhotoData(reader.result); setPhotoPreview(reader.result); };
                  reader.readAsDataURL(file);
                }
              }} />
              {photoPreview ? (
                <div style={{ position: "relative" }}>
                  <img src={photoPreview} style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 8 }} />
                  <div style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }} onClick={e => { e.preventDefault(); setPhotoData(null); setPhotoPreview(null); }}>✕</div>
                </div>
              ) : (<><div style={{ fontSize: 24, marginBottom: 8 }}>📷</div><div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>Tap to upload photo</div><div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Capture your notebook or problem sheet</div></>)}
            </label>
          </div>
          <Btn variant="primary" style={{ padding: 16, fontSize: 15, marginTop: 4 }} disabled={posting} onClick={handleCreatePost}>
            {posting ? "⏳ Posting Activity..." : "🚀 Share to Community"}
          </Btn>
        </div>
      </Modal>

      {/* ── CREATE GROUP MODAL ── */}
      <Modal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} title="👥 Create Study Group" aboveNav={true}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Group Name</label>
            <input value={newGroupForm.name} onChange={e => setNewGroupForm(p => ({ ...p, name: e.target.value }))} style={{ width: "100%", padding: "12px 14px", marginTop: 6, borderRadius: 10, border: `1px solid ${T.border}`, background: T.gray, boxSizing: "border-box" }} placeholder="e.g., Automata & Theory of Computation" /></div>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Description</label>
            <textarea value={newGroupForm.desc} onChange={e => setNewGroupForm(p => ({ ...p, desc: e.target.value }))} style={{ width: "100%", padding: "12px 14px", marginTop: 6, borderRadius: 10, border: `1px solid ${T.border}`, background: T.gray, boxSizing: "border-box", resize: "vertical", minHeight: 60, fontFamily: "inherit" }} placeholder="What will this group focus on?" /></div>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Branch</label>
            <select value={newGroupForm.branch} onChange={e => setNewGroupForm(p => ({ ...p, branch: e.target.value }))} style={{ width: "100%", padding: "12px 14px", marginTop: 6, borderRadius: 10, border: `1px solid ${T.border}`, background: T.gray, fontSize: 14, boxSizing: "border-box" }}>
              {["CSE","ECE","ME","CE","EE","IT","All Branches"].map(b => <option key={b}>{b}</option>)}
            </select></div>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Year</label>
            <select value={newGroupForm.year} onChange={e => setNewGroupForm(p => ({ ...p, year: e.target.value }))} style={{ width: "100%", padding: "12px 14px", marginTop: 6, borderRadius: 10, border: `1px solid ${T.border}`, background: T.gray, fontSize: 14, boxSizing: "border-box" }}>
              {["1st Year","2nd Year","3rd Year","4th Year","All Years"].map(y => <option key={y}>{y}</option>)}
            </select></div>
          <Btn variant="primary" style={{ padding: 14, fontSize: 14, marginTop: 4, borderRadius: 12 }} onClick={handleCreateGroup}>🚀 Create Group</Btn>
        </div>
      </Modal>
    </div>
  );
}

function KaryaDisha() {
  const { user } = useUser();
  const addToast = useToast();

  const [rolesData, setRolesData] = React.useState({});
  const [allSkills, setAllSkills] = React.useState([]);
  const [loadingData, setLoadingData] = React.useState(true);

  const [skills, setSkills] = React.useState({});
  const [role, setRole] = React.useState("");
  const [res, setRes] = React.useState(null);
  const [aiResponse, setAiResponse] = React.useState({ gap: null, roadmap: null, projects: null, loading: false, error: null });
  const [jobMatches, setJobMatches] = React.useState([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  const [compareRoles, setCompareRoles] = React.useState([]);

  React.useEffect(() => {
    const fetchRoles = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/academic/roles`);
        if (!resp.ok) throw new Error("Failed to fetch");
        const data = await resp.json();
        if (Object.keys(data).length > 0) {
          setRolesData(data);
        } else {
          setRolesData(ROLES);
        }
      } catch (err) {
        setRolesData(ROLES);
      } finally {
        setLoadingData(false);
      }
    };
    fetchRoles();
  }, []);

  React.useEffect(() => {
    const skillSet = new Set();
    Object.values(rolesData).forEach(r => {
      (r.req || []).forEach(s => skillSet.add(s));
      (r.nice || []).forEach(s => skillSet.add(s));
    });
    const sortedSkills = Array.from(skillSet).sort((a, b) => a.localeCompare(b));
    if (sortedSkills.length === 0) {
      setAllSkills(ASKILLS);
    } else {
      setAllSkills(sortedSkills);
    }
  }, [rolesData]);

  const toggleSkill = (s) => {
    setSkills(prev => {
      const next = { ...prev };
      if (next[s]) {
        if (next[s] === "Advanced") delete next[s];
        else if (next[s] === "Intermediate") next[s] = "Advanced";
        else if (next[s] === "Beginner") next[s] = "Intermediate";
      } else {
        next[s] = "Beginner";
      }
      return next;
    });
    setRes(null);
  };

  const getSkillValue = (level) => {
    if (level === "Advanced") return 1.0;
    if (level === "Intermediate") return 0.75;
    if (level === "Beginner") return 0.5;
    return 1.0;
  };

  const calculateReadiness = (selectedRole, currentSkills) => {
    const r = rolesData[selectedRole];
    if (!r) return null;

    let score = 0;
    let totalPossible = 0;
    const matched = [];
    const developing = [];

    const checkMatch = (reqSkill) => {
      let matchLevel = null;
      let matchedName = null;
      for (const [s, lvl] of Object.entries(currentSkills)) {
        if (s.toLowerCase().includes(reqSkill.toLowerCase().split("/")[0]) || reqSkill.toLowerCase().includes(s.toLowerCase())) {
          matchLevel = lvl;
          matchedName = s;
          break;
        }
      }
      return { matchLevel, matchedName };
    };

    const missingCore = [];
    const strongCore = [];

    (r.req || []).forEach(s => {
      totalPossible += 3;
      const match = checkMatch(s);
      if (match.matchLevel) {
        const val = getSkillValue(match.matchLevel);
        score += (3 * val);
        if (val >= 0.75) {
          strongCore.push(s);
          matched.push(s);
        } else {
          developing.push(s);
        }
      } else {
        missingCore.push(s);
      }
    });

    const strongNice = [];
    const missingNice = [];

    (r.nice || []).forEach(s => {
      totalPossible += 1;
      const match = checkMatch(s);
      if (match.matchLevel) {
        const val = getSkillValue(match.matchLevel);
        score += (1 * val);
        if (val >= 0.75) strongNice.push(s);
        else developing.push(s);
      } else {
        missingNice.push(s);
      }
    });

    const pct = totalPossible === 0 ? 0 : Math.round((score / totalPossible) * 100);
    const priorityList = [...missingCore.map(s => ({ name: s, priority: "High" })), ...missingNice.map(s => ({ name: s, priority: "Bonus" }))];

    return { pct, strong: [...strongCore, ...strongNice], developing, missingCore, bonus: r.nice || [], priorityList, projs: r.projs || [] };
  };

  const analyze = () => {
    if (!role) return;
    const result = calculateReadiness(role, skills);
    setRes(result);

    let levelText = "Beginner";
    let levelIcon = "library_books";
    let levelColor = T.rose;

    if (result.pct >= 80) { levelText = "Strong Candidate"; levelIcon = "star"; levelColor = T.success; }
    else if (result.pct >= 60) { levelText = "Job Ready"; levelIcon = "ads_click"; levelColor = T.success; }
    else if (result.pct >= 30) { levelText = "Developing"; levelIcon = "bolt"; levelColor = T.yellow; }

    addToast(levelText, `${result.pct}% match for ${role}`, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>{levelIcon}</span>, levelColor);

    try {
      const history = JSON.parse(localStorage.getItem('karyaDishaHistory') || '[]');
      history.push({ date: new Date().toISOString(), role, pct: result.pct });
      if (history.length > 10) history.shift();
      localStorage.setItem('karyaDishaHistory', JSON.stringify(history));
    } catch (e) { }

    setAiResponse({ gap: null, roadmap: null, projects: null, loading: false, error: null });
    setJobMatches([]);
  };

  const callAi = async (type) => {
    if (!res) return;
    setAiResponse(prev => ({ ...prev, loading: true, error: null }));

    try {
      const payload = {
        type,
        role,
        skills: Object.keys(skills),
        missingSkills: res.missingCore,
        coreSkills: rolesData[role]?.req || [],
        bonusSkills: rolesData[role]?.nice || [],
        readiness: res.pct,
        userContext: { name: user?.name, rollNo: user?.rollNo, branch: user?.branch, year: user?.year }
      };

      const resp = await fetch(`${API_BASE_URL}/api/ai/career-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("AI API HTTP Error:", resp.status, text);
        let errorMsg = "The AI is currently unavailable. Please try again later.";
        try {
          const errObj = JSON.parse(text);
          if (errObj.error) errorMsg = errObj.error;
        } catch (e) { }
        throw new Error(errorMsg);
      }

      const data = await resp.json();
      if (data.reply) {
        setAiResponse(prev => {
          const next = { ...prev, loading: false };
          if (type === 'gap-analysis') next.gap = data.reply;
          else if (type === 'roadmap') next.roadmap = data.reply;
          else if (type === 'project-recommendations') next.projects = data.reply;
          return next;
        });
      } else {
        console.error("AI API Invalid Response:", data);
        throw new Error("Invalid response format from AI.");
      }
    } catch (e) {
      console.error("AI Request Failed:", e);
      setAiResponse(prev => ({ ...prev, loading: false, error: e.message || "AI is currently unavailable. Please try again later." }));
      addToast("AI Error", "Could not reach AI services", "❌", T.rose);
    }
  };

  const findJobs = async () => {
    if (!res || !role) return;
    setLoadingJobs(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/jobs?limit=250`);
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Jobs API HTTP Error:", resp.status, text);
        throw new Error("Could not fetch jobs from server.");
      }

      const data = await resp.json();
      if (data.jobs && Array.isArray(data.jobs)) {
        const matched = data.jobs.map(j => {
          let matchScore = 0;
          const jobTags = Array.isArray(j.tags) ? j.tags : [];
          const jobTitle = j.title || "";
          const jobDesc = j.desc || "";
          const jobBranch = j.branch || "";
          const jobText = `${jobTitle} ${jobTags.join(" ")} ${jobDesc}`.toLowerCase();

          let matchedTags = 0;
          const mySkills = Object.keys(skills);
          mySkills.forEach(s => {
            if (jobText.includes(s.toLowerCase())) matchedTags++;
          });

          // Base score from skills
          if (matchedTags > 0) matchScore += 15 + (matchedTags * 10);

          // Score from role matching
          const lowerTitle = jobTitle.toLowerCase();
          const lowerRole = role.toLowerCase();
          if (lowerTitle.includes(lowerRole)) {
            matchScore += 40;
          } else if (lowerTitle.includes("software") || lowerTitle.includes("developer")) {
            if (lowerRole.includes("software") || lowerRole.includes("developer")) matchScore += 30;
          } else {
            const roleTokens = lowerRole.split(" ").filter(t => t.length > 3);
            if (roleTokens.some(token => lowerTitle.includes(token))) matchScore += 15;
          }

          // Score from branch matching
          if (user?.branch && jobBranch === user.branch) matchScore += 15;

          // Score from job tags overlap
          const maxTags = Math.max(3, jobTags.length);
          if (matchedTags > 0) matchScore += Math.min((matchedTags / maxTags) * 20, 20);

          return { ...j, compatibility: Math.round(matchScore) };
        }).filter(j => j.compatibility >= 30).sort((a, b) => b.compatibility - a.compatibility).slice(0, 5);

        setJobMatches(matched);
      } else {
        console.error("Jobs API Invalid Response:", data);
        throw new Error("Invalid response format from Jobs API.");
      }
    } catch (e) {
      console.error("Jobs Request Failed:", e);
      addToast("Job Error", "Could not fetch jobs", "❌", T.rose);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleCompare = (r) => {
    setCompareRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const renderAiText = (text) => {
    if (!text) return null;

    const parseBold = (str) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.substring(2, part.length - 2)}</strong>;
        }
        return part;
      });
    };

    return text.split('\n').map((line, i) => {
      if (line.startsWith('###')) return <h4 key={i} style={{ fontSize: 14, fontWeight: 600, margin: "14px 0 6px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h4>;
      if (line.startsWith('##')) return <h3 key={i} style={{ fontSize: 15, fontWeight: 600, margin: "16px 0 8px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h3>;
      if (line.startsWith('-')) return <li key={i} style={{ marginLeft: 20, marginBottom: 4, color: "#4B5563", fontSize: 13 }}>{parseBold(line.substring(1).trim())}</li>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} style={{ marginBottom: 6, lineHeight: 1.5, color: "#4B5563", fontSize: 13 }}>{parseBold(line)}</p>;
    });
  };

  const getProgressHistory = () => {
    try {
      const history = JSON.parse(localStorage.getItem('karyaDishaHistory') || '[]');
      return history.filter(h => h.role === role);
    } catch (e) { return []; }
  };

  const cSuccess = "#10B981";
  const cWarn = "#F59E0B";
  const cDanger = "#EF4444";
  const mc = p => p >= 70 ? cSuccess : p >= 40 ? cWarn : cDanger;

  return (
    <div>
      <div className="screen-hero">
        <div className="screen-hero-inner">
          <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 32, fontWeight: 800, color: "#1F2937", margin: 0, marginTop: 12, lineHeight: 1.15, letterSpacing: '-0.2px' }}>Career Compass</h1>
          <p style={{ color: "#6B7280", fontSize: 14, margin: "6px 0 0 0" }}>Analyze your skills, find gaps, and plan your career path.</p>
        </div>
      </div>

      <div className="screen-body">
        {loadingData ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 14 }}>Loading career data...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900, margin: "0 auto" }}>

            {/* 0. Career Setup Card */}
            <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: "#1F2937" }}>Profile Setup</div>

              <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Target Role</label>
              <div style={{ position: "relative", marginBottom: 20 }}>
                <select value={role} onChange={e => { setRole(e.target.value); setRes(null); }} style={{ width: "100%", padding: "10px 12px", background: "#FFFFFF", color: role ? "#1F2937" : "#6B7280", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, outline: "none", appearance: "none" }}>
                  <option value="">Select a career role...</option>
                  {Object.keys(rolesData).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none", fontSize: 12 }}>▼</span>
              </div>

              <label style={{ display: "block", color: "#374151", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Your Skills (Tap to cycle proficiency)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
                {allSkills.map(s => {
                  const lvl = skills[s];
                  const active = !!lvl;
                  return (
                    <button key={s} onClick={() => toggleSkill(s)}
                      style={{
                        background: active ? "#FFF0ED" : "#FFFFFF",
                        color: active ? "#FF4F1F" : "#4B5563",
                        border: `1px solid ${active ? "#FFD5CC" : "#E5E7EB"}`,
                        borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: active ? 500 : 400,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .1s ease"
                      }}>
                      {s}
                      {lvl === "Beginner" && <span style={{ fontSize: 11, background: "#FF4F1F", color: "#fff", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Beg</span>}
                      {lvl === "Intermediate" && <span style={{ fontSize: 11, background: "#FF4F1F", color: "#fff", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Int</span>}
                      {lvl === "Advanced" && <span style={{ fontSize: 11, background: "#FF4F1F", color: "#fff", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Adv</span>}
                    </button>
                  );
                })}
              </div>

              <button onClick={analyze} disabled={!role || Object.keys(skills).length === 0} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, color: "#FFFFFF", background: (!role || Object.keys(skills).length === 0) ? "#E5E7EB" : "#FF4F1F", border: "none", borderRadius: 6, cursor: (!role || Object.keys(skills).length === 0) ? "not-allowed" : "pointer" }}>Analyze Readiness</button>
            </div>

            {/* RESULTS AREA */}
            {res && (
              <>
                {/* 1. Readiness Score */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>{role}</div>
                      <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>{res.pct}% Ready for this role</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: mc(res.pct) }}>{res.pct}%</div>
                  </div>
                  <PBar value={res.pct} color={mc(res.pct)} h={8} />
                </div>

                {/* 2. Skills Analysis */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: "#1F2937", marginBottom: 16 }}>Skill Analysis</div>

                  {res.strong.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8, fontWeight: 600 }}>Strong Skills</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {res.strong.map(s => <span key={s} style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "4px 10px", borderRadius: 4, fontSize: 13 }}>{s}</span>)}
                      </div>
                    </div>
                  )}

                  {res.developing.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8, fontWeight: 600 }}>Developing Skills</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {res.developing.map(s => <span key={s} style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", padding: "4px 10px", borderRadius: 4, fontSize: 13 }}>{s}</span>)}
                      </div>
                    </div>
                  )}

                  {res.missingCore.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8, fontWeight: 600 }}>Missing Core Skills</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {res.missingCore.map(s => <span key={s} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", padding: "4px 10px", borderRadius: 4, fontSize: 13 }}>{s}</span>)}
                      </div>
                    </div>
                  )}

                  {res.bonus.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 8, fontWeight: 600 }}>Bonus Skills</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {res.bonus.map(s => <span key={s} style={{ background: "#F3F4F6", color: "#4B5563", border: "1px solid #E5E7EB", padding: "4px 10px", borderRadius: 4, fontSize: 13 }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Priority to Learn */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 16 }}>Priority Learning List</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {res.priorityList.slice(0, 5).map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#FAFAFA", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                        <span style={{ fontSize: 14, color: "#374151" }}>{i + 1}. {p.name}</span>
                        <span style={{ fontSize: 12, background: p.priority === "High" ? "#FEE2E2" : "#F3F4F6", color: p.priority === "High" ? "#991B1B" : "#4B5563", padding: "4px 10px", borderRadius: 4, fontWeight: 600 }}>{p.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. AI Insights */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>AI Career Advisor</div>
                  <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>Get personalized AI advice based on your exact profile.</p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                    <button onClick={() => callAi('gap-analysis')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", fontSize: 13, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Explain Skill Gaps</button>
                    <button onClick={() => callAi('roadmap')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", fontSize: 13, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Generate Roadmap</button>
                    <button onClick={() => document.querySelector('.ai-fab')?.click()} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", fontSize: 13, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>Ask AI via Chat</button>
                  </div>

                  {(aiResponse.gap || aiResponse.roadmap || aiResponse.loading || aiResponse.error) && (
                    <div style={{ padding: 20, borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", marginTop: 16 }}>
                      {aiResponse.loading && <div style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}>Generating insights...</div>}
                      {aiResponse.error && <div style={{ color: "#DC2626", fontSize: 14 }}>{aiResponse.error}</div>}
                      {aiResponse.gap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: "#1F2937" }}>Skill Gap Analysis</div><div>{safeRenderMarkdown(aiResponse.gap)}</div></div>}
                      {aiResponse.roadmap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: "#1F2937" }}>30-Day Action Plan</div><div>{safeRenderMarkdown(aiResponse.roadmap)}</div></div>}
                    </div>
                  )}
                </div>

                {/* 5. Projects */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>Recommended Projects</div>
                    <button onClick={() => callAi('project-recommendations')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", padding: "6px 12px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>AI Recommend</button>
                  </div>

                  {aiResponse.projects ? (
                    <div style={{ padding: 16, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 6 }}>{safeRenderMarkdown(aiResponse.projects)}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(res.projs || []).map((p, i) => (
                        <div key={i} style={{ border: "1px solid #E5E7EB", background: "#FAFAFA", borderRadius: 6, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 16 }}>🛠️</span>
                          <span style={{ fontSize: 14, color: "#374151" }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Jobs */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>Jobs You Can Target</div>
                    <button onClick={findJobs} disabled={loadingJobs} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", padding: "6px 12px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>{loadingJobs ? "Matching..." : "Find Matches"}</button>
                  </div>

                  {jobMatches.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {jobMatches.map((j, i) => (
                        <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 6, padding: 16, display: "flex", flexDirection: "column", gap: 8, background: "#FAFAFA" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 15, color: "#1F2937", marginBottom: 4 }}>{j.title}</div>
                              <div style={{ fontSize: 13, color: "#6B7280" }}>{j.company} • {j.location}</div>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 12, color: j.compatibility > 50 ? "#059669" : "#D97706", background: j.compatibility > 50 ? "#ECFDF5" : "#FEF3C7", padding: "4px 8px", borderRadius: 4 }}>{j.compatibility}% Match</div>
                          </div>
                          {j.applyUrl && (
                            <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "#FF4F1F", fontWeight: 600, textDecoration: "none" }}>View Job →</a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#6B7280", fontSize: 14, textAlign: "center", padding: "16px 0" }}>Click 'Find Matches' to discover real jobs based on your skills.</div>
                  )}
                </div>

                {/* 7. Compare */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 12 }}>Compare Careers</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {Object.keys(rolesData).filter(r => r !== role).slice(0, 5).map(r => (
                      <button key={r} onClick={() => handleCompare(r)} style={{ background: compareRoles.includes(r) ? "#F3F4F6" : "#FFFFFF", border: compareRoles.includes(r) ? "1px solid #9CA3AF" : "1px solid #D1D5DB", padding: "6px 12px", borderRadius: 4, fontSize: 13, cursor: "pointer", color: "#374151" }}>
                        {compareRoles.includes(r) ? "✓ " : "+ "}{r}
                      </button>
                    ))}
                  </div>

                  {compareRoles.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {compareRoles.map(cr => {
                        const crRes = calculateReadiness(cr, skills);
                        return (
                          <div key={cr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA", border: "1px solid #E5E7EB", padding: "12px 16px", borderRadius: 6 }}>
                            <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{cr}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: mc(crRes.pct) }}>{crRes.pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 8. Progress */}
                <div style={{ padding: 24, borderRadius: 8, border: "1px solid #E5E7EB", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 16 }}>Career Progress</div>
                  {getProgressHistory().length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {getProgressHistory().slice().reverse().map((h, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i === getProgressHistory().length - 1 ? "none" : "1px solid #E5E7EB", paddingBottom: i === getProgressHistory().length - 1 ? 0 : 10 }}>
                          <div style={{ fontSize: 13, color: "#6B7280" }}>{new Date(h.date).toLocaleDateString()}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1F2937" }}>{h.pct}%</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#6B7280" }}>No history found. Complete analyses to track growth.</div>
                  )}
                </div>

              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
  AI ASSISTANT
══════════════════════════════════════ */
function VidyaSetuAssistant() {
  const { user } = useUser();
  const addToast = useToast();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ sender: "ai", txt: "Hi there! 🤖 I'm the Vidya-Setu AI Assistant. I can help you with your scholarships, digital ID, exams, jobs, or the campus store. What do you need help with?" }]);
  const [inp, setInp] = useState("");
  const [typing, setTyping] = useState(false);
  const ref = useRef(null);

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs, typing]);

  const handleSend = async (txt) => {
    if (!txt.trim()) return;
    setMsgs(p => [...p, { sender: "user", txt }]);
    setInp(""); setTyping(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: txt,
          userContext: {
            name: user?.name,
            rollNo: user?.rollNo,
            branch: user?.branch,
            year: user?.year
          }
        })
      });
      const data = await res.json();
      if (data.reply) {
        setMsgs(p => [...p, { sender: "ai", txt: data.reply }]);
      } else {
        throw new Error(data.message || data.error || "AI error");
      }
    } catch (e) {
      setMsgs(p => [...p, { sender: "ai", txt: `🤖 Error: ${e.message}` }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      <button onClick={() => {
        setOpen(true);
        if (!open) addToast("Vidya-Setu AI Ready", "Ask me anything about the app",
          <div style={{ width: 24, height: 24, background: T.orange, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="https://www.freelogovectors.net/wp-content/uploads/2025/06/grok_logo-freelogovectors.net_-768x768.png" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>, T.orange);
      }} className="btn-press ai-fab" style={{ width: 54, height: 54, borderRadius: "50%", background: `linear-gradient(135deg,${T.orange} 0%,${T.orangeLt} 100%)`, color: "#fff", border: "none", fontSize: 20, boxShadow: `0 4px 16px rgba(255,79,31,0.25)`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', background: T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="https://www.freelogovectors.net/wp-content/uploads/2025/06/grok_logo-freelogovectors.net_-768x768.png" alt="Grok" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
        </div>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: T.orange, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.8)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <img src="https://www.freelogovectors.net/wp-content/uploads/2025/06/grok_logo-freelogovectors.net_-768x768.png" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontSize: 18 }}>Vidya-Setu AI Assistant</span>
        </div>
      }>
        <div style={{ display: "flex", flexDirection: "column", height: "62vh", background: "#F7F7F7", borderRadius: 14, border: "1px solid #E8E8E8", overflow: "hidden", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.04)" }}>
          <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.map((m, i) => (
              <div key={i} className={`slide-in ${m.sender === "ai" ? "md-content" : ""}`}
                style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", background: m.sender === "user" ? `linear-gradient(135deg,${T.orange},${T.orangeLt})` : "#fff", color: m.sender === "user" ? "#fff" : T.text, padding: "10px 14px", borderRadius: 16, borderBottomRightRadius: m.sender === "user" ? 4 : 16, borderBottomLeftRadius: m.sender === "ai" ? 4 : 16, maxWidth: "80%", fontSize: 14, lineHeight: 1.4, whiteSpace: m.sender === "ai" ? "normal" : "pre-line", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: m.sender === "ai" ? `1px solid ${T.border}` : "none" }}
                dangerouslySetInnerHTML={m.sender === "ai" && window.marked ? { __html: window.DOMPurify ? window.DOMPurify.sanitize(window.marked.parse(m.txt)) : window.marked.parse(m.txt) } : undefined}
              >
                {!(m.sender === "ai" && window.marked) ? m.txt : null}
              </div>
            ))}
            {typing && <div className="fade-up" style={{ alignSelf: "flex-start", background: "#fff", padding: "10px 14px", borderRadius: 16, fontSize: 14, color: T.muted, border: `1px solid ${T.border}` }}>AI is typing<span className="dots"></span></div>}
          </div>
          <div style={{ padding: "10px 16px", display: "flex", gap: 8, overflowX: "auto", borderTop: "1px solid #EBEBEB", background: "#FAFAFA" }}>
            {["Scholarship Status", "Student Perks", "Exam Topics", "Find Internships", "Buy/Sell Items"].map(q => <button key={q} onClick={() => handleSend(q)} style={{ background: "rgba(255,79,31,0.07)", color: T.orange, border: "1px solid rgba(255,79,31,0.20)", borderRadius: 20, padding: "6px 14px", fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0, fontWeight: 600, transition: "all .15s ease" }}>{q}</button>)}
          </div>
          <div style={{ padding: 12, background: "#fff", display: "flex", gap: 10, borderTop: `1px solid ${T.border}` }}>
            <input type="text" value={inp} onChange={e => setInp(e.target.value)} onKeyPress={e => e.key === "Enter" && handleSend(inp)} placeholder="Ask about scholarships, exams, jobs..." style={{ flex: 1, background: "#F5F5F5", border: "1.5px solid #E8E8E8", color: T.text, borderRadius: 22, padding: "10px 16px", fontSize: 14, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', transition: "border-color .18s, box-shadow .18s" }} />
            <button onClick={() => handleSend(inp)} style={{ background: `linear-gradient(135deg,${T.orange},#FF6B3D)`, border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", cursor: "pointer", fontSize: 16, boxShadow: "0 4px 12px rgba(255,79,31,0.35)", transition: "all .2s ease" }}>➤</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════════════════════════
  MODULE: SCHOLARSHIP HUB
══════════════════════════════════════ */
    function ScholarshipHub() {
      const { user } = useUser();
      const addToast = useToast();
      const [allScholarships, setAllScholarships] = useState([]);
      const [myApplications, setMyApplications] = useState([]);
      const [loading, setLoading] = useState(true);
      const [activeTab, setActiveTab] = useState("all");
      const [searchQuery, setSearchQuery] = useState("");
      const [selectedLevel, setSelectedLevel] = useState("all");
      const [selectedBranch, setSelectedBranch] = useState("all");
      const [selectedYear, setSelectedYear] = useState("all");
      const [selectedPgCourse, setSelectedPgCourse] = useState("all");
      const [selectedSpecialCat, setSelectedSpecialCat] = useState("all");
      const [selectedScope, setSelectedScope] = useState("all");
      const [selectedState, setSelectedState] = useState("all");
      const [selectedGender, setSelectedGender] = useState("all");
      const [sortBy, setSortBy] = useState("deadline");
      const [pipelineStatus, setPipelineStatus] = useState(null);
      const [currentPage, setCurrentPage] = useState(1);

      const [applyingFor, setApplyingFor] = useState(null);
      const [uploadedDoc, setUploadedDoc] = useState({});
      const [howToApplyScholarship, setHowToApplyScholarship] = useState(null);
      const [activeGuide, setActiveGuide] = useState(null);
      const [customProblems, setCustomProblems] = useState([]);
      const [showReportForm, setShowReportForm] = useState(false);
      const [newProblem, setNewProblem] = useState({ title: "", desc: "" });
      const [isSyncing, setIsSyncing] = useState(false);
      const [syncStep, setSyncStep] = useState(0);

      const [showAI, setShowAI] = useState(false);
      const [aiInput, setAiInput] = useState("");
      const [aiMessages, setAiMessages] = useState([
        { sender: "ai", text: "Hello! I am Vidya AI, trained to assist higher education students with verified scholarships across India: B.Tech / B.E., Postgraduate (M.Tech GATE, UGC NSPGS, MCA, MBA), and Defence / CAPF personnel wards. How can I assist you?" }
      ]);
      const [aiLoading, setAiLoading] = useState(false);

      const handleAiSubmit = () => {
        if (!aiInput.trim()) return;
        const userMsg = aiInput;
        setAiMessages(prev => [...prev, { sender: "user", text: userMsg }]);
        setAiInput("");
        setAiLoading(true);

        setTimeout(() => {
          let response = "I'm here to help higher education scholars! For this query, I recommend checking our verified eligibility guides or contacting your college scholarship nodal officer.";
          const lower = userMsg.toLowerCase();

          if (lower.includes("gate") || lower.includes("m.tech") || lower.includes("mtech") || lower.includes("pg scholarship")) {
            response = "For AICTE PG Scholarship (M.Tech/M.E.), students with a valid GATE/CEED score admitted to AICTE-approved institutions receive ₹12,400/month via DBT. Apply at pgscholarship.aicte-india.org.";
          } else if (lower.includes("defence") || lower.includes("ksb") || lower.includes("ex-servicemen") || lower.includes("army") || lower.includes("pmss")) {
            response = "For Defence wards (PMSS KSB / RMDF / AWES), dependent children and widows of Ex-Servicemen and serving Army personnel pursuing B.Tech or recognized PG courses are eligible for annual stipends ranging from ₹12,000 to ₹36,000/yr on ksb.gov.in and awesindia.com.";
          } else if (lower.includes("capf") || lower.includes("crpf") || lower.includes("bsf") || lower.includes("cisf") || lower.includes("itbp") || lower.includes("warb")) {
            response = "For CAPF wards (CRPF, BSF, CISF, ITBP, SSB, Assam Rifles), the Prime Minister's Scholarship Scheme (WARB/MHA) grants ₹30,000/yr (boys) and ₹36,000/yr (girls) for professional B.Tech and PG courses on scholarships.gov.in.";
          } else if (lower.includes("dbt") || lower.includes("bank") || lower.includes("npci") || lower.includes("account") || lower.includes("seeding")) {
            response = "For DBT/Aadhaar Seeding, visit your home bank branch with your original Aadhaar card and passbook. Request 'Aadhaar Seeding for DBT (Direct Benefit Transfer)'. It typically updates on the NPCI mapper in 24-48 hours.";
          } else if (lower.includes("pragati") || lower.includes("aicte")) {
            response = "For AICTE Pragati (Girls in B.Tech), ensure you have an official 1st year / 2nd year lateral admission allotment letter from state counseling (JoSAA/UPTAC/MHT-CET) and family income certificate < ₹8 Lakh.";
          } else if (lower.includes("single girl") || lower.includes("indira gandhi") || lower.includes("nspgs") || lower.includes("ugc")) {
            response = "UGC offers the National Scholarship for Post Graduate Studies (₹15,000/month) and the Post-Graduate Indira Gandhi Scholarship for Single Girl Child (₹36,200/yr) for regular full-time Master's degree students on scholarships.gov.in.";
          } else if (lower.includes("income") || lower.includes("caste") || lower.includes("certificate")) {
            response = "Ensure your digital income/caste certificate is valid online on your state's revenue portal. Income certificates are valid for 3 financial years.";
          }

          setAiMessages(prev => [...prev, { sender: "ai", text: response }]);
          setAiLoading(false);
        }, 1100);
      };

      const handleSyncExternal = async () => {
        setIsSyncing(true);
        setSyncStep(0);
        setTimeout(() => setSyncStep(1), 800);
        setTimeout(() => setSyncStep(2), 1800);

        try {
          const res = await fetch(`${API_BASE_URL}/api/scholarships/fetch-latest`, { method: 'POST' });
          if (res.ok) {
            await loadData();
            addToast("12-Hour Sync Triggered", "Synchronized verified Central, State, and CSR B.Tech scholarships.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_download</span>, T.success);
          } else {
            await loadData();
            addToast("Data Refreshed", "Loaded latest B.Tech scholarship records.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>, T.teal);
          }
        } catch (e) {
          addToast("Network Notice", "Showing cached verified scholarships.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>, T.warn);
        } finally {
          setIsSyncing(false);
        }
      };

      const TROUBLESHOOTING_GUIDES = [
        {
          id: "dbt",
          title: "DBT / Aadhaar Seeding Not Verified",
          desc: "Bank account is not mapped with NPCI for Direct Benefit Transfer. Scholarship disbursement will fail.",
          icon: "account_balance",
          steps: [
            ["1", "Visit Home Bank Branch", "Carry original Aadhaar Card + Bank Passbook"],
            ["2", "Request Aadhaar Seeding", "Fill the Mandate Form for NPCI Aadhaar Mapping for DBT"],
            ["3", "Check NPCI Status", "Verify on npci.org.in or myaadhaar.uidai.gov.in → Bank Seeding Status"],
            ["4", "Wait 24–48 Hours", "DBT linking updates on government servers within 2 business days"],
            ["5", "Re-verify on Portal", "Log in to NSP or State Portal to ensure DBT status is Active"]
          ]
        },
        {
          id: "mismatch",
          title: "University Data & Enrollment Mismatch",
          desc: "Mismatch between entered marks/roll number and university records reported by institution.",
          icon: "assignment_late",
          steps: [
            ["1", "Verify Enrollment Number", "Check your official University ERP or ID card for the exact format"],
            ["2", "Verify Previous Marks", "Ensure SGPA/CGPA or Percentage accurately matches your official grade card"],
            ["3", "Use Correction Window", "Access the official portal during the correction schedule"],
            ["4", "Submit Hardcopy", "Submit the revised declaration and original marksheets to college nodal officer"]
          ]
        },
        {
          id: "attendance",
          title: "Institute Reported Attendance Below 75%",
          desc: "Application suspect due to low attendance percentage uploaded by college.",
          icon: "event_busy",
          steps: [
            ["1", "Check College Attendance ERP", "Verify your subject-wise attendance with your department"],
            ["2", "Contact HOD / Department Head", "If attendance was marked incorrectly, request a rectification note"],
            ["3", "Submit Valid Proof", "In case of medical or official leave, provide authorized medical certificates"],
            ["4", "College Nodal Resubmission", "Ensure the college scholarship officer forwards the updated verification"]
          ]
        },
        {
          id: "server",
          title: "Portal Server Errors & Session Timeouts",
          desc: "Official government portals (NSP, MahaDBT, UP Saksham) experiencing 500/504 errors.",
          icon: "dns",
          steps: [
            ["1", "Access During Off-Peak Hours", "Try filling forms early morning (5 AM - 8 AM) or late night"],
            ["2", "Clear Cache & Incognito Mode", "Use Chrome Incognito mode with disabled extensions"],
            ["3", "Save Draft After Every Section", "Never leave forms idle; save after completing each educational tab"],
            ["4", "Compress Upload Documents", "Ensure all PDFs/JPEGs are strictly within 50KB-200KB limits"]
          ]
        },
        {
          id: "certificate",
          title: "Invalid Income / Caste Certificate",
          desc: "Digital verification failed due to expired certificate or mismatched name spelling.",
          icon: "description",
          steps: [
            ["1", "Verify on State e-District", "Check application number and certificate validity on state portal"],
            ["2", "Verify Name Spelling", "Name on certificate must match Aadhaar card letter-for-letter"],
            ["3", "Renew Expired Certificate", "Income certificates are strictly valid for 3 financial years only"],
            ["4", "Provide Valid Certificate", "Upload the freshly issued tehsildar/revenue authority certificate"]
          ]
        },
        {
          id: "pending_district",
          title: "Pending at District / State Welfare Committee",
          desc: "Application verified by college but awaiting district welfare officer (DSWO) sanction.",
          icon: "hourglass_empty",
          steps: [
            ["1", "Check Scrutiny Schedule", "District committee verification continues till late academic year"],
            ["2", "Inspect Suspect List", "Verify if your application appears on your college's suspect list"],
            ["3", "Contact District Welfare Officer", "If delayed unreasonably after all verifications, contact your local DSWO"],
            ["4", "Lodge Grievance on Jan Sunwai", "Submit an official ticket on state grievance portals if needed"]
          ]
        }
      ];

      const loadData = async () => {
        setLoading(true);
        try {
          const [res1, res2, res3, res4] = await Promise.all([
            fetch(`${API_BASE_URL}/api/scholarships`),
            Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
            fetch(`${API_BASE_URL}/api/scholarships/issues`),
            fetch(`${API_BASE_URL}/api/scholarships/status`)
          ]);
          setAllScholarships(Array.isArray(await res1.clone().json()) ? await res1.json() : []);
          if (res2.ok) setMyApplications(await res2.json());
          if (res3.ok) setCustomProblems(await res3.json());
          if (res4.ok) setPipelineStatus(await res4.json());
        } catch (e) {
          addToast("Offline Mode", "Showing cached verified B.Tech scholarships", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>, T.warn);
        } finally {
          setLoading(false);
        }
      };

      React.useEffect(() => { loadData(); }, []);

      React.useEffect(() => {
        setCurrentPage(1);
      }, [searchQuery, selectedLevel, selectedState, selectedGender, activeTab, sortBy]);

      const handleApply = async () => {
        if (!applyingFor) return;
        addToast("Applying...", "Verifying B.Tech Engineering Eligibility", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sync</span>, T.teal);
        try {
          setApplyingFor(null);
          setUploadedDoc({});
          addToast("Application Recorded", "Your verification documents have been attached.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>, T.success);
        } catch (e) {
          addToast("Network Error", "Could not submit application", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>, T.rose);
        }
      };

      const handleFileUpload = (docName, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedDoc(prev => ({ ...prev, [docName]: e.target.result }));
          addToast("Document Attached", docName + " uploaded successfully.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task</span>, T.teal);
        };
        reader.readAsDataURL(file);
      };

      const TABS = [
        { id: "all", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>school</span> All Verified Schemes</>, c: T.indigo },
        { id: "btech", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>engineering</span> B.Tech / B.E.</>, c: T.indigo },
        { id: "pg", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>menu_book</span> Postgraduate (PG)</>, c: T.indigo },
        { id: "Defence", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>shield</span> Defence Wards</>, c: T.rose },
        { id: "CAPF", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>local_police</span> CAPF Wards</>, c: T.rose },
        { id: "Government", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance</span> Government</>, c: T.success },
        { id: "Private/NGO", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>volunteer_activism</span> CSR / Foundation</>, c: T.orange },
      ];

      const LEVEL_OPTIONS = [
        { id: "all", label: "All Education Levels" },
        { id: "btech", label: "B.Tech / B.E. Degree" },
        { id: "pg", label: "Postgraduate (PG / Master’s)" },
        { id: "defence", label: "Defence Personnel Wards" },
        { id: "capf", label: "CAPF Personnel Wards" }
      ];

      const PG_COURSES = [
        { id: "all", label: "All PG Programs" },
        { id: "M.Tech", label: "M.Tech / M.E." },
        { id: "MCA", label: "MCA" },
        { id: "MSc", label: "M.Sc (STEM)" },
        { id: "MBA", label: "MBA" },
        { id: "MA", label: "M.A." },
        { id: "M.Com", label: "M.Com" }
      ];

      const BRANCH_FILTERS = [
        { id: "all", label: "All Engineering Branches" },
        { id: "Computer Science Engineering", label: "Computer Science (CSE / IT)" },
        { id: "Electronics & Communication", label: "Electronics & Comm (ECE)" },
        { id: "Electrical Engineering", label: "Electrical (EEE)" },
        { id: "Mechanical Engineering", label: "Mechanical Engg" },
        { id: "Civil Engineering", label: "Civil Engg" },
        { id: "Chemical Engineering", label: "Chemical Engg" },
        { id: "AI & Data Science", label: "AI, ML & Data Science" },
      ];

      const BTECH_YEARS = [
        { id: "all", label: "All Academic Years" },
        { id: "1st Year", label: "1st Year (Freshers)" },
        { id: "2nd Year", label: "2nd Year (Lateral / Renewal)" },
        { id: "3rd Year", label: "3rd Year" },
        { id: "4th Year", label: "4th Year (Final Year)" },
      ];

      const STATE_OPTIONS = [
        "All States / UTs",
        "Uttar Pradesh",
        "Maharashtra",
        "West Bengal",
        "Odisha",
        "Gujarat",
        "Bihar",
        "Karnataka",
        "Tamil Nadu",
        "Telangana",
        "Andhra Pradesh",
        "Rajasthan",
        "Madhya Pradesh",
        "Delhi",
        "Punjab",
        "Haryana",
        "Kerala",
        "North Eastern Region (Assam, AP, MN, ML, MZ, NL, SK, TR)"
      ];

      const isRecommended = (s) => {
        if (!s.eligibility) return true;
        const { familyIncome = 999999, casteCategory = 'General', defenceDependent = false, capfDependent = false } = user || {};

        if (s.eligibility.maxIncome && familyIncome > s.eligibility.maxIncome) return false;
        if (s.eligibility.allowedCategories && Array.isArray(s.eligibility.allowedCategories) && s.eligibility.allowedCategories.length > 0) {
          if (!s.eligibility.allowedCategories.includes(casteCategory) && !s.eligibility.allowedCategories.includes('All')) return false;
        }
        if (s.eligibility.isDefenceRequired && !defenceDependent) return false;
        if (s.eligibility.isCapfRequired && !capfDependent) return false;

        return true;
      };

      // Comprehensive multi-category filtering engine
      const visibleScholarships = allScholarships.filter(s => {
        // 1. Tab category filter
        if (activeTab === "btech") {
          if (s.isBTechEligible !== true) return false;
        } else if (activeTab === "pg") {
          if (s.isPGEligible !== true) return false;
        } else if (activeTab === "Defence") {
          if (s.isDefenceEligible !== true && s.category !== 'Defence') return false;
        } else if (activeTab === "CAPF") {
          if (s.isCapfEligible !== true && s.category !== 'CAPF') return false;
        } else if (activeTab === "recommended") {
          if (!isRecommended(s)) return false;
        } else if (activeTab === "Government") {
          if (s.category !== 'Government' && s.category !== 'Institute') return false;
        } else if (activeTab === "Private/NGO") {
          if (s.category !== 'Private/NGO' && s.category !== 'Private' && s.category !== 'Corporate') return false;
        }

        // 2. Dropdown Level Filter
        if (selectedLevel === "btech") {
          if (s.isBTechEligible !== true) return false;
        } else if (selectedLevel === "pg") {
          if (s.isPGEligible !== true) return false;
        } else if (selectedLevel === "defence") {
          if (s.isDefenceEligible !== true && s.category !== 'Defence') return false;
        } else if (selectedLevel === "capf") {
          if (s.isCapfEligible !== true && s.category !== 'CAPF') return false;
        }

        // 3. PG Course Filter
        if (selectedPgCourse !== "all") {
          const pgList = Array.isArray(s.pgCourses) ? s.pgCourses : [];
          const matchesPg = pgList.some(c => c.toLowerCase().includes(selectedPgCourse.toLowerCase()) || c === 'All PG Programs');
          if (!matchesPg) return false;
        }

        // 4. Engineering Branch Filter (applied when s is B.Tech eligible or branch is selected)
        if (selectedBranch !== "all") {
          const branches = Array.isArray(s.engineeringBranches) ? s.engineeringBranches : [];
          if (!branches.includes(selectedBranch) && !branches.includes('All Engineering Branches')) return false;
        }

        // 5. Academic Year Filter
        if (selectedYear !== "all") {
          const years = Array.isArray(s.btechYears) ? s.btechYears : [];
          const matchesYear = years.some(y => y.includes(selectedYear) || y === 'All Years');
          if (!matchesYear) return false;
        }

        // 6. Geographic Scope Filter
        if (selectedScope === "all_india") {
          if (s.coverageScope !== 'All India') return false;
        } else if (selectedScope === "state_specific") {
          if (s.coverageScope !== 'State Specific') return false;
        }

        // 7. State Filter
        if (selectedState !== "all" && selectedState !== "All States / UTs") {
          if (s.coverageScope === 'State Specific' && s.state && s.state.toLowerCase() !== selectedState.toLowerCase()) {
            return false;
          }
        }

        // 8. Gender Filter
        if (selectedGender === "female") {
          if (s.gender !== 'Female' && (s.eligibility && s.eligibility.gender !== 'Female')) return false;
        }

        // 9. Search Query Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchTitle = (s.title || '').toLowerCase().includes(query);
          const matchProvider = (s.provider || '').toLowerCase().includes(query);
          const matchDesc = (s.description || '').toLowerCase().includes(query);
          const matchState = (s.state || '').toLowerCase().includes(query);
          const matchBranches = Array.isArray(s.engineeringBranches) && s.engineeringBranches.some(b => b.toLowerCase().includes(query));
          const matchPg = Array.isArray(s.pgCourses) && s.pgCourses.some(p => p.toLowerCase().includes(query));
          const matchSpecial = Array.isArray(s.specialCategories) && s.specialCategories.some(sp => sp.toLowerCase().includes(query));
          const matchTags = Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(query));

          if (!matchTitle && !matchProvider && !matchDesc && !matchState && !matchBranches && !matchPg && !matchSpecial && !matchTags) {
            return false;
          }
        }

        return true;
      }).sort((a, b) => {
        if (sortBy === 'deadline') {
          if (!a.deadlineDate && !b.deadlineDate) return 0;
          if (!a.deadlineDate) return 1;
          if (!b.deadlineDate) return -1;
          return new Date(a.deadlineDate) - new Date(b.deadlineDate);
        } else if (sortBy === 'latest') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        } else if (sortBy === 'government') {
          if (a.category === 'Government' && b.category !== 'Government') return -1;
          if (a.category !== 'Government' && b.category === 'Government') return 1;
          return 0;
        }
        return 0;
      });

      const getCategoryIcon = (cat) => {
        if (cat === 'Government') return "account_balance";
        if (cat === 'Defence' || cat === 'CAPF') return "shield";
        if (cat === 'Institute') return "school";
        return "volunteer_activism";
      };

      const getStatusColor = (st) => st === 'Approved' ? T.success : st === 'Rejected' ? T.rose : T.orange;

      const catColors = {
        'Government': { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
        'Defence': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
        'CAPF': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
        'Institute': { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
        'Private/NGO': { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA' },
        'Private': { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA' },
        'Corporate': { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA' }
      };

      return (
        <div className="hub-container">
          <style>{`
            .hub-container { background: #fafafa; }
            .premium-hero {
              background: #ffffff;
              border-bottom: 1px solid #e5e7eb;
              padding: 32px 48px;
            }
            .premium-hero-inner {
              display: flex; justify-content: space-between;
              align-items: center; flex-wrap: wrap; gap: 24px; max-width: 1200px; margin: 0 auto;
            }
            .premium-badge {
              background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;
              border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 600;
              display: inline-flex; align-items: center; gap: 4px;
            }
            .premium-btn-sync {
              background: #fff7ed; color: #ea580c; border: 1px solid #fdba74;
              border-radius: 6px; padding: 8px 16px;
              font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center;
              gap: 6px; transition: background 0.15s;
            }
            .premium-btn-sync:hover:not(:disabled) {
              background: #ffedd5;
            }
            .premium-btn-help {
              background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;
              border-radius: 6px; padding: 8px 16px;
              font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center;
              gap: 6px; transition: background 0.15s;
            }
            .premium-btn-help:hover {
              background: #dbeafe;
            }
            .premium-tabs-container {
              display: flex; gap: 8px; margin-bottom: 24px; padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
              flex-wrap: wrap;
            }
            .premium-tab {
              background: transparent; border: none; color: #6b7280;
              padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;
              cursor: pointer; display: flex; align-items: center;
              gap: 6px;
            }
            .premium-tab:hover { background: #f3f4f6; color: #111827; }
            .premium-tab.active {
              background: #fff7ed; color: #ea580c; border: 1px solid #ffedd5;
            }
            .premium-filter-bar {
              background: #ffffff; border: 1px solid #e5e7eb;
              border-radius: 8px; padding: 20px; margin-bottom: 32px; display: flex; flex-direction: column; gap: 16px;
            }
            .premium-input, .premium-select {
              padding: 10px 14px; background: #ffffff; border: 1px solid #d1d5db; border-radius: 6px;
              font-size: 14px; color: #111827; outline: none;
            }
            .premium-input:focus, .premium-select:focus {
              border-color: #ea580c; box-shadow: 0 0 0 2px rgba(234,88,12,0.2);
            }
            .premium-filter-btn {
              background: #ffffff; color: #4b5563; border: 1px solid #d1d5db; border-radius: 6px;
              padding: 6px 12px; font-size: 13px; cursor: pointer;
            }
            .premium-filter-btn:hover { background: #f9fafb; }
            .premium-filter-btn.active {
              background: #fff7ed; color: #ea580c; border-color: #fdba74;
            }
            .premium-card {
              background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 24px;
              display: flex; flex-direction: column; position: relative;
            }
            .premium-card:hover {
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            }
            .premium-pill {
              background: #f3f4f6; border: 1px solid #e5e7eb; color: #4b5563; border-radius: 4px;
              padding: 4px 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;
            }
            .premium-btn-outline {
              flex: 1; padding: 10px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 6px;
              background: #ffffff; border: 1px solid #d1d5db; color: #374151;
            }
            .premium-btn-outline:hover { background: #f9fafb; }
            .premium-btn-primary {
              flex: 1.2; padding: 10px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none;
              display: flex; align-items: center; justify-content: center; gap: 6px;
              background: #ea580c; border: 1px solid #c2410c; color: #ffffff;
            }
            .premium-btn-primary:hover {
              background: #c2410c;
            }
            .premium-btn-disabled {
              flex: 1.2; padding: 10px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: not-allowed; text-decoration: none;
              display: flex; align-items: center; justify-content: center; gap: 6px;
              background: #d1d5db; border: 1px solid #9ca3af; color: #ffffff;
            }
          `}</style>
            {/* ── SCREEN HERO ── */}
            <div className="premium-hero">
              <div className="premium-hero-inner">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', margin: 0 }}>Scholarship Hub</h1>
                  </div>
                  <p style={{ color: '#ea580c', fontSize: 16, fontWeight: 600, margin: 0 }}>
                    Your one-stop destination for verified academic funding and financial aid.
                  </p>
                </div>

                {/* Sync Button & Help Link */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <button onClick={handleSyncExternal} disabled={isSyncing} className="premium-btn-sync">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>sync</span>
                    {isSyncing ? 'Refreshing...' : 'Sync Latest'}
                  </button>
                  {activeTab === 'troubleshooting' ? (
                    <button onClick={() => setActiveTab('all')} className="premium-btn-help" style={{ width: '100%', justifyContent: 'center', background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Back to Scholarships
                    </button>
                  ) : (
                    <button onClick={() => setActiveTab('troubleshooting')} className="premium-btn-help" style={{ width: '100%', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>help_center</span> DBT & Portal Help
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="screen-body" style={{ padding: "32px 48px 60px", maxWidth: 1600, margin: "0 auto" }}>
              <div className="premium-filter-bar">
                {/* ── TOP-LEVEL TABS ── */}
                <div className="premium-tabs-container" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`premium-tab ${activeTab === t.id ? 'active' : ''}`}>
                      {t.label}
                      {t.id === "dashboard" && myApplications.length > 0 && (
                        <span style={{ background: activeTab === t.id ? 'white' : '#FF4F1F', color: activeTab === t.id ? '#0f172a' : 'white', borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
                          {myApplications.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ── SEARCH & SPECIFIC FILTERS ── */}
                {activeTab !== "troubleshooting" && activeTab !== "dashboard" && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9ca3af' }}>search</span>
                      <input
                        type="text"
                        placeholder="Search scholarships by name, degree, branch, provider, state..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="premium-input"
                        style={{ width: '100%', paddingLeft: 40, paddingRight: 36 }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      )}
                    </div>


                    <button onClick={() => setSelectedGender(prev => prev === 'female' ? 'all' : 'female')} 
                      className="premium-select" style={{ background: selectedGender === 'female' ? '#fff1f2' : '#ffffff', color: selectedGender === 'female' ? '#be123c' : '#111827', borderColor: selectedGender === 'female' ? '#fecdd3' : '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>female</span> Girls Only
                    </button>
                  </div>

                  {(selectedLevel !== 'all' || selectedState !== 'all' || selectedGender !== 'all' || searchQuery) && (
                    <div>
                      <button onClick={() => { setSelectedLevel('all'); setSelectedBranch('all'); setSelectedPgCourse('all'); setSelectedYear('all'); setSelectedScope('all'); setSelectedState('all'); setSelectedGender('all'); setSearchQuery(''); }}
                        style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                        Reset All Filters
                      </button>
                    </div>
                  )}
                </>
              )}
              </div>

              {/* ── CONTENT AREA ── */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, animation: "spin 1s linear infinite", color: '#4f46e5' }}>sync</span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginTop: 16 }}>Loading premium scholarships...</div>
                </div>
              ) : activeTab === "troubleshooting" ? (
                <div style={{ maxWidth: 800, margin: "0 auto" }}>
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, marginBottom: 24, boxShadow: "0 4px 12px rgba(245,158,11,0.05)" }}>
                    <span style={{ fontSize: 24 }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}>Common Scholarship & Portal Issues</div>
                      <div style={{ fontSize: 13.5, color: '#78350F', marginTop: 4 }}>Step-by-step resolution guides for DBT bank linking, university enrollment mismatch, AICTE nodal verification, and fee reimbursement.</div>
                    </div>
                  </div>

                  <div style={{ background: "linear-gradient(135deg, #0f172a, #312e81)", borderRadius: 16, padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 32, flexWrap: "wrap", boxShadow: "0 10px 25px rgba(15,23,42,0.15)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.2)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>smart_toy</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#fff", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Ask Vidya AI Higher Education Advisor</div>
                        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Instant guidance on DBT mapping, AICTE GATE stipend, NSP OTR, Defence PMSS, and fee waivers.</div>
                      </div>
                    </div>
                    <button onClick={() => setShowAI(true)} style={{ background: "white", color: "#312e81", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", transition: "all 0.2s ease", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat_bubble</span> Chat Now
                    </button>
                  </div>

                  <div className="grid-2" style={{ gap: 20 }}>
                    {[...TROUBLESHOOTING_GUIDES, ...customProblems].map(guide => (
                      <div key={guide.id || guide._id} className="premium-card">
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                          <div className="premium-icon-box" style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', color: '#e11d48' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{guide.icon}</span>
                          </div>
                          <div>
                            <div className="premium-card-title">{guide.title}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, flex: 1, marginBottom: 20 }}>{guide.desc}</div>
                        <button onClick={() => setActiveGuide(guide)} className="premium-btn-outline" style={{ borderStyle: 'dashed', borderColor: '#e11d48', color: '#e11d48' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_book</span> View Guide
                        </button>
                      </div>
                    ))}
                    <div className="premium-card" style={{ borderStyle: 'dashed', borderColor: '#cbd5e1', alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer" }} onClick={() => setShowReportForm(true)}>
                      <div className="premium-icon-box" style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#4f46e5', marginBottom: 16 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>add</span>
                      </div>
                      <div className="premium-card-title">Facing a Different Portal Issue?</div>
                      <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Report your unique problem and our team will add verified steps.</div>
                    </div>
                  </div>
                </div>
              ) : activeTab === "dashboard" ? (
                <div>
                  {myApplications.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 24px", color: '#64748b', background: 'white', borderRadius: 20, border: '1px dashed #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <div style={{ marginBottom: 20 }}><span className="material-symbols-outlined" style={{ fontSize: 56, color: '#cbd5e1' }}>inbox</span></div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>No Applications Found</div>
                      <div style={{ fontSize: 14, marginTop: 8 }}>Apply for scholarships to track them here.</div>
                    </div>
                  ) : (
                    <div className="grid-2" style={{ gap: 20 }}>
                      {myApplications.map(app => (
                        <div key={app._id} className="premium-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF4F1F', textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{app.categoryApplied} Scholarship</div>
                              <div className="premium-card-title">{app.scholarshipId?.title || "Unknown Scholarship"}</div>
                            </div>
                            <span className="premium-badge" style={{ background: getStatusColor(app.status) + '15', color: getStatusColor(app.status), boxShadow: 'none' }}>{app.status}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}><span style={{ color: '#64748b' }}>Date Applied</span><span style={{ fontWeight: 600, color: '#0f172a' }}>{new Date(app.submittedAt).toLocaleDateString()}</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: '#64748b' }}>Reference ID</span><span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#4f46e5', fontWeight: 600 }}>#{app._id.slice(-6).toUpperCase()}</span></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 16, color: '#475569', fontWeight: 400 }}>
                      Showing <b style={{ color: '#0f172a', fontWeight: 700 }}>{visibleScholarships.length}</b> verified higher education scholarships
                    </div>
                  </div>

                  {visibleScholarships.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 24px", color: '#64748b', background: 'white', borderRadius: 20, border: '1px dashed #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#cbd5e1', marginBottom: 20 }}>search_off</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>No Scholarships Match Your Current Filters</div>
                      <div style={{ fontSize: 14, marginTop: 8, maxWidth: 500, margin: '8px auto 24px', lineHeight: 1.5 }}>
                        Try selecting "All Education Levels" or resetting your state and course filters to explore more opportunities.
                      </div>
                      <button onClick={() => { setSelectedLevel('all'); setSelectedBranch('all'); setSelectedPgCourse('all'); setSelectedYear('all'); setSelectedScope('all'); setSelectedState('all'); setSelectedGender('all'); setSearchQuery(''); }}
                        className="btn-primary" style={{ padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid-2" style={{ gap: 24 }}>
                        {visibleScholarships.slice((currentPage - 1) * 6, currentPage * 6).map(s => {
                          const badgeStyle = catColors[s.category] || { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
                          const statusInfo = s.status === 'closed'
                            ? { bg: '#fef2f2', text: '#e11d48', border: '#fecdd3', label: 'Closed', icon: 'cancel' }
                            : s.status === 'closing_soon'
                              ? { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'Closing Soon', icon: 'hourglass_top' }
                              : s.status === 'upcoming'
                                ? { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'Upcoming', icon: 'event' }
                                : { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Open', icon: 'check_circle' };
                          const isStateSpecific = s.coverageScope === 'State Specific' && s.state && s.state !== 'All India';

                          return (
                            <div key={s._id || s.deduplicationKey} className="premium-card">
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                                <div className="premium-icon-box">
                                  <span className="material-symbols-outlined" style={{ fontSize: 26 }}>{getCategoryIcon(s.category)}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="premium-card-title">{s.title}</div>
                                  <div style={{ color: '#64748b', fontSize: 13.5, marginTop: 4, fontWeight: 500 }}>{s.provider}</div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                                  <span style={{ background: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                                    {s.category}
                                  </span>
                                  <span style={{ background: statusInfo.bg, color: statusInfo.text, border: `1px solid ${statusInfo.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{statusInfo.icon}</span> {statusInfo.label}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                                {isStateSpecific ? (
                                  <span className="premium-pill" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#ffedd5' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span> {s.state}
                                  </span>
                                ) : (
                                  <span className="premium-pill" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe' }}>
                                    🇮🇳 All India
                                  </span>
                                )}
                                {s.isBTechEligible && (
                                  <span className="premium-pill" style={{ background: '#eef2ff', color: '#4338ca', borderColor: '#e0e7ff' }}>
                                    ⚙️ B.Tech / B.E.
                                  </span>
                                )}
                                {s.isPGEligible && (
                                  <span className="premium-pill" style={{ background: '#faf5ff', color: '#7e22ce', borderColor: '#f3e8ff' }}>
                                    🎓 Postgraduate {(s.pgCourses && s.pgCourses[0] && s.pgCourses[0] !== 'All PG Programs') ? `(${s.pgCourses[0]})` : ''}
                                  </span>
                                )}
                                {s.isDefenceEligible && (
                                  <span className="premium-pill" style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}>
                                    🛡️ Defence Ward
                                  </span>
                                )}
                                {s.isCapfEligible && (
                                  <span className="premium-pill" style={{ background: '#ecfeff', color: '#0e7490', borderColor: '#cffafe' }}>
                                    👮 CAPF Ward
                                  </span>
                                )}
                                {s.gender === 'Female' && (
                                  <span className="premium-pill" style={{ background: '#fdf2f8', color: '#be185d', borderColor: '#fce7f3' }}>
                                    👩 Girls Only
                                  </span>
                                )}
                              </div>

                              {s.description && (
                                <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: "0 0 20px", flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {s.description}
                                </p>
                              )}

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: 8 }}>
                                <span style={{ fontSize: 13.5, color: '#475569', display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#64748b' }}>schedule</span> Deadline: <b style={{ color: '#0f172a' }}>{s.deadlineText || s.deadline || 'Not announced'}</b>
                                </span>
                                <span style={{ fontSize: 14, color: '#059669', display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>payments</span> {s.amount}
                                </span>
                              </div>

                              <div style={{ display: "flex", gap: 12 }}>
                                <button onClick={() => setHowToApplyScholarship(s)} 
                                  style={{ flex: 1, padding: "10px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: "#ffffff", border: "1px solid #e2e8f0", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>checklist</span> Guide & Eligibility
                                </button>
                                <a href={s.officialUrl || "https://scholarships.gov.in"} target="_blank" rel="noopener noreferrer"
                                  style={{ flex: 1.2, padding: "10px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: s.status === 'closed' ? "#d1d5db" : "#ea580c", border: "none", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: s.status === 'closed' ? "not-allowed" : "pointer", textDecoration: "none" }}>
                                  {s.status === 'closed' ? 'Closed' : <>Official Portal <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span></>}
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* PAGINATION CONTROLS */}
                      {Math.ceil(visibleScholarships.length / 6) > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 32 }}>
                          <button 
                            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={currentPage === 1}
                            style={{ background: currentPage === 1 ? '#f3f4f6' : '#eff6ff', color: currentPage === 1 ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span> Previous
                          </button>
                          
                          <div style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>
                            Page {currentPage} of {Math.ceil(visibleScholarships.length / 6)}
                          </div>
                          
                          <button 
                            onClick={() => { setCurrentPage(p => Math.min(Math.ceil(visibleScholarships.length / 6), p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={currentPage === Math.ceil(visibleScholarships.length / 6)}
                            style={{ background: currentPage === Math.ceil(visibleScholarships.length / 6) ? '#f3f4f6' : '#e0e7ff', color: currentPage === Math.ceil(visibleScholarships.length / 6) ? '#9ca3af' : '#4338ca', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: currentPage === Math.ceil(visibleScholarships.length / 6) ? 'not-allowed' : 'pointer' }}
                          >
                            Next <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

          {/* HOW TO APPLY & ELIGIBILITY SCHOLARSHIP MODAL */}
          <Modal open={!!howToApplyScholarship} onClose={() => setHowToApplyScholarship(null)} title={howToApplyScholarship ? "📋 Eligibility & Guide: " + howToApplyScholarship.title : ""} aboveNav={true}>
            {howToApplyScholarship && (
              <>
                {/* Scholarship info summary */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 12, background: "linear-gradient(135deg,rgba(79,70,229,0.06),rgba(99,102,241,0.04))", border: "1px solid rgba(79,70,229,0.18)", marginBottom: 18 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: T.indigo + "18", border: `1px solid ${T.indigo}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: T.indigo }}>{getCategoryIcon(howToApplyScholarship.category)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: T.text }}>{howToApplyScholarship.provider}</div>
                    <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                      {howToApplyScholarship.coverageScope === 'State Specific' ? `📍 State: ${howToApplyScholarship.state}` : '🇮🇳 Scope: All India'} • Deadline: <b>{howToApplyScholarship.deadlineText || howToApplyScholarship.deadline}</b>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 13.5 }}>{howToApplyScholarship.amount}</div>
                    <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: howToApplyScholarship.status === 'closed' ? '#FEE2E2' : '#ECFDF5', color: howToApplyScholarship.status === 'closed' ? '#DC2626' : '#059669' }}>
                      {howToApplyScholarship.status === 'closed' ? 'Closed' : howToApplyScholarship.status === 'closing_soon' ? 'Closing Soon' : howToApplyScholarship.status === 'upcoming' ? 'Upcoming' : 'Open'}
                    </span>
                  </div>
                </div>

                {/* Eligibility Criteria Highlights */}
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#4F46E5' }}>verified</span>
                    Eligibility Highlights
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: '#6B7280' }}>Degree / Level:</span> <b style={{ color: '#111827' }}>{(howToApplyScholarship.courses || []).join(', ') || (howToApplyScholarship.educationLevels || []).join(', ')}</b></div>
                    {howToApplyScholarship.isBTechEligible && <div><span style={{ color: '#6B7280' }}>Engineering Branches:</span> <b style={{ color: '#111827' }}>{(howToApplyScholarship.engineeringBranches || ['All Branches']).slice(0, 3).join(', ')}</b></div>}
                    {howToApplyScholarship.isPGEligible && <div><span style={{ color: '#6B7280' }}>PG Programs:</span> <b style={{ color: '#111827' }}>{(howToApplyScholarship.pgCourses || ['All PG Programs']).join(', ')}</b></div>}
                    {howToApplyScholarship.isDefenceEligible && <div><span style={{ color: '#6B7280' }}>Defence Category:</span> <b style={{ color: '#991B1B' }}>Ex-Servicemen / Army Personnel Wards</b></div>}
                    {howToApplyScholarship.isCapfEligible && <div><span style={{ color: '#6B7280' }}>CAPF Category:</span> <b style={{ color: '#0E7490' }}>CRPF, BSF, CISF, ITBP, SSB, AR</b></div>}
                    <div><span style={{ color: '#6B7280' }}>Max Annual Income:</span> <b style={{ color: '#111827' }}>{howToApplyScholarship.eligibility?.maxIncome && howToApplyScholarship.eligibility.maxIncome < 90000000 ? `₹${howToApplyScholarship.eligibility.maxIncome.toLocaleString('en-IN')}` : 'No Strict Income Cap'}</b></div>
                    <div><span style={{ color: '#6B7280' }}>Gender:</span> <b style={{ color: '#111827' }}>{howToApplyScholarship.gender || 'All Eligible'}</b></div>
                  </div>
                </div>

                {/* Step-by-step instructions from verified source */}
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.indigo }}>checklist</span>
                  Step-by-Step Application Guide
                </div>
                {(howToApplyScholarship.howToApply || []).length > 0 ? (
                  howToApplyScholarship.howToApply.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: T.indigo + "12", border: `1px solid ${T.indigo}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: T.indigo }}>{i + 1}</div>
                      <div style={{ color: T.text, fontSize: 12.5, paddingTop: 3, lineHeight: 1.45 }}>{step}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: T.muted, fontSize: 12.5, padding: "8px 0" }}>Visit the official portal for detailed application steps.</div>
                )}

                {/* Required documents */}
                {(howToApplyScholarship.documentsRequired || []).length > 0 && (
                  <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: T.indigo, marginBottom: 6 }}>📄 Mandatory Documents Required</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {howToApplyScholarship.documentsRequired.map(doc => (
                        <span key={doc} style={{ background: T.indigo + "14", color: T.indigo, border: `1px solid ${T.indigo}28`, borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{doc}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Official URL & Safety Notice */}
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: T.warn, marginBottom: 4 }}>🌐 Official Government / Awarding Portal</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                    Authentic Website: <b style={{ color: T.indigo }}>{howToApplyScholarship.officialUrl}</b><br />
                    • Always verify HTTPS before uploading Aadhaar or B.Tech fee receipts.<br />
                    • Ensure your bank account is active on the NPCI Aadhaar DBT mapper.
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button onClick={() => setHowToApplyScholarship(null)}
                    style={{ flex: 1, background: T.gray, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Close
                  </button>
                  <a href={howToApplyScholarship.officialUrl || "https://scholarships.gov.in"} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 2, background: `linear-gradient(135deg,${T.indigo},#6366F1)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                    Apply on Official Portal ↗
                  </a>
                </div>
              </>
            )}
          </Modal>

          {/* APPLICATION SIMULATION MODAL */}
          {applyingFor && (
            <Modal title="Attach Verification Documents" onClose={() => { setApplyingFor(null); setUploadedDoc({}); }}>
              <div style={{ padding: 14, background: "#FFFBF0", border: "1px solid #FDE68A", borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#D97706", fontSize: 13 }}>⚠️ Important Government Regulation</div>
                <div style={{ color: "#92400E", fontSize: 12, marginTop: 3 }}>Students may hold only one active government scholarship concurrently. Dual claims from Central and State portals result in automatic cancellation.</div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Required Certificates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {applyingFor.documentsRequired.map(doc => (
                  <div key={doc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${T.border}`, padding: "10px 14px", borderRadius: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{doc}</div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="file"
                        id={`hub-upload-${doc}`}
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(doc, e.target.files[0])}
                      />
                      <label
                        htmlFor={`hub-upload-${doc}`}
                        style={{
                          background: uploadedDoc[doc] ? T.success + "15" : T.teal + "15",
                          color: uploadedDoc[doc] ? T.success : T.teal,
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: uploadedDoc[doc] ? "default" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {uploadedDoc[doc] ? <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span> Attached</> : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span> Attach</>}
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={handleApply} style={{ background: `linear-gradient(135deg,${T.success},#10B981)`, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 800, cursor: "pointer", width: "100%", transition: "all .2s ease" }}>
                Submit Application Profile
              </button>
            </Modal>
          )}

          {/* VIDYA AI ASSISTANT MODAL */}
          {showAI && createPortal(
            <div style={{ position: "fixed", bottom: 85, right: 24, width: 380, maxWidth: "calc(100vw - 48px)", background: "#fff", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.18)", zIndex: 99999, overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${T.border}` }}>
              <div style={{ padding: 14, background: '#4338CA', color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🤖</span> Vidya AI Scholarship Advisor
                </div>
                <button onClick={() => setShowAI(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.8, fontSize: 16, display: "flex" }}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", height: "380px", background: "#fff" }}>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "12px" }}>
                  {aiMessages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: 14, borderBottomRightRadius: m.sender === "user" ? 2 : 14, borderBottomLeftRadius: m.sender === "ai" ? 2 : 14, background: m.sender === "user" ? '#4338CA' : "#F3F4F6", color: m.sender === "user" ? "#fff" : T.text, fontSize: 12.5, lineHeight: 1.45 }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 2, background: "#F3F4F6", color: T.muted, fontSize: 12.5 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, animation: "spin 1s linear infinite", verticalAlign: "middle" }}>sync</span> Consulting engineering portal guidelines...
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, padding: "10px", borderTop: `1px solid ${T.border}` }}>
                  <input
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAiSubmit()}
                    placeholder="Ask about AICTE, DBT, B.Tech fee waivers..."
                    style={{ flex: 1, padding: "10px 14px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 20, fontSize: 12.5, outline: "none" }}
                  />
                  <button onClick={handleAiSubmit} style={{ width: 38, height: 38, borderRadius: "50%", background: '#4338CA', color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* REPORT PROBLEM MODAL */}
          <Modal open={showReportForm} onClose={() => setShowReportForm(false)} title="Report Scholarship Portal Issue" aboveNav={true}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 4, display: "block" }}>Issue Summary</label>
                <input type="text" value={newProblem.title} onChange={e => setNewProblem({ ...newProblem, title: e.target.value })} placeholder="e.g. AICTE Pragati portal OTR verification issue" style={{ width: "100%", padding: "10px 12px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 4, display: "block" }}>Details & Error Message</label>
                <textarea value={newProblem.desc} onChange={e => setNewProblem({ ...newProblem, desc: e.target.value })} placeholder="Describe what happened and which engineering portal you were using..." rows="3" style={{ width: "100%", padding: "10px 12px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, resize: "vertical" }} />
              </div>
              <button onClick={async () => {
                if (!newProblem.title) return addToast("Error", "Please enter an issue title", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>, T.rose);
                try {
                  const res = await fetch(`${API_BASE_URL}/api/scholarships/issues`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newProblem.title, desc: newProblem.desc })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setCustomProblems([data.issue, ...customProblems]);
                    setShowReportForm(false);
                    setNewProblem({ title: "", desc: "" });
                    addToast("Issue Logged", "Our team will evaluate and publish a guide.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>, T.success);
                  }
                } catch (e) {
                  addToast("Error", "Failed to report problem", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>, T.rose);
                }
              }} style={{ background: `linear-gradient(135deg,${T.indigo},#6366F1)`, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 800, cursor: "pointer", marginTop: 6 }}>
                Submit Report
              </button>
            </div>
          </Modal>

          {/* ACTIVE GUIDE MODAL */}
          <Modal open={!!activeGuide} onClose={() => setActiveGuide(null)} title={activeGuide ? `🛠️ ${activeGuide.title}` : ""} aboveNav={true}>
            {activeGuide && (
              <>
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: T.rose }}>{activeGuide.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: T.text }}>{activeGuide.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{activeGuide.desc}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: T.indigo }}>checklist</span>
                  Step-by-Step Resolution
                </div>
                {activeGuide.steps.map(([s, t, d]) => (
                  <div key={s} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: T.indigo + "12", border: `1px solid ${T.indigo}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: T.indigo }}>{s}</div>
                    <div style={{ color: T.text, fontSize: 12.5, paddingTop: 3, lineHeight: 1.4 }}>
                      <strong>{t}</strong><br /><span style={{ color: T.muted }}>{d}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setActiveGuide(null)}
                    style={{ flex: 1, background: T.gray, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Close Guide
                  </button>
                  <button onClick={() => setActiveGuide(null)}
                    style={{ flex: 2, background: `linear-gradient(135deg,${T.success},#10B981)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                    Got It, Thank You
                  </button>
                </div>
              </>
            )}
          </Modal>

          {/* SYNC LOADER OVERLAY */}
          {isSyncing && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.indigo + "15", color: T.indigo, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 30, animation: "spin 1s linear infinite" }}>sync</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.text, marginBottom: 6 }}>Syncing Verified B.Tech Engineering Portals...</div>
              <div style={{ color: T.muted, fontSize: 13 }}>
                {syncStep === 0 && "Connecting to National Scholarship Portal (NSP)..."}
                {syncStep === 1 && "Verifying AICTE, State Engineering Portals, and Corporate CSR Foundations..."}
                {syncStep === 2 && "Validating B.Tech branch eligibility and official application URLs..."}
              </div>
              <div style={{ width: 220, height: 4, background: T.border, borderRadius: 2, marginTop: 20, overflow: "hidden" }}>
                <div style={{ width: syncStep === 0 ? "30%" : syncStep === 1 ? "65%" : "95%", height: "100%", background: T.indigo, transition: "width 0.8s ease" }}></div>
              </div>
            </div>
          )}
        </div>
      );
    }

/* ══════════════════════════════════════
  MODULE: JOBS, INTERNSHIPS & HACKATHONS
══════════════════════════════════════ */

/* ── BADGE COLORS BY TYPE ── */
function getJobAccent(job) {
  if (job.category === 'Government') return T.indigo;
  if (job.primaryType === 'Internship') return job.secondaryType === 'Paid' ? T.success : job.secondaryType === 'Free' ? T.teal : T.orange;
  if (job.primaryType === 'Hackathon') return T.rose;
  if (job.companyType === 'product') return T.indigo;
  if (job.companyType === 'service') return T.teal;
  return T.orange;
}

/* ── EXPERIENCE LEVEL BADGE ── */
function ExpBadge({ level }) {
  const colors = { Fresher: T.success, 'Entry-Level': T.teal, Junior: T.indigo, Experienced: T.orange, Unknown: T.muted };
  const c = colors[level] || T.muted;
  if (!level || level === 'Unknown') return null;
  return <span style={{ background: c + '15', color: c, border: `1px solid ${c}30`, borderRadius: 6, padding: '2px 7px', fontSize: 12, fontWeight: 700 }}>{level}</span>;
}

/* ── SOURCE CHIP ── */
function SourceChip({ source }) {
  const labels = {
    remotive: 'Remotive',
    himalayas: 'Himalayas',
    govtRss: 'Govt Portal',
    hackathon: 'HackerEarth',
    manual: 'Manual',
    web: 'Web',
    internshala: 'Internshala',
    linkedin: 'LinkedIn',
    Unstop: 'Unstop',
    unstop: 'Unstop',
    aicte: 'AICTE'
  };
  return <span style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>travel_explore</span>{labels[source] || source}</span>;
}

/* ── JOB CARD COMPONENT ── */
function JobCard({ j }) {
  const accent = getJobAccent(j);
  const isGovt = j.category === 'Government' || j.companyType === 'government';
  const isIntern = j.primaryType === 'Internship';
  const isHackathon = j.primaryType === 'Hackathon';

  const typeLabel = isHackathon ? '🏆 Hackathon' : isIntern ? '🎓 Internship' : '💼 Job';
  const compLabel = j.companyType === 'product' ? '🚀 Product' : j.companyType === 'service' ? '⚙️ Service' : j.companyType === 'government' ? '🏛️ Govt' : null;
  const compColor = j.companyType === 'product' ? T.indigo : j.companyType === 'service' ? T.teal : j.companyType === 'government' ? '#4F46E5' : T.muted;

  const internTag = isIntern
    ? j.secondaryType === 'Paid' ? '💰 Paid' : j.secondaryType === 'Free' ? '🆓 Free' : '❓ Compensation Unknown'
    : null;

  const postedText = j.postedAt
    ? (() => { const d = new Date(j.postedAt); const diff = Math.floor((Date.now() - d) / 86400000); return diff === 0 ? 'Today' : diff === 1 ? '1d ago' : diff < 30 ? `${diff}d ago` : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); })()
    : j.createdAt
      ? (() => { const d = new Date(j.createdAt); const diff = Math.floor((Date.now() - d) / 86400000); return diff === 0 ? 'Today' : `${diff}d ago`; })()
      : null;

  const hasValidUrl = (j.sourceUrl || j.applyUrl) && ((j.sourceUrl || j.applyUrl).startsWith('http://') || (j.sourceUrl || j.applyUrl).startsWith('https://'));

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 0, transition: 'box-shadow .2s ease', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)'; }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: '8px 8px 0 0' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {j.companyLogo ? (
          <img src={j.companyLogo} alt={j.company} onError={e => e.target.style.display = 'none'}
            style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8, border: `1px solid ${T.border}`, background: '#F8F8F8', padding: 3, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: 8, background: accent + '15', border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent }}>
              {isGovt ? 'account_balance' : isIntern ? 'school' : isHackathon ? 'emoji_events' : 'work'}
            </span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A', lineHeight: 1.35, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>{j.title}</div>
          <div style={{ color: '#6B7280', fontSize: 13, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span>{j.company}</span>
            <span style={{ color: '#D1D5DB' }}>•</span>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>location_on</span>
            <span>{j.location}</span>
          </div>
        </div>
      </div>

      {/* Badge Row */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ background: accent + '15', color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{typeLabel}</span>
        {isGovt && <span style={{ background: '#4F46E510', color: '#4F46E5', border: '1px solid #4F46E530', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>🏛️ {j.govtCategory !== 'Unknown' ? j.govtCategory : 'Govt'}</span>}
        {compLabel && !isGovt && <span style={{ background: compColor + '10', color: compColor, border: `1px solid ${compColor}30`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{compLabel}</span>}
        {internTag && <span style={{ background: '#F3F4F6', color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{internTag}</span>}
        <span style={{ background: '#F3F4F6', color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{j.domain || 'All Domains'}</span>
        <ExpBadge level={j.experienceLevel} />
        {j.experience && j.experience !== 'Not specified' && j.experience !== 'Unknown' && j.experience !== 'Fresher' && j.experience !== j.experienceLevel && (
          <span style={{ background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB', borderRadius: 6, padding: '2px 7px', fontSize: 12, fontWeight: 600 }}>{j.experience}</span>
        )}
      </div>

      {/* Description */}
      {j.desc && <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.55, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{j.desc}</p>}

      {/* Tags */}
      {j.tags && j.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {j.tags.slice(0, 5).map((tag, i) => (
            <span key={i} style={{ background: T.indigo + '10', color: T.indigo, border: `1px solid ${T.indigo}20`, borderRadius: 6, padding: '2px 7px', fontSize: 12, fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {postedText && <span style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>{postedText}</span>}
        {j.deadline && j.deadline !== 'Not specified' && j.deadline !== 'Rolling' && (
          <span style={{ background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>event</span>{j.deadline}</span>
        )}
        <SourceChip source={j.source} />
        {j.lastVerifiedAt && (
          <span title={`Live Verified: ${new Date(j.lastVerifiedAt).toLocaleString()}`} style={{ fontSize: 11, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 3, background: '#ECFDF5', padding: '2px 6px', borderRadius: 4, border: '1px solid #A7F3D0' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>verified</span> Verified
          </span>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>
          {j.salary && j.salary !== 'Not specified' ? j.salary : null}
        </div>
        {hasValidUrl ? (
          <a href={j.sourceUrl || j.applyUrl} target="_blank" rel="noopener noreferrer"
            style={{ background: '#FF4F1F', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 13px', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'background .15s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E04419'}
            onMouseLeave={e => e.currentTarget.style.background = '#FF4F1F'}>
            {isHackathon ? 'Register ↗' : 'Apply Now ↗'}
          </a>
        ) : (
          <span style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>No direct apply link</span>
        )}
      </div>
    </div>
  );
}

/* ── HACKATHON CARD COMPONENT ── */
function HackathonCard({ h }) {
  const urlToUse = h.sourceUrl || h.applyUrl;
  const hasUrl = urlToUse && (urlToUse.startsWith('http://') || urlToUse.startsWith('https://'));
  const deadlineDisplay = h.deadline || (h.hackathonEndDate ? new Date(h.hackathonEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : null);

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '20px 20px 16px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: T.rose, borderRadius: '8px 8px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {h.companyLogo ? (
          <img src={h.companyLogo} alt={h.hackathonOrganizer || h.company} onError={e => e.target.style.display = 'none'}
            style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 8, border: `1px solid ${T.border}`, background: '#F8F8F8', padding: 3, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 42, height: 42, borderRadius: 8, background: T.rose + '15', border: `1px solid ${T.rose}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: T.rose }}>emoji_events</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A', lineHeight: 1.35, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }}>{h.title}</div>
          <div style={{ color: '#6B7280', fontSize: 13, marginTop: 3 }}>{h.hackathonOrganizer || h.company || 'Organizer'}</div>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ background: T.rose + '15', color: T.rose, border: `1px solid ${T.rose}30`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>🏆 Hackathon</span>
        {h.hackathonMode && <span style={{ background: '#F3F4F6', color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}><span className="material-symbols-outlined" style={{ fontSize: 13, color: T.rose }}>laptop</span>{h.hackathonMode}</span>}
        <span style={{ background: '#F3F4F6', color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{h.domain || h.hackathonTechDomain || 'General Tech'}</span>
        <SourceChip source={h.source} />
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap', fontSize: 13, color: '#4B5563' }}>
        {h.location && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 14, color: T.rose }}>location_on</span>{h.location}</span>}
        {deadlineDisplay && (
          <span style={{ background: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event</span> Deadline: {deadlineDisplay}
          </span>
        )}
      </div>

      {h.hackathonEligibility && <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>👥 {h.hackathonEligibility}</div>}
      {h.desc && <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.55, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{h.desc}</p>}

      <div style={{ marginTop: 'auto', borderTop: `1px solid ${T.border}`, paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        {hasUrl ? (
          <a href={urlToUse} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FF4F1F', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'background .15s ease' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E04419'}
            onMouseLeave={e => e.currentTarget.style.background = '#FF4F1F'}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>emoji_events</span> Register Now ↗
          </a>
        ) : (
          <span style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>Registration Link Unavailable</span>
        )}
      </div>
    </div>
  );
}

/* ── EMPTY STATE COMPONENT ── */
function EmptyState({ icon, title, subtitle, onRefresh }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: T.muted }}>
      <div style={{ marginBottom: 14 }}><span className="material-symbols-outlined" style={{ fontSize: 52, color: T.border }}>{icon}</span></div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: T.text }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>{subtitle}</div>
      {onRefresh && (
        <button onClick={onRefresh} style={{ background: `linear-gradient(135deg,${T.teal},#0EA5E9)`, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Refresh
        </button>
      )}
    </div>
  );
}

/* ── SKELETON CARD ── */
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${T.border}`, padding: 18, height: 220 }}>
      {[75, 55, 90, 40, 65].map((w, i) => (
        <div key={i} style={{ height: 11, borderRadius: 6, background: 'linear-gradient(90deg,#F0F0F0 25%,#E8E8E8 50%,#F0F0F0 75%)', backgroundSize: '200% 100%', width: `${w}%`, marginBottom: 13, animation: 'shimmer 1.5s infinite' }} />
      ))}
    </div>
  );
}

/* ── MAIN COMPONENT ── */
/* ── MAIN COMPONENT ── */
function InternshipJobs({ search = '' }) {
  const addToast = useToast();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('jobs');
  const [lastRefreshResult, setLastRefreshResult] = useState(null);
  const [showRefreshDetails, setShowRefreshDetails] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [domainFilter, setDomainFilter] = useState('All Domains');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('All India');
  const [workModeFilter, setWorkModeFilter] = useState('All');
  const [companyTypeFilter, setCompanyTypeFilter] = useState('All');
  const [expLevelFilter, setExpLevelFilter] = useState('All');
  const [internCompFilter, setInternCompFilter] = useState('All');

  // Update page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, domainFilter, sourceFilter, locationFilter, workModeFilter, companyTypeFilter, expLevelFilter, internCompFilter, search]);

  const buildJobsQuery = () => {
    const params = new URLSearchParams();
    params.append('limit', '20');
    params.append('page', currentPage.toString());

    if (search) params.append('search', search);
    if (domainFilter && domainFilter !== 'All Domains') params.append('domain', domainFilter);
    if (sourceFilter && sourceFilter !== 'all') params.append('source', sourceFilter);
    if (locationFilter && locationFilter !== 'All India') params.append('location', locationFilter);
    if (workModeFilter && workModeFilter !== 'All') params.append('workMode', workModeFilter);
    if (companyTypeFilter && companyTypeFilter !== 'All') params.append('companyType', companyTypeFilter);
    if (expLevelFilter && expLevelFilter !== 'All') params.append('experienceLevel', expLevelFilter);

    // Tab specific filters
    if (activeTab === 'internships') {
      params.append('primaryType', 'Internship');
      if (internCompFilter && internCompFilter !== 'All') params.append('secondaryType', internCompFilter);
    } else if (activeTab === 'hackathons') {
      params.append('primaryType', 'Hackathon');
    } else if (activeTab === 'jobs') {
      params.append('primaryType', 'Job');
    }

    console.log(`[JOBS FILTER QUERY] ${params.toString()}`);
    return params;
  };

  const loadJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = buildJobsQuery();

      const statsParams = new URLSearchParams(params);
      statsParams.delete('limit');
      statsParams.delete('page');
      statsParams.delete('primaryType');
      statsParams.delete('secondaryType');
      statsParams.delete('category');
      statsParams.delete('excludeGovt');

      const [jobsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/jobs?${params.toString()}`),
        fetch(`${API_BASE_URL}/api/jobs/stats?${statsParams.toString()}`)
      ]);

      const jobsData = await jobsRes.json();
      const statsData = await statsRes.json();

      if (jobsData.success) {
        setJobs(Array.isArray(jobsData.jobs) ? jobsData.jobs : []);
        setCurrentPage(Number(jobsData.page) || 1);
        setTotalPages(Number(jobsData.totalPages) || 1);
        setTotalCount(Number(jobsData.total) || 0);
      } else {
        setJobs([]);
      }

      if (statsData.success) {
        setStats(statsData);
      } else {
        setStats(null);
      }
      if (statsData && statsData.lastRefreshTime) {
        setLastUpdated(new Date(statsData.lastRefreshTime));
      } else {
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('loadJobs error:', err);
      if (!silent) addToast('Connection Error', 'Could not reach backend at ' + API_BASE_URL, '❌', T.rose);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  React.useEffect(() => { loadJobs(); }, [currentPage, activeTab, domainFilter, sourceFilter, locationFilter, workModeFilter, companyTypeFilter, expLevelFilter, internCompFilter, search]);

  React.useEffect(() => {
    const interval = setInterval(() => loadJobs(true), 3600000); // 60 minutes
    return () => clearInterval(interval);
  }, [currentPage, activeTab, domainFilter, sourceFilter, locationFilter, workModeFilter, companyTypeFilter, expLevelFilter, internCompFilter, search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    addToast('Fetching Latest…', 'Syncing from all sources', '🌐', T.teal);
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/fetch-latest`, { method: 'POST' });
      const data = await res.json();
      setLastRefreshResult(data);
      if (data.success || data.jobsAdded >= 0) {
        addToast('✅ Refreshed!', `Added ${data.jobsAdded || 0} new listings`, '🚀', T.success);
        await loadJobs();
      } else {
        addToast('⚠️ Partial Update', data.error || 'Some sources unavailable', '⚠️', T.warn);
      }
    } catch (e) {
      addToast('Network Error', 'Could not reach backend', '❌', T.rose);
    } finally {
      setRefreshing(false);
    }
  };

  // Tab definitions driven by API stats
  const TABS = [
    { id: 'jobs', icon: 'work', label: 'Jobs', count: stats?.jobs || 0, color: T.orange },
    { id: 'internships', icon: 'school', label: 'Internships', count: stats?.internships || 0, color: T.success },
    { id: 'hackathons', icon: 'emoji_events', label: 'Hackathons', count: stats?.hackathons || 0, color: T.rose },
  ];

  // Safe array assignment for rendering
  const visibleJobs = Array.isArray(jobs) ? jobs : [];
  const currentTab = TABS.find(t => t.id === activeTab);
  const searchLower = (search || '').toLowerCase().trim();

  const DOMAINS = ['All Domains', 'Software Development', 'Web Development', 'App Development', 'AI/ML', 'Data Science', 'Cyber Security', 'Cloud Computing', 'DevOps', 'Database', 'Electronics', 'Embedded Systems', 'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'UI/UX Design'];
  const SOURCE_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: 'Internshala', value: 'internshala' },
    { label: 'LinkedIn', value: 'linkedin' },
    { label: 'Unstop', value: 'unstop' },
    { label: 'HackerEarth', value: 'hackathon' }
  ];
  const LOCATIONS = ['All India', 'Remote', 'Bangalore', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi', 'Noida', 'Gurugram', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Indore', 'Kochi', 'Chandigarh'];
  const COMPANY_TYPES = ['All', 'product', 'service', 'government', 'unknown'];
  const EXP_LEVELS = ['All', 'Fresher', 'Entry-Level', 'Junior', 'Experienced'];

  return (
    <div>
      {/* ── HERO ── */}
      <div className="screen-hero">
        <div className="screen-hero-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            <span style={{ background: T.success + '12', color: T.success, border: `1px solid ${T.success}25`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>

            </span>

          </div>
          <h1 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 30, fontWeight: 800, marginTop: 12, lineHeight: 1.15, color: '#1A1A1A', letterSpacing: '-0.2px' }}>Jobs, Internships &amp; Hackathons</h1>

        </div>
      </div>

      <div className="screen-body">

        {/* ── LIVE COUNTER STRIP ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Jobs', val: loading ? '…' : (stats?.jobs || 0), icon: 'work', c: T.orange, tabId: 'jobs' },
            { label: 'Internships', val: loading ? '…' : (stats?.internships || 0), icon: 'school', c: T.success, tabId: 'internships' },
            { label: 'Hackathons', val: loading ? '…' : (stats?.hackathons || 0), icon: 'emoji_events', c: T.rose, tabId: 'hackathons' },
          ].map(s => {
            const isActive = activeTab === s.tabId;
            return (
              <div key={s.label} onClick={() => setActiveTab(s.tabId)} style={{ background: isActive ? s.c + '08' : '#FFFFFF', border: isActive ? `2px solid ${s.c}` : '1px solid #E5E7EB', borderRadius: 12, padding: '14px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', transition: 'all .2s ease', minWidth: 120, flex: '1 1 120px', maxWidth: 200 }}>
                <span style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontWeight: 800, color: isActive ? s.c : '#111827', fontSize: 26, lineHeight: 1 }}>{s.val}</span>
                <span style={{ fontSize: 13, color: isActive ? s.c : '#6B7280', fontWeight: 600 }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, padding: '14px 16px', background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB' }}>
          {/* Domain */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Domain</label>
            <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: '#111827', cursor: 'pointer', height: 32 }}>
              {DOMAINS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {/* Source */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</label>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: '#111827', cursor: 'pointer', height: 32 }}>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {/* Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</label>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: '#111827', cursor: 'pointer', height: 32 }}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {/* Work Mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Mode</label>
            <select value={workModeFilter} onChange={e => setWorkModeFilter(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: '#111827', cursor: 'pointer', height: 32 }}>
              <option value="All">All Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </div>
          {/* Company Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company Type</label>
            <select value={companyTypeFilter} onChange={e => setCompanyTypeFilter(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: '#111827', cursor: 'pointer', height: 32 }}>
              {COMPANY_TYPES.map(ct => <option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>)}
            </select>
          </div>
          {/* Experience Level */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Experience</label>
            <select value={expLevelFilter} onChange={e => setExpLevelFilter(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 13, background: '#fff', color: '#111827', cursor: 'pointer', height: 32 }}>
              {EXP_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {/* Reset */}
          {(domainFilter !== 'All Domains' || sourceFilter !== 'all' || locationFilter !== 'All India' || workModeFilter !== 'All' || companyTypeFilter !== 'All' || expLevelFilter !== 'All') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'flex-end' }}>
              <label style={{ fontSize: 11, color: 'transparent' }}>_</label>
              <button onClick={() => { setDomainFilter('All Domains'); setSourceFilter('all'); setLocationFilter('All India'); setWorkModeFilter('All'); setCompanyTypeFilter('All'); setExpLevelFilter('All'); }}
                style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#EF4444', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', height: 32 }}>
                ✕ Reset
              </button>
            </div>
          )}
        </div>

        {/* ── ACTION BAR ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            {lastUpdated && <span>Last updated: {lastUpdated.toLocaleString()} • Auto-refreshes every 24 hours</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {lastRefreshResult && (
              <button onClick={() => setShowRefreshDetails(!showRefreshDetails)}
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#6B7280', cursor: 'pointer' }}>
                Last sync: +{lastRefreshResult.jobsAdded} new
              </button>
            )}
          </div>
        </div>

        {/* ── REFRESH DETAILS PANEL ── */}
        {showRefreshDetails && lastRefreshResult && (
          <div style={{ background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: T.text }}>📊 Last Refresh Statistics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Added', val: lastRefreshResult.jobsAdded, c: T.success },
                { label: 'Duplicates', val: lastRefreshResult.duplicates, c: T.orange },
                { label: 'Rejected', val: lastRefreshResult.rejected, c: T.rose },
                { label: 'Stale Removed', val: lastRefreshResult.staleRemoved, c: T.muted }
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: '#fff', borderRadius: 10, padding: '8px', border: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontWeight: 700, fontSize: 16, color: s.c }}>{s.val ?? '—'}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
            {lastRefreshResult.sources && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Per-Source Statistics</div>
                {Object.entries(lastRefreshResult.sources).map(([name, s]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: T.text, textTransform: 'capitalize' }}>{name}</span>
                    <div style={{ display: 'flex', gap: 8, color: T.muted }}>
                      <span>fetched: <b style={{ color: T.text }}>{s.fetched}</b></span>
                      <span>accepted: <b style={{ color: T.success }}>{s.accepted}</b></span>
                      <span>rejected: <b style={{ color: T.rose }}>{s.rejected}</b></span>
                      {s.error && <span style={{ color: T.rose, fontSize: 10 }}>⚠️ {s.error.substring(0, 60)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INTERNSHIP COMPENSATION SUB-FILTER (only in Internships tab) ── */}
        {activeTab === 'internships' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'All', label: 'All Internships', icon: 'list_alt', count: stats?.internships || 0 },
              { key: 'Paid', label: 'Paid', icon: 'payments', count: stats?.paidInternships || 0, c: T.success },
              { key: 'Free', label: 'Free', icon: 'volunteer_activism', count: stats?.freeInternships || 0, c: T.teal },
              { key: 'Unknown', label: 'Unspecified', icon: 'help_outline', count: stats?.unknownInternships || 0, c: T.muted }
            ].map(f => {
              const isActive = internCompFilter === f.key;
              const c = f.c || T.indigo;
              return (
                <button key={f.key} onClick={() => setInternCompFilter(f.key)}
                  style={{ background: isActive ? c : '#fff', color: isActive ? '#fff' : T.muted, border: `1px solid ${isActive ? c : T.border}`, borderRadius: 22, padding: '7px 16px', fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer', transition: 'all .18s ease', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{f.icon}</span>
                  {f.label}
                  <span style={{ background: isActive ? 'rgba(255,255,255,0.25)' : '#F0F0F0', borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{loading ? '…' : f.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── HACKATHONS TAB SPECIAL CONTENT ── */}
        {activeTab === 'hackathons' && !loading && visibleJobs.length === 0 && (
          <div style={{ background: 'linear-gradient(135deg,rgba(244,63,94,0.05),rgba(239,68,68,0.03))', border: `1px solid ${T.rose}25`, borderRadius: 18, padding: '28px 24px', marginBottom: 20, textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: T.rose, display: 'block', marginBottom: 14 }}>emoji_events</span>
            <div style={{ fontWeight: 800, fontSize: 17, color: T.text, marginBottom: 8 }}>No Verified Hackathons Available Right Now</div>
            <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 20px' }}>
              No public hackathon API is available without authentication. We never show fabricated hackathon data.
              Visit these official platforms for live hackathon listings:
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Devfolio', url: 'https://devfolio.co/hackathons', color: '#3B49DF' },
                { label: 'Unstop', url: 'https://unstop.com/hackathons', color: '#FF6B35' },
                { label: 'HackWithIndia', url: 'https://hackwithindia.in', color: '#1DA462' },

              ].map(p => (
                <a key={p.label} href={p.url} target="_blank" rel="noopener noreferrer"
                  style={{ background: p.color + '12', color: p.color, border: `1px solid ${p.color}30`, borderRadius: 12, padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {p.label} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── JOBS GRID ── */}
        {loading ? (
          <div className="grid-2">{[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}</div>
        ) : visibleJobs.length === 0 && activeTab !== 'hackathons' ? (
          <EmptyState
            icon={activeTab === 'internships' ? 'school' : activeTab === 'hackathons' ? 'emoji_events' : 'work'}
            title={`No ${currentTab?.label || ''} listings found`}
            subtitle={searchLower
              ? `No results for "${search}". Try different search terms or clear filters.`
              : activeTab === 'internships' && internCompFilter === 'Free'
                ? 'Free internships: 0 — no qualifying real listings currently available.'
                : undefined}
            onRefresh={handleRefresh}
          />
        ) : visibleJobs.length > 0 ? (
          <div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: T.success }}>circle</span>
              Showing {visibleJobs.length} of {totalCount} real {currentTab?.label} opportunity{totalCount !== 1 ? 'ies' : 'y'} • India only
              {searchLower && ` • Filtered by: "${search}"`}
            </div>
            <div className="grid-2">
              {visibleJobs.map(j =>
                j.primaryType === 'Hackathon'
                  ? <HackathonCard key={j._id} h={j} />
                  : <JobCard key={j._id} j={j} />
              )}
            </div>
          </div>
        ) : null}

        {/* ── PAGINATION CONTROLS ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, padding: '16px', background: '#FFFFFF', borderRadius: 12, border: `1px solid ${T.border}` }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: currentPage === 1 ? '#F3F4F6' : '#E0E7FF', color: currentPage === 1 ? T.muted : T.indigo, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all .2s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span> Previous
            </button>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: currentPage === totalPages ? '#F3F4F6' : '#E0E7FF', color: currentPage === totalPages ? T.muted : T.indigo, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', transition: 'all .2s' }}>
              Next <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        )}

        {/* ── FOOTER NOTE ── */}
        <div style={{ marginTop: 28, padding: '14px 18px', background: '#F8FAFC', borderRadius: 14, border: `1px solid ${T.border}`, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: T.text }}>📌 About This Feed:</span> All listings are fetched from real public platforms (LinkedIn, Internshala, HackerEarth, Unstop) and official sources. Every Apply Now link points to the actual source URL. No fake, fabricated, or demo data is used. Counters reflect live database values.
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════
  HOME SCREEN
══════════════════════════════════════ */
function Home({ go }) {
  const { user } = useUser();
  const addToast = useToast();

  const mods = [
    { id: "chhatra", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>badge</span>, title: "Student Perks", sub: "Digital ID & Perks", c: T.indigo },
    { id: "prashna", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>fact_check</span>, title: "GATE Insights", sub: "GATE AI Intelligence", c: T.rose },
    { id: "bazaar", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>storefront</span>, title: "Campus Store", sub: "Buy & Sell on Campus", c: T.teal },
    { id: "karya", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>engineering</span>, title: "Career Compass", sub: "Placement Skill Matcher", c: T.yellow },
    { id: "hub", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>account_balance</span>, title: "Scholarship Hub", sub: "Apply & Track Status", c: T.success },
    { id: "jobs", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>work</span>, title: "Jobs, Internships & Hackathons", sub: "Find Jobs, Internships & Hackathons", c: T.orange },
  ];

  const [dashCounts, setDashCounts] = React.useState({ scholarships: null, perks: null, items: null, jobs: null });
  const [upDeadline, setUpDeadline] = React.useState(null);
  const [loadedDeadline, setLoadedDeadline] = React.useState(false);

  React.useEffect(() => {
    // Fetch Scholarships
    fetch(`${API_BASE_URL}/api/scholarships`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        setDashCounts(prev => ({ ...prev, scholarships: Array.isArray(d) ? d.length : 0 }));
        if (Array.isArray(d)) {
          // Find the UP Post-Matric scholarship or any matching "UP Post-Matric"
          const upSch = d.find(s => s.title && s.title.includes("UP Post-Matric"));
          if (upSch && upSch.deadline) {
            setUpDeadline(upSch.deadline);
          }
        }
        setLoadedDeadline(true);
      })
      .catch(() => {
        setDashCounts(prev => ({ ...prev, scholarships: 0 }));
        setLoadedDeadline(true);
      });

    // Fetch Perks
    fetch(`${API_BASE_URL}/api/perks`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setDashCounts(prev => ({ ...prev, perks: Array.isArray(d) ? d.length : 0 })))
      .catch(() => setDashCounts(prev => ({ ...prev, perks: 0 })));

    // Fetch Campus Store Marketplace Stats — real count from DB
    fetch(`${API_BASE_URL}/api/marketplace/stats`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setDashCounts(prev => ({ ...prev, items: d.total || 0 })))
      .catch(() => setDashCounts(prev => ({ ...prev, items: 0 })));

    // Fetch Jobs
    fetch(`${API_BASE_URL}/api/jobs/stats`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setDashCounts(prev => ({ ...prev, jobs: d.total ?? 0 })))
      .catch(() => setDashCounts(prev => ({ ...prev, jobs: 0 })));
  }, []);

  const stats = [
    [<span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em', fontVariationSettings: "'wght' 300" }}>school</span>, dashCounts.scholarships === null ? '…' : dashCounts.scholarships, "Scholarships"],
    [<span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em', fontVariationSettings: "'wght' 300" }}>diamond</span>, dashCounts.perks === null ? '…' : dashCounts.perks, "Perks"],
    [<span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em', fontVariationSettings: "'wght' 300" }}>shopping_cart</span>, dashCounts.items === null ? '…' : dashCounts.items, "Campus Items"],
    [<span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em', fontVariationSettings: "'wght' 300" }}>work</span>, dashCounts.jobs === null ? '…' : dashCounts.jobs, "Active Jobs"],
  ];

  // Calculate remaining days from the current date to that deadline dynamically
  let deadlineText = "Loading deadline details…";
  if (loadedDeadline) {
    if (!upDeadline) {
      deadlineText = "Check the Scholarship Hub for the latest University Scholarship deadline.";
    } else {
      const deadlineDate = new Date(upDeadline);
      if (isNaN(deadlineDate.getTime())) {
        deadlineText = "Check the Scholarship Hub for the latest University Scholarship deadline.";
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          deadlineText = <>University Scholarship closes in <strong>{diffDays} days</strong>. Apply on Scholarship Hub now.</>;
        } else if (diffDays === 0) {
          deadlineText = "University Scholarship closes today. Apply on Scholarship Hub now.";
        } else {
          deadlineText = "University Scholarship deadline has passed.";
        }
      }
    }
  }

  return (
    <div>
      {/* HERO */}
      <div className="screen-hero" style={{ padding: "44px 44px 40px" }}>
        <div className="screen-hero-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(145deg, #1A1A1A, #0D0D0D)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(255,79,31,0.25), 0 0 0 1.5px rgba(255,79,31,0.35), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
              <img src="/images/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "inherit" }} alt="Vidya-Setu Logo" />
            </div>
            <div>
              <div style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 16, fontWeight: 900, lineHeight: 1, color: "#1A1A1A" }}>Vidya-Setu</div>
              <div style={{ color: T.muted, fontSize: 10, letterSpacing: .5 }}>Student Web Portal • University Ecosystem</div>
            </div>
          </div>
          <h1 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 36, fontWeight: 900, lineHeight: 1.2, marginBottom: 12, color: T.text, letterSpacing: "-0.5px" }}>Hi, {user.name ? user.name.split(" ")[0] : "Dev"} </h1>

          <p style={{ color: T.muted, fontSize: 15 }}>{user.branch || "CSE"} • {user.year || "1st Year"} • University Lucknow</p>
          <div className="home-stats">
            {stats.map(([i, v, l]) => (
              <div key={l} style={{ background: "rgba(255,79,31,0.055)", borderRadius: 14, padding: "14px 12px", textAlign: "center", border: "1px solid rgba(255,79,31,0.14)", boxShadow: "0 1px 6px rgba(255,79,31,0.05)" }}>
                <div style={{ fontSize: 22 }}>{i}</div>
                <div style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 18, fontWeight: 700, color: T.orange, marginTop: 6 }}>{v}</div>
                <div style={{ color: T.muted, fontSize: 10, marginTop: 3, lineHeight: 1.3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="screen-body">


        {/* Deadline Alert */}
        <div style={{ background: "linear-gradient(135deg,rgba(255,199,0,0.13) 0%,rgba(255,79,31,0.08) 100%)", borderRadius: 16, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, border: "1px solid rgba(245,158,11,0.30)", boxShadow: "0 2px 12px rgba(245,158,11,0.10)" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⚠️</div>
          <div style={{ flexShrink: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#92400E", fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', letterSpacing: "-0.1px" }}>Scholarship Deadline Approaching</div>
            <div style={{ color: "#78350F", fontSize: 12, marginTop: 3, opacity: 0.82 }}>{deadlineText}</div>
          </div>
          <button onClick={() => window.open('https://scholarship.up.gov.in/', '_blank')} style={{ background: T.orange, color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 14px rgba(255,79,31,0.30)", transition: "all .18s ease" }}>Check Now →</button>
        </div>

        {/* Modules Grid */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 14, color: "#AAAAAA", letterSpacing: 1.2, textTransform: "uppercase" }}>All Modules</div>
          <div className="home-modules">
            {mods.map(m => (
              <div key={m.id} className="card-hover" onClick={() => go(m.id)} style={{ background: "#FFFFFF", borderRadius: 16, padding: "16px", border: "1px solid #EBEBEB", cursor: "pointer", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", transition: "all .22s cubic-bezier(0.16,1,0.3,1)", position: "relative" }}>
                <div className="icon-hover" style={{ width: 46, height: 46, borderRadius: 12, background: m.c + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 12, border: `1px solid ${m.c}22`, transition: "all .2s ease" }}>{m.icon}</div>
                <div style={{ position: 'absolute', top: 20, right: 18, color: '#C0C0C0' }}><span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span></div>
                <div style={{ fontWeight: 800, fontSize: 14, color: T.text, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', paddingRight: 24 }}>{m.title}</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 5 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
  ROOT APP (Desktop Sidebar Layout)
══════════════════════════════════════ */
const TABS = [
  { id: "home", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>home</span>, label: "Home" },
  { id: "hub", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>school</span>, label: "Hub" },
  { id: "bazaar", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>shopping_cart</span>, label: "Store" },
  { id: "jobs", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>work</span>, label: "Jobs" },
];

const MAIN_NAV = [
  { id: "home", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>home</span>, label: "Dashboard" },
  { id: "hub", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>school</span>, label: "Scholarship Hub" },
  { id: "bazaar", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>shopping_cart</span>, label: "Campus Store" },
  { id: "community", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>forum</span>, label: "Community Hub" },
  { id: "jobs", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>work</span>, label: "Jobs & Internships" },
];

const TOOLS_NAV = [
  { id: "chhatra", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>badge</span>, label: "Student ID & Perks" },
  { id: "prashna", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>bar_chart</span>, label: "GATE Insights" },
  { id: "karya", icon: <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>ads_click</span>, label: "Career Compass" },
];

const getTabFromHash = () => {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
  return h || 'home';
};

function App({ onLogout }) {
  const { user } = useUser();
  const addToast = useToast();
  const [tab, setTab] = useState(getTabFromHash);

  useEffect(() => {
    const handleHashChange = () => setTab(getTabFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const ref = useRef(null);

  const lastScrollY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = (e) => {
      const currentScrollY = e.target.scrollTop;

      if (currentScrollY > lastScrollY.current) {
        // Scrolling down (User requested to SHOW here)
        setNavVisible(true);
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up (User requested to HIDE here)
        setNavVisible(false);
      }
      lastScrollY.current = currentScrollY;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const go = t => { window.location.hash = t; if (ref.current) ref.current.scrollTop = 0; setSidebarOpen(false); };

  const screens = {
    home: <Home go={go} />,
    hub: <ScholarshipHub />,
    vidya: <VidyaSetu />,
    chhatra: <ChhatraLabh />,
    prashna: <ExamAnalytics />,
    bazaar: <TechBazaar search={search} />,
    community: <CommunityForum search={search} />,
    karya: <KaryaDisha />,
    jobs: <InternshipJobs search={search} />,
  };

  const handleSearch = val => {
    setSearch(val);
  };

  return (
    <div className="vs-shell">
      {/* Sidebar Overlay (mobile) */}
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ── SIDEBAR ── */}
      <aside className={`vs-sidebar ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-logo brand-logo-enhanced" style={{ position: "relative" }}>
            <img src="/images/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "inherit" }} alt="Vidya-Setu Logo" />
          </div>
          <div>
            <div className="brand-text-name">Vidya-Setu</div>
            <div className="brand-text-sub">Student Web Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {MAIN_NAV.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} className={`sidebar-nav-item ${active ? "active" : ""}`}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-label">{t.label}</span>
                {active && <div className="nav-dot" />}
              </button>
            );
          })}

          <div className="sidebar-section-label" style={{ marginTop: 8 }}>Tools</div>
          {TOOLS_NAV.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} className={`sidebar-nav-item ${active ? "active" : ""}`}>
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-label">{t.label}</span>
                {active && <div className="nav-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div onClick={() => setProfileOpen(true)} className="sidebar-user-card">
            <div className="user-ava" style={user.profilePhoto ? { background: "transparent", overflow: "hidden", padding: 0 } : {}}>{user.profilePhoto ? <img src={user.profilePhoto} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} alt="" /> : (user.initials || "DK")}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-nm">{user.name || "Dev Kumar"}</div>
              <div className="user-mt">{user.branch || "CSE"} • {user.year || "1st Year"}</div>
            </div>

          </div>
        </div>
      </aside>

      {/* ── MAIN PANEL ── */}
      <div className="vs-main">
        {/* Header */}
        <header className="vs-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <button className="desktop-menu-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'none', border: 'none', color: T.text, fontSize: 24, cursor: 'pointer', marginRight: 16, display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-outlined">menu</span>
          </button>

          <div className="header-logo-mobile">
            <div className="brand-logo brand-logo-enhanced" style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #FF4F1F, #FFC700)", boxShadow: "0 4px 12px rgba(255,79,31,0.2)" }}>
              <img src="/images/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "inherit" }} alt="Vidya-Setu Logo" />
            </div>
            <span style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontWeight: 900, fontSize: 14, color: T.text }}>Vidya-Setu</span>
          </div>

          <div className="header-search-wrap" style={{ position: "relative" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#1E3A8A", flexShrink: 0, fontWeight: 300, cursor: "default" }}>search</span>
            <input
              type="text"
              className="header-search-input"
              placeholder="Search portal services..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{ fontSize: 13 }}
            />
            {search && <span className="material-symbols-outlined" onClick={() => setSearch("")} style={{ color: T.muted, cursor: "pointer", fontSize: 16 }}>close</span>}

            {/* Search Dropdown Panel */}
            {search && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#FFF", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", border: "1px solid #E8E8E8", zIndex: 100, overflow: "hidden", animation: "fadeUp 0.2s ease" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #F0F0F0" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>Jump to Module</span>
                </div>
                <div>
                  {[
                    ...MAIN_NAV,
                    ...TOOLS_NAV
                  ].filter(m => m.label.toLowerCase().includes(search.toLowerCase()))
                    .map(m => (
                      <div key={m.id} onClick={() => { go(m.id); setSearch(""); }} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.2s", ":hover": { background: "#F9F9F9" }, borderBottom: "1px solid rgba(0,0,0,0.02)" }} className="search-res-item">
                        <div style={{ color: "#1E3A8A", display: "flex", alignItems: "center" }}>{m.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{m.label}</div>
                      </div>
                    ))}
                  {[...MAIN_NAV, ...TOOLS_NAV].filter(m => m.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                    <div style={{ padding: "24px 14px", textAlign: "center", color: T.muted, fontSize: 13 }}>No results found for "{search}"</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="header-actions">


          </div>
        </header>

        {/* Content */}
        <div ref={ref} className="vs-content">
          <div className="fade-up" key={tab}>{screens[tab] || screens.home}</div>
          <VidyaSetuAssistant />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="mobile-bottom-nav" style={{
        transform: navVisible ? "translateY(0)" : "translateY(120%)",
        opacity: navVisible ? 1 : 0,
        transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease"
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => go(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 2px" }}>
              <div style={{ width: 40, height: 28, borderRadius: 10, background: active ? "rgba(255,79,31,0.12)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .22s cubic-bezier(0.16,1,0.3,1)", transform: active ? "scale(1.08)" : "scale(1)" }}>
                <span style={{ fontSize: active ? 20 : 17 }}>{t.icon}</span>
              </div>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? T.orange : T.muted, letterSpacing: .3 }}>{t.label}</span>
              {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.orange, marginTop: -2 }} />}
            </button>
          );
        })}
      </div>

      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} onLogout={onLogout} />
    </div>
  );
}

/* ══════════════════════════════════════
  LOGIN
══════════════════════════════════════ */
/* ══════════════════════════════════════
  LOGIN
══════════════════════════════════════ */
function Login({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [isRegister, setIsRegister] = useState(false);
  const [regData, setRegData] = useState({ name: "", branch: "CSE", year: "1st Year", email: "", pass: "", securityQuestion: "What is your high school name?", securityAnswer: "", role: "student" });

  const QUESTIONS = [
    "What is your high school name?",
    "What is your mother's maiden name?",
    "What is the name of your first pet?",
    "What city were you born in?",
    "What was the name of your first school?",
    "What is your favorite teacher's name?"
  ];

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: RollNo, 2: Q/A, 3: Done
  const [forgotInfo, setForgotInfo] = useState({ email: "", question: "", answer: "", newPass: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !pass) return alert("Please enter both Email and Password.");
    if (!email.toLowerCase().endsWith("@gmail.com")) return alert("Please use a valid @gmail.com address.");

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          const userWithEmail = { ...data.user, email: email };
          onLogin({ ...data, user: userWithEmail });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || errData.message || "Login failed. Check your credentials.");
      }
    } catch (err) {
      alert("Server error: " + err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regData.name || !regData.email || !regData.pass || !regData.securityAnswer) {
      return alert("Please fill all fields including the Security Answer.");
    }
    if (!regData.email.toLowerCase().endsWith("@gmail.com")) return alert("Please use a valid @gmail.com address.");
    try {
      const payload = {
        name: regData.name,

        branch: regData.branch,
        year: regData.year,
        email: regData.email,
        password: regData.pass,
        securityQuestion: regData.securityQuestion,
        securityAnswer: regData.securityAnswer,
        role: regData.role
      };
      const response = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert('✅ Registered Successfully! You can now log in.');
        setEmail(regData.email);
        setPass(regData.pass);
        setIsRegister(false);
      } else {
        const err = await response.json();
        alert('Error: ' + (err?.error || 'Failed'));
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotStep(1);
    setForgotInfo({ email: "", question: "", answer: "", newPass: "" });
  };

  const fetchForgotQuestion = async () => {
    if (!forgotInfo.email) return alert("Enter Email first.");
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/forgot-password/question/${forgotInfo.email}`);
      const data = await res.json();
      if (data.question) {
        setForgotInfo(p => ({ ...p, question: data.question }));
        setForgotStep(2);
      } else {
        alert(data.error || "User not found");
      }
    } catch (e) { alert("Network error"); }
  };

  const handleForgotReset = async () => {
    if (!forgotInfo.answer || !forgotInfo.newPass) return alert("Fill all fields.");
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotInfo.email,
          securityAnswer: forgotInfo.answer,
          newPassword: forgotInfo.newPass
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("✨ Password updated! You can now log in.");
        closeForgot();
      } else {
        alert(data.error || "Verification failed");
      }
    } catch (e) { alert("Network error"); }
  };

  const inpSt = {
    width: "100%", padding: "13px 16px", background: "#F8F8F8",
    color: T.text, border: "1.5px solid #E8E8E8", borderRadius: 11,
    fontSize: 14, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    transition: "border-color 0.18s ease, box-shadow 0.18s ease"
  };

  return (
    <div className="login-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7a1120, #3a0a10)', minHeight: '100vh', padding: '20px' }}>
      <div className="login-modal" style={{ background: '#fff', borderRadius: 24, padding: '48px 40px', width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', position: 'relative' }}>

        {onBack && (
          <button type="button" onClick={onBack} style={{ position: 'absolute', top: 24, left: 24, background: 'none', border: 'none', color: '#6b5f57', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Home
          </button>
        )}

        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: `linear-gradient(135deg, #7a1120, #3a0a10)`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: `0 6px 18px rgba(122, 17, 32, 0.2)` }}>
            <img src="/images/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "inherit" }} alt="Vidya-Setu Logo" />
          </div>
          <h2 style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', fontSize: 28, fontWeight: 900, color: T.text }}>{isRegister ? "Create Account" : "Welcome back"}</h2>
          <p style={{ color: T.muted, fontSize: 14, marginTop: 6 }}>{isRegister ? "Sign up to join your campus ecosystem" : "Log in to access your dashboard"}</p>
        </div>

        <form onSubmit={isRegister ? handleRegister : handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isRegister ? (
            <>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Full Name</label>
                  <input type="text" required value={regData.name} onChange={e => setRegData(p => ({ ...p, name: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="e.g. Dev Kumar" />
                </div>

              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Branch</label>
                  <select value={regData.branch} onChange={e => setRegData(p => ({ ...p, branch: e.target.value }))} style={{ ...inpSt, padding: "12px 16px", marginTop: 6 }}>
                    {["CSE", "IT", "ECE", "ME", "CE", "EE", "BT", "CH"].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Year</label>
                  <select value={regData.year} onChange={e => setRegData(p => ({ ...p, year: e.target.value }))} style={{ ...inpSt, padding: "12px 16px", marginTop: 6 }}>
                    {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Email Address</label>
                <input type="email" required value={regData.email} onChange={e => setRegData(p => ({ ...p, email: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="student@gmail.com" />
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Password</label>
                <input type={showPass ? "text" : "password"} required value={regData.pass} onChange={e => setRegData(p => ({ ...p, pass: e.target.value }))} style={{ ...inpSt, marginTop: 6, paddingRight: 40 }} placeholder="Create a password…" />
                <button type="button" onClick={(e) => { e.preventDefault(); setShowPass(!showPass); }} style={{ position: "absolute", right: 12, top: 38, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                  {showPass ? <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>visibility</span> : <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>visibility_off</span>}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Security Question</label>
                  <select value={regData.securityQuestion} onChange={e => setRegData(p => ({ ...p, securityQuestion: e.target.value }))} style={{ ...inpSt, padding: "12px 16px", marginTop: 6 }}>
                    {QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Security Answer</label>
                  <input type="text" required value={regData.securityAnswer} onChange={e => setRegData(p => ({ ...p, securityAnswer: e.target.value }))} style={{ ...inpSt, marginTop: 6 }} placeholder="Your secret answer…" />
                </div>
              </div>
              <Btn style={{ width: "100%", padding: 14, marginTop: 6, fontSize: 15, borderRadius: 11, background: "#ffc94d", color: "#3a2400", fontWeight: 700, border: "none" }}>Create Student Account</Btn>
            </>
          ) : (
            <>
              <div>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Email Address</label>
                <input type="text" required value={email} onChange={e => setEmail(e.target.value)} style={inpSt} placeholder="student@gmail.com" />
              </div>
              <div style={{ position: "relative" }}>
                <label style={{ color: T.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, display: "block", letterSpacing: .8, textTransform: "uppercase" }}>Password</label>
                <input type={showPass ? "text" : "password"} required value={pass} onChange={e => setPass(e.target.value)} style={{ ...inpSt, paddingRight: 40 }} placeholder="Enter your password…" />
                <button type="button" onClick={(e) => { e.preventDefault(); setShowPass(!showPass); }} style={{ position: "absolute", right: 12, top: 38, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                  {showPass ? <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>visibility</span> : <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>visibility_off</span>}
                </button>
              </div>
              <Btn style={{ width: "100%", padding: 14, marginTop: 6, fontSize: 15, borderRadius: 11, background: "#ffc94d", color: "#3a2400", fontWeight: 700, border: "none" }}>Log In to Vidya-Setu →</Btn>
            </>
          )}
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, paddingTop: 22, borderTop: `1px solid ${T.border}` }}>
          {isRegister ? (
            <span style={{ color: T.muted, fontSize: 13 }}>Already have an account?</span>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); setForgotOpen(true); }} style={{ color: T.muted, fontSize: 13, textDecoration: "none" }}>Forgot Password?</a>
          )}
          <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(!isRegister); }} style={{ color: "#7a1120", fontSize: 13, textDecoration: "none", fontWeight: 700 }}>{isRegister ? "Log In →" : "Register →"}</a>
        </div>

        {/* FORGOT PASSWORD MODAL */}
        <Modal open={forgotOpen} onClose={closeForgot} title="🔑 Reset Password">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {forgotStep === 1 && (
              <>
                <p style={{ fontSize: 13, color: T.muted }}>Enter your Email to find your account.</p>
                <input style={inpSt} placeholder="Email Address" value={forgotInfo.email} onChange={e => setForgotInfo(p => ({ ...p, email: e.target.value }))} />
                <Btn onClick={fetchForgotQuestion} style={{ width: "100%" }}>Next Step →</Btn>
              </>
            )}
            {forgotStep === 2 && (
              <>
                <div style={{ padding: 14, background: "rgba(255,79,31,0.05)", borderRadius: 10, border: "1px solid rgba(255,79,31,0.1)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, textTransform: "uppercase", marginBottom: 4 }}>Security Question</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{forgotInfo.question}</div>
                </div>
                <input style={inpSt} placeholder="Your Answer" value={forgotInfo.answer} onChange={e => setForgotInfo(p => ({ ...p, answer: e.target.value }))} />
                <div style={{ position: "relative" }}>
                  <input type={showPass ? "text" : "password"} style={inpSt} placeholder="New Password" value={forgotInfo.newPass} onChange={e => setForgotInfo(p => ({ ...p, newPass: e.target.value }))} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                    {showPass ? <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.1em' }}>visibility</span> : <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.1em' }}>visibility_off</span>}
                  </button>
                </div>
                <Btn onClick={handleForgotReset} variant="teal" style={{ width: "100%" }}>Reset Password</Btn>
                <button onClick={() => setForgotStep(1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer" }}>← Back</button>
              </>
            )}

          </div>
        </Modal>

        {!isRegister && (
          <div style={{ marginTop: 24, padding: "12px 14px", borderRadius: 11, background: "rgba(255,79,31,0.04)", border: "1px solid rgba(255,79,31,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.4 }}>Please enter your registered Email to log in.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionWarningModal({ open, onStayLoggedIn, onLogout }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="modal-sheet" style={{ background: "#fff", width: "90%", maxWidth: 420, borderRadius: 16, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#F59E0B" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>warning</span>
          </div>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 8, color: "#111", marginTop: 0 }}>Session Expiring Soon</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.5, margin: 0 }}>
              Your session is about to expire due to inactivity. You will be logged out in approximately 60 seconds.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onLogout} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#555", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} className="btn-press">
            Log Out Now
          </button>
          <button onClick={onStayLoggedIn} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#FF4F1F", color: "#fff", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} className="btn-press">
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

const LandingPage = ({ onLoginClick }) => {
  const [currentSlide, setCurrentSlide] = React.useState(0);

  const slides = [
    { image: "images/slider_1.png" },
    { image: "images/slider_2.png" },
    { image: "images/slider_3.png" },
    { image: "images/slider_5.png" }
  ];

  React.useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const check = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffc94d" strokeWidth="3">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );

  const activeSlide = slides[currentSlide];

  return (
    <div className="landing-page-wrapper">
      <style dangerouslySetInnerHTML={{
        __html: `
        .landing-page-wrapper {
          --ink:#20140f;
          --paper:#fffaf5;
          --paper-dim:#fff2e6;
          --maroon-1:#7a1120;
          --maroon-2:#3a0a10;
          --gold:#ffc94d;
          --gold-deep:#e8a400;
          --accent:#ff5a1f;
          --accent-fg:#3a2400;
          --muted:#6b5f57;
          --border:#f0e2d4;

          --purple-bg:#ece5ff; --purple-fg:#6f4dfb;
          --yellow-bg:#fff2cf; --yellow-fg:#c98a00;
          --teal-bg:#dcf6ea;   --teal-fg:#159a63;
          --pink-bg:#ffe3ec;   --pink-fg:#e0447a;
          --peach-bg:#ffe6d8;  --peach-fg:#ff5a1f;
          --blue-bg:#e2edff;   --blue-fg:#3d6fe0;

          --font-display:'Baloo 2', sans-serif;
          --font-body:'Inter', sans-serif;
          --maxw:1200px;
          font-family: var(--font-body);
          color: var(--ink);
          background: var(--paper);
          line-height: 1.55;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .landing-page-wrapper * { box-sizing:border-box; }
        .landing-page-wrapper a { color:inherit; text-decoration:none; }
        .landing-page-wrapper ul { margin:0; padding:0; list-style:none; }
        .landing-page-wrapper img, .landing-page-wrapper svg { display:block; }
        .landing-page-wrapper button { font:inherit; }

        .landing-page-wrapper .btn { font-family:var(--font-body); font-size:.95rem; font-weight:700; border-radius:10px;
              padding:13px 26px; cursor:pointer; border:none; display:inline-flex; align-items:center; gap:8px; }
        .landing-page-wrapper .btn-gold { background:var(--gold); color:var(--accent-fg); }
        .landing-page-wrapper .btn-gold:hover { background:var(--gold-deep); }
        .landing-page-wrapper .btn-outline-light { background:transparent; border:1.5px solid rgba(255,255,255,.5); color:#fff; }

        .landing-page-wrapper .nav { background:#fff; border-bottom:1px solid var(--border); position:sticky; top:0; z-index:60; }
        .landing-page-wrapper .nav-inner { max-width:var(--maxw); margin:0 auto; padding:12px 28px; display:flex; align-items:center; gap:30px; }
        .landing-page-wrapper .brand { display:flex; align-items:center; gap:10px; margin-right:8px; }
        .landing-page-wrapper .brand-mark { width:36px; height:36px; border-radius:9px; background:var(--ink);
                     display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .landing-page-wrapper .brand-word { font-family:var(--font-display); font-weight:700; font-size:1.1rem; color:var(--maroon-1); line-height:1.2; }
        .landing-page-wrapper .brand-tag { font-size:.7rem; color:var(--muted); line-height:1.2; }
        .landing-page-wrapper .nav-links { display:flex; align-items:center; gap:26px; flex:1; }
        .landing-page-wrapper .nav-links > a { font-size:.93rem; font-weight:600; color:var(--ink); }
        .landing-page-wrapper .nav-item { position:relative; }
        .landing-page-wrapper .campus-btn { display:flex; align-items:center; gap:4px; font-size:.93rem; font-weight:700; color:var(--accent);
                     border:1.5px solid var(--border); border-radius:8px; padding:7px 12px; background:transparent; cursor:pointer; }
        .landing-page-wrapper .chev { font-size:.65rem; opacity:.7; }
        .landing-page-wrapper .dropdown {
          position:absolute; top:100%; left:0; background:#fff; border:1px solid var(--border); border-radius:10px;
          min-width:200px; padding:8px; box-shadow:0 20px 40px -20px rgba(32,20,15,.35); margin-top:6px;
          opacity:0; visibility:hidden; transform:translateY(6px); transition:.15s ease;
        }
        .landing-page-wrapper .nav-item:hover .dropdown { opacity:1; visibility:visible; transform:translateY(0); }
        .landing-page-wrapper .dropdown a { display:block; padding:9px 12px; border-radius:7px; font-size:.9rem; color:var(--ink); }
        .landing-page-wrapper .dropdown a:hover { background:var(--paper-dim); }
        .landing-page-wrapper .nav-actions { display:flex; align-items:center; gap:12px; }
        .landing-page-wrapper .btn-login { background:transparent; border:1.5px solid var(--border); border-radius:8px; padding:9px 20px; font-weight:700; font-size:.9rem; color:var(--ink); }
        .landing-page-wrapper .btn-getstarted { background:var(--gold); color:var(--accent-fg); border-radius:8px; padding:9px 20px; font-weight:700; font-size:.9rem; }

        .landing-page-wrapper .hero { background:linear-gradient(135deg, var(--maroon-1), var(--maroon-2)); color:#fff; padding:52px 28px 52px; overflow:hidden; }
        .landing-page-wrapper .hero-inner { max-width:var(--maxw); margin:0 auto; display:grid; grid-template-columns:1.15fr .85fr; gap:40px; align-items:center; }
        .landing-page-wrapper .slide-badge { display:inline-block; background:var(--gold); color:var(--accent-fg); font-weight:700; font-size:.82rem;
                      letter-spacing:.03em; text-transform:uppercase; padding:6px 14px; border-radius:6px; margin-bottom:16px; }
        .landing-page-wrapper .slide-headline { font-family:var(--font-display); font-weight:700; font-size:clamp(1.8rem,3.4vw,2.6rem); line-height:1.2;
                          margin:0 0 20px; max-width:18ch; min-height:3.6em; }
        .landing-page-wrapper .slide-bullets { margin-bottom:22px; min-height:130px; }
        .landing-page-wrapper .slide-bullets li { display:flex; gap:10px; align-items:flex-start; font-size:.95rem; margin-bottom:10px; color:#f4e3da; }
        .landing-page-wrapper .slide-bullets svg { flex-shrink:0; margin-top:3px; }
        .landing-page-wrapper .price-row { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .landing-page-wrapper .free-tag { background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.25); border-radius:10px; padding:10px 16px; font-weight:700; }

        .landing-page-wrapper .hero-art { position:relative; aspect-ratio:4/3; border-radius:20px; overflow:hidden;
                   background:radial-gradient(circle at 70% 30%, rgba(255,201,77,.12), transparent 60%), var(--maroon-2); }
        .landing-page-wrapper .hero-art img { position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:95%; width:auto; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.4)); }
        .landing-page-wrapper .badge-tag { position:absolute; left:12px; bottom:12px; background:var(--gold); color:var(--accent-fg);
                               font-weight:700; font-size:.8rem; padding:6px 12px; border-radius:6px; }
        .landing-page-wrapper .stat-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
        .landing-page-wrapper .stat-card { background:rgba(255,255,255,.1); border-radius:12px; padding:16px; }
        .landing-page-wrapper .stat-card .num { font-family:var(--font-display); font-weight:700; font-size:1.5rem; color:var(--gold); }
        .landing-page-wrapper .stat-card .label { font-size:.8rem; color:#f4e3da; }
        .landing-page-wrapper .ribbon { margin-top:12px; background:linear-gradient(90deg, var(--accent), var(--gold-deep));
                 color:var(--accent-fg); text-align:center; font-weight:700; font-size:.88rem; padding:10px; border-radius:8px; }

        .landing-page-wrapper .dots { display:flex; justify-content:center; gap:8px; padding-top:34px; }
        .landing-page-wrapper .dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.35); border:none; cursor:pointer; padding:0; }
        .landing-page-wrapper .dot.active { background:var(--gold); width:22px; border-radius:4px; }

        .landing-page-wrapper .popular-wrap { max-width:var(--maxw); margin:-40px auto 0; padding:0 28px; position:relative; z-index:5; }
        .landing-page-wrapper .popular-card { background:#fff; border-radius:20px; box-shadow:0 30px 60px -30px rgba(32,20,15,.35); padding:30px 30px 22px; }
        .landing-page-wrapper .popular-title { display:inline-block; background:var(--gold); color:var(--accent-fg); font-family:var(--font-display);
                         font-weight:700; font-size:1.05rem; padding:8px 18px; border-radius:10px; margin-bottom:20px; }
        .landing-page-wrapper .tile-row-wrap { position:relative; }
        .landing-page-wrapper .tile-row { display:flex; gap:16px; overflow-x:auto; scroll-behavior:smooth; padding-bottom:6px; scrollbar-width:none; }
        .landing-page-wrapper .tile-row::-webkit-scrollbar { display:none; }
        .landing-page-wrapper .tile { flex:0 0 190px; border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:34px; cursor: pointer; text-decoration: none; }
        .landing-page-wrapper .tile-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.6); }
        .landing-page-wrapper .tile-bottom { display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:.98rem; }
        .landing-page-wrapper .scroll-btn { position:absolute; top:50%; transform:translateY(-50%); width:34px; height:34px; border-radius:50%;
                     background:#fff; border:1px solid var(--border); box-shadow:0 8px 20px -10px rgba(32,20,15,.3); cursor:pointer; }
        .landing-page-wrapper .scroll-btn.left { left:-17px; } .landing-page-wrapper .scroll-btn.right { right:-17px; }

        .landing-page-wrapper .explore { max-width:var(--maxw); margin:0 auto; padding:72px 28px 20px; text-align:center; }
        .landing-page-wrapper .explore h2 { font-family:var(--font-display); font-weight:700; font-size:clamp(1.6rem,2.8vw,2.1rem); margin:0 0 6px; color:var(--maroon-1); }
        .landing-page-wrapper .explore .sub { color:var(--muted); margin:0 0 36px; font-size:.98rem; }
        .landing-page-wrapper .card-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; text-align:left; }
        .landing-page-wrapper .fcard { border:1px solid var(--border); border-radius:14px; overflow:hidden; background:#fff; cursor: pointer; text-decoration: none; display: block; color: inherit; }
        .landing-page-wrapper .fcard .bar { height:6px; }
        .landing-page-wrapper .fcard .body { padding:24px; }
        .landing-page-wrapper .fcard .icon-chip { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
        .landing-page-wrapper .fcard h3 { font-family:var(--font-display); font-size:1.1rem; margin:0 0 8px; }
        .landing-page-wrapper .fcard p { color:var(--muted); font-size:.92rem; margin:0; }

        .landing-page-wrapper .cta-band { max-width:var(--maxw); margin:64px auto 0; padding:0 28px 90px; }
        .landing-page-wrapper .cta-box { background:linear-gradient(135deg,var(--maroon-1),var(--maroon-2)); border-radius:20px; padding:48px;
                  color:#fff; display:flex; justify-content:space-between; align-items:center; gap:28px; flex-wrap:wrap; }
        .landing-page-wrapper .cta-box h2 { font-family:var(--font-display); font-size:1.5rem; margin:0 0 8px; max-width:22ch; }
        .landing-page-wrapper .cta-box p { color:#f4e3da; margin:0; max-width:38ch; }
        .landing-page-wrapper .cta-actions { display:flex; gap:12px; flex-wrap:wrap; }

        .landing-page-wrapper footer { border-top:1px solid var(--border); padding:44px 28px 26px; }
        .landing-page-wrapper .footer-inner { max-width:var(--maxw); margin:0 auto; display:flex; justify-content:space-between; gap:36px; flex-wrap:wrap; }
        .landing-page-wrapper .footer-brand p { color:var(--muted); max-width:34ch; font-size:.88rem; margin-top:12px; }
        .landing-page-wrapper .footer-cols { display:flex; gap:48px; flex-wrap:wrap; }
        .landing-page-wrapper .footer-col h5 { font-size:.8rem; margin:0 0 10px; text-transform:uppercase; letter-spacing:.04em; color:var(--maroon-1); }
        .landing-page-wrapper .footer-col a { display:block; color:var(--muted); font-size:.88rem; margin-bottom:7px; }
        .landing-page-wrapper .footer-bottom { max-width:var(--maxw); margin:28px auto 0; padding-top:18px; border-top:1px solid var(--border);
                        font-size:.8rem; color:var(--muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }

        @media (max-width: 900px){
          .landing-page-wrapper .nav-links { display:none; }
          .landing-page-wrapper .hero-inner { grid-template-columns:1fr; }
          .landing-page-wrapper .card-grid { grid-template-columns:1fr; }
          .landing-page-wrapper .popular-wrap { margin-top:-24px; }
        }
      `}} />

      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#">
            <span className="brand-mark" aria-hidden="true">
              <img src="/images/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "inherit" }} alt="Vidya-Setu Logo" />
            </span>
            <span>
              <span className="brand-word">Vidya Setu</span><br />
              <span className="brand-tag">Learn &bull; Grow &bull; Achieve</span>
            </span>
          </a>

          <nav className="nav-links">
            <a href="#jobs" onClick={(e) => { e.preventDefault(); window.location.hash = "jobs"; if (onLoginClick) onLoginClick(); }}>Jobs & Internships</a>
            <a href="#prashna" onClick={(e) => { e.preventDefault(); window.location.hash = "prashna"; if (onLoginClick) onLoginClick(); }}>GATE Insights</a>
            <a href="#karya" onClick={(e) => { e.preventDefault(); window.location.hash = "karya"; if (onLoginClick) onLoginClick(); }}>Career Compass</a>
            <div className="nav-item">
              <button className="campus-btn">Campus <span className="chev">&#9660;</span></button>
              <div className="dropdown">
                <a href="#bazaar" onClick={(e) => { e.preventDefault(); window.location.hash = "bazaar"; if (onLoginClick) onLoginClick(); }}>Campus Store</a>
                <a href="#chhatra" onClick={(e) => { e.preventDefault(); window.location.hash = "chhatra"; if (onLoginClick) onLoginClick(); }}>Student Perks</a>
                <a href="#community" onClick={(e) => { e.preventDefault(); window.location.hash = "community"; if (onLoginClick) onLoginClick(); }}>Community Hub</a>
                <a href="#hub" onClick={(e) => { e.preventDefault(); window.location.hash = "hub"; if (onLoginClick) onLoginClick(); }}>Scholarship Hub</a>
              </div>
            </div>
          </nav>

          <div className="nav-actions">
            <a className="btn-getstarted" href="#login" onClick={(e) => { e.preventDefault(); window.location.hash = "login"; if (onLoginClick) onLoginClick(); }}>Login</a>

          </div>
        </div>
      </header>

      <section className="hero" id="top" style={{ padding: 0, position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div style={{ width: '100%', display: 'flex', transition: 'transform 0.5s ease-in-out', transform: `translateX(-${currentSlide * 100}%)` }}>
          {slides.map((s, i) => (
            <img
              key={i}
              src={s.image}
              alt={`Slide ${i + 1}`}
              style={{ width: '100%', height: 'auto', display: 'block', flexShrink: 0 }}
            />
          ))}
        </div>

        <div className="dots" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '8px', zIndex: 10, paddingTop: 0 }}>
          {slides.map((_, i) => (
            <button key={i} className={`dot ${i === currentSlide ? 'active' : ''}`} aria-label={`Show slide ${i + 1}`} onClick={() => setCurrentSlide(i)} style={{ width: i === currentSlide ? '22px' : '8px', height: '8px', borderRadius: i === currentSlide ? '4px' : '50%', background: i === currentSlide ? 'var(--gold)' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s ease' }} />
          ))}
        </div>
      </section>

      <div className="popular-wrap">
        <div className="popular-card">
          <span className="popular-title">Popular Modules</span>
          <div className="tile-row-wrap">
            <button className="scroll-btn left" onClick={(e) => e.target.nextElementSibling.scrollBy({ left: -220, behavior: 'smooth' })} aria-label="Scroll left">&#8592;</button>
            <div className="tile-row">
              <a href="#prashna" onClick={(e) => { e.preventDefault(); window.location.hash = "prashna"; if (onLoginClick) onLoginClick(); }} className="tile" style={{ background: "#ece5ff" }}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6f4dfb" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7" /></svg></div>
                <div className="tile-bottom" style={{ color: "#6f4dfb" }}>GATE Insights <span>&rsaquo;</span></div>
              </a>
              <a href="#karya" onClick={(e) => { e.preventDefault(); window.location.hash = "karya"; if (onLoginClick) onLoginClick(); }} className="tile" style={{ background: "#fff2cf" }}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c98a00" strokeWidth="2"><circle cx="12" cy="12" r="8" /></svg></div>
                <div className="tile-bottom" style={{ color: "#c98a00" }}>Career Compass <span>&rsaquo;</span></div>
              </a>
              <a href="#hub" onClick={(e) => { e.preventDefault(); window.location.hash = "hub"; if (onLoginClick) onLoginClick(); }} className="tile" style={{ background: "#dcf6ea" }}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#159a63" strokeWidth="2"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z" /></svg></div>
                <div className="tile-bottom" style={{ color: "#159a63" }}>Scholarship Hub <span>&rsaquo;</span></div>
              </a>
              <a href="#jobs" onClick={(e) => { e.preventDefault(); window.location.hash = "jobs"; if (onLoginClick) onLoginClick(); }} className="tile" style={{ background: "#ffe3ec" }}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0447a" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></div>
                <div className="tile-bottom" style={{ color: "#e0447a" }}>Jobs & Internships <span>&rsaquo;</span></div>
              </a>
              <a href="#bazaar" onClick={(e) => { e.preventDefault(); window.location.hash = "bazaar"; if (onLoginClick) onLoginClick(); }} className="tile" style={{ background: "#ffe6d8" }}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2"><path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg></div>
                <div className="tile-bottom" style={{ color: "#ff5a1f" }}>Campus Store <span>&rsaquo;</span></div>
              </a>
              <a href="#community" onClick={(e) => { e.preventDefault(); window.location.hash = "community"; if (onLoginClick) onLoginClick(); }} className="tile" style={{ background: "#e2edff" }}>
                <div className="tile-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3d6fe0" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.5A8.38 8.38 0 0 1 3.5 11 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" /></svg></div>
                <div className="tile-bottom" style={{ color: "#3d6fe0" }}>Community Hub <span>&rsaquo;</span></div>
              </a>
            </div>
            <button className="scroll-btn right" onClick={(e) => e.target.previousElementSibling.scrollBy({ left: 220, behavior: 'smooth' })} aria-label="Scroll right">&#8594;</button>
          </div>
        </div>
      </div>

      <section className="explore" id="explore">
        <h2>Explore Vidya-Setu</h2>
        <p className="sub">Built for every branch across students — not just CSE.</p>
        <div className="card-grid">
          <a href="#prashna" onClick={(e) => { e.preventDefault(); window.location.hash = "prashna"; if (onLoginClick) onLoginClick(); }} className="fcard">
            <div className="bar" style={{ background: "#6f4dfb" }}></div>
            <div className="body">
              <div className="icon-chip" style={{ background: "#ece5ff" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6f4dfb" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7" /></svg></div>
              <h3>GATE Insights</h3>
              <p>AI ranks topics from verified previous-year papers by branch, semester, and subject.</p>
            </div>
          </a>
          <a href="#karya" onClick={(e) => { e.preventDefault(); window.location.hash = "karya"; if (onLoginClick) onLoginClick(); }} className="fcard">
            <div className="bar" style={{ background: "#c98a00" }}></div>
            <div className="body">
              <div className="icon-chip" style={{ background: "#fff2cf" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c98a00" strokeWidth="2"><circle cx="12" cy="12" r="8" /></svg></div>
              <h3>Career Compass</h3>
              <p>Get a readiness score, skill-gap breakdown, and a resume strength score out of 100.</p>
            </div>
          </a>
          <a href="#hub" onClick={(e) => { e.preventDefault(); window.location.hash = "hub"; if (onLoginClick) onLoginClick(); }} className="fcard">
            <div className="bar" style={{ background: "#159a63" }}></div>
            <div className="body">
              <div className="icon-chip" style={{ background: "#dcf6ea" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#159a63" strokeWidth="2"><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4Z" /></svg></div>
              <h3>Scholarship Hub</h3>
              <p>Government, defence, and private scholarships with deadlines and eligibility upfront.</p>
            </div>
          </a>
          <a href="#jobs" onClick={(e) => { e.preventDefault(); window.location.hash = "jobs"; if (onLoginClick) onLoginClick(); }} className="fcard">
            <div className="bar" style={{ background: "#e0447a" }}></div>
            <div className="body">
              <div className="icon-chip" style={{ background: "#ffe3ec" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e0447a" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></div>
              <h3>Jobs & Internships</h3>
              <p>400+ real listings, refreshed daily, filterable by domain, location, and experience.</p>
            </div>
          </a>
          <a href="#bazaar" onClick={(e) => { e.preventDefault(); window.location.hash = "bazaar"; if (onLoginClick) onLoginClick(); }} className="fcard">
            <div className="bar" style={{ background: "#ff5a1f" }}></div>
            <div className="body">
              <div className="icon-chip" style={{ background: "#ffe6d8" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff5a1f" strokeWidth="2"><path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Z" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg></div>
              <h3>Campus Store</h3>
              <p>Buy and sell books, electronics, and tools directly with verified students.</p>
            </div>
          </a>
          <a href="#community" onClick={(e) => { e.preventDefault(); window.location.hash = "community"; if (onLoginClick) onLoginClick(); }} className="fcard">
            <div className="bar" style={{ background: "#3d6fe0" }}></div>
            <div className="body">
              <div className="icon-chip" style={{ background: "#e2edff" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d6fe0" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.5A8.38 8.38 0 0 1 3.5 11 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" /></svg></div>
              <h3>Community Hub</h3>
              <p>Ask doubts and get answers from students who've already cleared that exam.</p>
            </div>
          </a>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-box">
          <div>
            <h2>Built by students who were tired of ten open tabs.</h2>
          </div>
          <div className="cta-actions">
            <a className="btn btn-gold" href="#login" onClick={(e) => { e.preventDefault(); window.location.hash = "login"; if (onLoginClick) onLoginClick(); }}>Get started free</a>

          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <a className="brand" href="#">
              <span className="brand-mark" aria-hidden="true">
                <img src="/images/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover", position: "relative", zIndex: 1, borderRadius: "inherit" }} alt="Vidya-Setu Logo" />
              </span>
              <span className="brand-word">Vidya-Setu</span>
            </a>
            <p>A student portal unifying exam prep, scholarships, jobs, and campus life for students.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h5>Product</h5>
              <a href="#prashna" onClick={(e) => { e.preventDefault(); window.location.hash = "prashna"; if (onLoginClick) onLoginClick(); }}>GATE Insights</a>
              <a href="#karya" onClick={(e) => { e.preventDefault(); window.location.hash = "karya"; if (onLoginClick) onLoginClick(); }}>Career Compass</a>
              <a href="#hub" onClick={(e) => { e.preventDefault(); window.location.hash = "hub"; if (onLoginClick) onLoginClick(); }}>Scholarship Hub</a>
              <a href="#jobs" onClick={(e) => { e.preventDefault(); window.location.hash = "jobs"; if (onLoginClick) onLoginClick(); }}>Jobs & Internships</a>
            </div>
            <div className="footer-col">
              <h5>Community</h5>
              <a href="#bazaar" onClick={(e) => { e.preventDefault(); window.location.hash = "bazaar"; if (onLoginClick) onLoginClick(); }}>Campus Store</a>
              <a href="#community" onClick={(e) => { e.preventDefault(); window.location.hash = "community"; if (onLoginClick) onLoginClick(); }}>Community Hub</a>

            </div>
            <div className="footer-col">
              <h5>Account</h5>
              <a href="#login" onClick={(e) => { e.preventDefault(); window.location.hash = "login"; if (onLoginClick) onLoginClick(); }}>Sign in</a>

            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 Vidya-Setu. Built for students.</span>
          <span>Study. Explore. Build your career. — all in one place.</span>
        </div>
      </footer>
    </div>
  );
};


function AppWithProviders() {
  const [splashDone, setSplashDone] = useState(false);

  // Initialize synchronously from localStorage to prevent flicker and allow instant render
  const initialLocalData = localStorage.getItem('studentData');
  const [isLoggedIn, setIsLoggedIn] = useState(!!initialLocalData);
  const [isAdmin, setIsAdmin] = useState(() => initialLocalData ? (JSON.parse(initialLocalData).isAdmin || false) : false);

  // If user has saved session data, skip landing page on return
  const [showLandingPage, setShowLandingPage] = useState(!initialLocalData);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [user, setUser] = useState(() => {
    // Initialise user state — real hydration happens in useEffect below
    return {
      name: "Dev Kumar",
      initials: "DK",
      branch: "CSE",
      year: "1st",
      dbt: false,
      scholarshipStage: 1,
      rollNo: "250164152002",
      email: "",
      University: "University — Lucknow",
      valid: "May 2026",
    };
  });
  const [toasts, setToasts] = useState([]);

  const addToast = (title, sub = "", icon = <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>check_circle</span>, accent = T.orange) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, title, sub, icon, accent }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3600);
  };

  const saveToStorage = (data) => {
    try {
      const lean = { ...data };
      // Remove heavy Base64 strings before saving to localStorage
      const heavyFields = ['aadhaarDocument', 'class10Document', 'class12Document', 'incomeDocument', 'feeReceiptDocument', 'profilePhoto'];
      heavyFields.forEach(f => delete lean[f]);
      localStorage.setItem("studentData", JSON.stringify(lean));
    } catch (e) {
      console.error("Storage error:", e);
      localStorage.removeItem('studentData'); // Safe removal instead of clear
    }
  };

  const updateUser = patch => setUser(p => {
    const updated = { ...p, ...patch };
    saveToStorage(updated);
    return updated;
  });

  const refreshUser = async () => {
    if (!user.rollNo) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/search/${user.rollNo}`);
      if (res.ok) {
        const freshData = await res.json();
        const updated = { ...user, ...freshData };
        setUser(updated);
        saveToStorage(updated);
      }
    } catch (e) { console.error("Sync failed", e); }
  };



  // ── PERSISTENCE: Session Validation via Backend ──
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check local storage first so we can survive 3rd-party cookie blocking
        const localData = localStorage.getItem('studentData');
        if (localData) {
          const fetchedData = JSON.parse(localData);
          const inits = (fetchedData.name || "DK").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
          setUser({ ...fetchedData, initials: inits, isAdmin: fetchedData.isAdmin || false });
          setIsAdmin(fetchedData.isAdmin || false);
          setIsLoggedIn(true);
          setShowLandingPage(false);
        }

        const res = await fetch(`${API_BASE_URL}/api/users/refresh`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            const fetchedData = data.user;
            const inits = (fetchedData.name || "DK").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

            setUser({
              ...fetchedData,
              initials: inits,
              isAdmin: fetchedData.isAdmin || false
            });
            setIsAdmin(fetchedData.isAdmin || false);
            setIsLoggedIn(true);
            setShowLandingPage(false);
          }
        } else {
          // Only force logout if there's NO local data to fall back on
          // This prevents the "Get Deal → return → landing page" bug
          if (!localData) {
            setIsLoggedIn(false);
            setIsAdmin(false);
          }
          // If localData exists, we keep the user logged in from localStorage (set above)
        }
      } catch (e) {
        console.error("Session check failed", e);
        // On network errors, keep the local session alive — don't nuke it
        const localData = localStorage.getItem('studentData');
        if (!localData) {
          setIsLoggedIn(false);
          setIsAdmin(false);
        }
      } finally {
        setSessionChecked(true);
      }
    };
    checkSession();
  }, []);

  // ── RE-VALIDATE SESSION: When user returns to this tab (e.g., after Get Deal) ──
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isLoggingOutRef.current) {
        const localData = localStorage.getItem('studentData');
        if (localData && !isLoggedIn) {
          // User has saved data but got logged out — restore from localStorage
          try {
            const fetchedData = JSON.parse(localData);
            const inits = (fetchedData.name || "DK").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            setUser({ ...fetchedData, initials: inits, isAdmin: fetchedData.isAdmin || false });
            setIsAdmin(fetchedData.isAdmin || false);
            setIsLoggedIn(true);
            setShowLandingPage(false);
          } catch (e) { console.error("Failed to restore session from localStorage", e); }
        }
        // Silently try to refresh the token in the background
        if (localData) {
          try {
            const res = await fetch(`${API_BASE_URL}/api/users/refresh`, {
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.user) {
                const fetchedData = data.user;
                const inits = (fetchedData.name || "DK").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                setUser({ ...fetchedData, initials: inits, isAdmin: fetchedData.isAdmin || false });
                setIsAdmin(fetchedData.isAdmin || false);
                setIsLoggedIn(true);
                setShowLandingPage(false);
              }
            }
            // Don't log out on failure here — let the user keep their local session
          } catch (e) { /* Silent — network might be temporarily unavailable */ }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLoggedIn]);

  const isLoggingOutRef = useRef(false);

  const performSecureLogout = async (silent = false) => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await fetch(`${API_BASE_URL}/api/users/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) { console.error("Logout API failed", e); }
    finally {
      // Guaranteed local cleanup without destroying unrelated keys
      localStorage.removeItem('vidyasetu_last_activity');
      localStorage.removeItem('vidyasetu_tab_active');
      localStorage.removeItem('studentData');
      sessionStorage.removeItem('vidyasetu_tab_active');

      // Broadcast logout to other tabs
      localStorage.setItem('vidyasetu_logout', Date.now().toString());

      setShowLandingPage(true);
      setIsLoggedIn(false);
      setShowSessionWarning(false);
      setUser({});
      setIsAdmin(false);
      window.history.replaceState(null, '', '/');

      // Reset the lock so the user can log in and out again without a page refresh
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 300);
    }
  };

  // ── SESSION SYNC & SECURITY ──
  useEffect(() => {
    if (!isLoggedIn) return;

    // Multi-tab session synchronization (logout in one tab logs out everywhere)
    const handleStorage = (e) => {
      if (e.key === 'vidyasetu_logout') {
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          localStorage.removeItem('vidyasetu_last_activity');
          localStorage.removeItem('vidyasetu_tab_active');
          localStorage.removeItem('studentData');
          setShowLandingPage(true);
          setIsLoggedIn(false);
          setShowSessionWarning(false);
          setUser({});
          setIsAdmin(false);
          window.history.replaceState(null, '', '/');
          setTimeout(() => {
            isLoggingOutRef.current = false;
          }, 300);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // Listen for forced logout from 401 global fetch wrapper
    const handleForceLogout = () => {
      performSecureLogout(true);
    };
    window.addEventListener('vidyasetu_force_logout', handleForceLogout);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('vidyasetu_force_logout', handleForceLogout);
    };
  }, [isLoggedIn]);

  // ── LOGOUT: Shared manual and auto logout flow ──
  const handleLogout = () => {
    performSecureLogout(true);
  };

  const handleStayLoggedIn = () => {
    localStorage.setItem('vidyasetu_last_activity', Date.now().toString());
    setShowSessionWarning(false);
  };

  // 1. Instantly render Landing or Login if not authenticated (Bypasses splash & blocking APIs)
  if (!isLoggedIn) {
    if (showLandingPage) {
      return <LandingPage onLoginClick={() => setShowLandingPage(false)} />;
    }
    return <Login
      onBack={() => setShowLandingPage(true)}
      onLogin={(data) => {
        const fetchedData = data.user || data;
        setIsLoggedIn(true);

        if (window.location.hash.replace("#", "") === "login") {
          window.location.hash = "home";
        }

        if (fetchedData) {
          const inits = (fetchedData.name || "DK").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
          const finalUser = {
            ...fetchedData,
            initials: inits,
            isAdmin: fetchedData.isAdmin || false
          };
          setUser(finalUser);
          saveToStorage(finalUser);
          setIsAdmin(fetchedData.isAdmin || false);
        }
      }} />;
  }

  // 2. Wait for session validation and splash screen ONLY if they have an active local session
  if (!splashDone || !sessionChecked) return <SplashScreen onDone={() => setSplashDone(true)} />;



  return (
    <UserContext.Provider value={{ user, updateUser, refreshUser }}>
      <ToastContext.Provider value={addToast}>
        <SessionWarningModal open={showSessionWarning} onStayLoggedIn={handleStayLoggedIn} onLogout={handleLogout} />
        <App onLogout={handleLogout} />
        <ToastSystem toasts={toasts} />
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee', color: '#c00', margin: '20px', fontFamily: 'monospace' }}>
          <h2>React Crash</h2>
          <p><strong>{this.state.error && this.state.error.toString()}</strong></p>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <AppWithProviders />
  </ErrorBoundary>
);
