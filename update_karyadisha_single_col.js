const fs = require('fs');

const file = 'Frontend/index.html';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('function KaryaDisha() {'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('/* ══════════════════════════════════════') && lines[i+1] && lines[i+1].includes('AI ASSISTANT'));

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find KaryaDisha boundaries');
  process.exit(1);
}

const newComponent = `    function KaryaDisha() {
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
            const resp = await fetch(\`\${API_BASE_URL}/api/academic/roles\`);
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
        
        addToast(levelText, \`\${result.pct}% match for \${role}\`, <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '1.2em' }}>{levelIcon}</span>, levelColor);

        try {
           const history = JSON.parse(localStorage.getItem('karyaDishaHistory') || '[]');
           history.push({ date: new Date().toISOString(), role, pct: result.pct });
           if (history.length > 10) history.shift();
           localStorage.setItem('karyaDishaHistory', JSON.stringify(history));
        } catch (e) {}

        setAiResponse({ gap: null, roadmap: null, projects: null, loading: false, error: null });
        setJobMatches([]);
      };
      
      const callAi = async (type) => {
        if (!res) return;
        setAiResponse(prev => ({ ...prev, loading: true, error: null }));
        
        try {
           const resp = await fetch(\`\${API_BASE_URL}/api/ai/career-analyze\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 type,
                 role,
                 skills: Object.keys(skills),
                 missingSkills: res.missingCore,
                 coreSkills: rolesData[role].req || [],
                 bonusSkills: rolesData[role].nice || [],
                 readiness: res.pct,
                 userContext: { name: user?.name, rollNo: user?.rollNo, branch: user?.branch, year: user?.year }
              })
           });
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
              throw new Error("AI error");
           }
        } catch (e) {
           setAiResponse(prev => ({ ...prev, loading: false, error: "AI is currently unavailable. Please try again later." }));
           addToast("AI Error", "Could not reach AI services", "❌", T.rose);
        }
      };

      const findJobs = async () => {
         if (!res || !role) return;
         setLoadingJobs(true);
         try {
            const resp = await fetch(\`\${API_BASE_URL}/api/jobs?limit=100\`);
            const data = await resp.json();
            if (data.jobs && Array.isArray(data.jobs)) {
               const matched = data.jobs.map(j => {
                  let matchScore = 0;
                  const jobText = \`\${j.title} \${j.tags.join(" ")} \${j.desc}\`.toLowerCase();
                  
                  let matchedTags = 0;
                  const mySkills = Object.keys(skills);
                  mySkills.forEach(s => {
                     if (jobText.includes(s.toLowerCase())) matchedTags++;
                  });
                  const maxTags = Math.max(5, (j.tags || []).length);
                  matchScore += Math.min((matchedTags / maxTags) * 60, 60);

                  if (j.title.toLowerCase().includes(role.toLowerCase().split(" ")[0])) matchScore += 20;
                  if (j.branch === user?.branch) matchScore += 20;

                  return { ...j, compatibility: Math.round(matchScore) };
               }).filter(j => j.compatibility >= 30).sort((a, b) => b.compatibility - a.compatibility).slice(0, 5);
               setJobMatches(matched);
            }
         } catch (e) {
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
         return text.split('\\n').map((line, i) => {
            if (line.startsWith('###')) return <h4 key={i} style={{ fontSize: 14, fontWeight: 600, margin: "14px 0 6px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h4>;
            if (line.startsWith('##')) return <h3 key={i} style={{ fontSize: 15, fontWeight: 600, margin: "16px 0 8px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h3>;
            if (line.startsWith('-')) return <li key={i} style={{ marginLeft: 20, marginBottom: 4, color: "#4B5563", fontSize: 13 }} dangerouslySetInnerHTML={{ __html: line.substring(1).trim().replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} style={{ marginBottom: 6, lineHeight: 1.5, color: "#4B5563", fontSize: 13 }} dangerouslySetInnerHTML={{ __html: line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />;
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
              <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 26, fontWeight: 800, color: "#1F2937", margin: 0, marginTop: 12, lineHeight: 1.15, letterSpacing: '-0.2px' }}>Skill Matcher</h1>
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
                             border: \`1px solid \${active ? "#FFD5CC" : "#E5E7EB"}\`, 
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
                                 <span style={{ fontSize: 14, color: "#374151" }}>{i+1}. {p.name}</span>
                                 <span style={{ fontSize: 12, background: p.priority==="High" ? "#FEE2E2" : "#F3F4F6", color: p.priority==="High" ? "#991B1B" : "#4B5563", padding: "4px 10px", borderRadius: 4, fontWeight: 600 }}>{p.priority}</span>
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
                              {aiResponse.gap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: "#1F2937" }}>Skill Gap Analysis</div><div>{renderAiText(aiResponse.gap)}</div></div>}
                              {aiResponse.roadmap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: "#1F2937" }}>30-Day Action Plan</div><div>{renderAiText(aiResponse.roadmap)}</div></div>}
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
                           <div style={{ padding: 16, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 6 }}>{renderAiText(aiResponse.projects)}</div>
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
`

lines.splice(startIdx, endIdx - startIdx, newComponent);
fs.writeFileSync(file, lines.join('\n'));
console.log('Successfully updated KaryaDisha in Frontend/index.html');
