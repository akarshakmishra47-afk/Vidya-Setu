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
      const [activeTab, setActiveTab] = React.useState("overview");

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
        setActiveTab("overview");
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
            if (line.startsWith('###')) return <h4 key={i} style={{ fontSize: 16, fontWeight: 700, margin: "16px 0 8px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h4>;
            if (line.startsWith('##')) return <h3 key={i} style={{ fontSize: 18, fontWeight: 700, margin: "20px 0 10px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h3>;
            if (line.startsWith('-')) return <li key={i} style={{ marginLeft: 20, marginBottom: 6, color: "#4B5563" }} dangerouslySetInnerHTML={{ __html: line.substring(1).trim().replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} style={{ marginBottom: 8, lineHeight: 1.6, color: "#4B5563" }} dangerouslySetInnerHTML={{ __html: line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />;
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
          <div className="screen-hero" style={{ background: "#FAFAFA", padding: "36px 44px", borderBottom: "1px solid #E5E5E5" }}>
            <div className="screen-hero-inner">
              <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 28, fontWeight: 800, color: "#1F2937", margin: 0, letterSpacing: '-0.4px' }}>🎯 Skill Matcher</h1>
              <p style={{ color: "#6B7280", fontSize: 15, marginTop: 8, margin: "8px 0 0 0" }}>Analyze your skills, find gaps, and plan your career path.</p>
            </div>
          </div>

          <div className="screen-body" style={{ background: "#FAFAFA", padding: "32px 44px 72px" }}>
            {loadingData ? (
               <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 14 }}>Loading career data...</div>
            ) : (
               <div className="two-panel-3-2">
                 {/* LEFT — Career Setup Card */}
                 <div className="section-block">
                   <Card style={{ padding: 24, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                     <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20, color: "#1F2937" }}>Profile Setup</div>
                     
                     <label style={{ display: "block", color: "#4B5563", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Target Role</label>
                     <div style={{ position: "relative", marginBottom: 24 }}>
                       <select value={role} onChange={e => { setRole(e.target.value); setRes(null); }} style={{ width: "100%", padding: "12px 14px", background: "#FFFFFF", color: role ? "#1F2937" : "#6B7280", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none", appearance: "none" }}>
                         <option value="">Select a career role...</option>
                         {Object.keys(rolesData).map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                       <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none" }}>▼</span>
                     </div>

                     <label style={{ display: "block", color: "#4B5563", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Your Skills (Tap to cycle proficiency)</label>
                     <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                       {allSkills.map(s => {
                         const lvl = skills[s];
                         const active = !!lvl;
                         return (
                           <button key={s} onClick={() => toggleSkill(s)} 
                             style={{ 
                               background: active ? "#FFF0ED" : "#FFFFFF", 
                               color: active ? "#FF4F1F" : "#4B5563", 
                               border: \`1px solid \${active ? "#FFD5CC" : "#E5E7EB"}\`, 
                               borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: active ? 600 : 400, 
                               cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .15s ease" 
                             }}>
                             {s}
                             {lvl === "Beginner" && <span style={{ fontSize: 11, background: "#FF4F1F", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>Beg</span>}
                             {lvl === "Intermediate" && <span style={{ fontSize: 11, background: "#FF4F1F", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>Int</span>}
                             {lvl === "Advanced" && <span style={{ fontSize: 11, background: "#FF4F1F", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>Adv</span>}
                           </button>
                         );
                       })}
                     </div>

                     <Btn onClick={analyze} variant="primary" disabled={!role || Object.keys(skills).length === 0} style={{ width: "100%", padding: 12, fontSize: 14, background: "#FF4F1F", borderRadius: 8, boxShadow: "0 2px 4px rgba(255,79,31,0.2)" }}>Analyze Readiness</Btn>
                   </Card>
                 </div>

                 {/* RIGHT — Results Area */}
                 <div className="section-block">
                   {!res ? (
                     <Card style={{ padding: "48px 24px", textAlign: "center", borderRadius: 10, border: "1px dashed #D1D5DB", boxShadow: "none", background: "#FFFFFF" }}>
                       <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                       <div style={{ fontWeight: 600, fontSize: 16, color: "#1F2937", marginBottom: 8 }}>Awaiting Analysis</div>
                       <div style={{ color: "#6B7280", fontSize: 14 }}>Select your skills and target role to view your readiness and career insights.</div>
                     </Card>
                   ) : (
                     <>
                       {/* Tabs */}
                       <div style={{ display: "flex", gap: 4, padding: "4px", background: "#F3F4F6", borderRadius: 8, marginBottom: 16, overflowX: "auto", border: "1px solid #E5E7EB" }}>
                         {["Overview", "AI Insights", "Career Explorer", "Growth"].map(t => {
                            const id = t.toLowerCase().split(" ")[0];
                            const active = activeTab === id;
                            return (
                               <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "8px 12px", background: active ? "#FFFFFF" : "transparent", color: active ? "#1F2937" : "#6B7280", border: active ? "1px solid #E5E7EB" : "1px solid transparent", borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none", whiteSpace: "nowrap", transition: "all .1s ease" }}>{t}</button>
                            );
                         })}
                       </div>

                       {/* TAB CONTENT: Overview */}
                       {activeTab === "overview" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                             <Card style={{ padding: 24, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                   <div>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: "#1F2937" }}>{role}</div>
                                      <div style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>{res.pct}% Ready for this role</div>
                                   </div>
                                   <div style={{ fontSize: 32, fontWeight: 800, color: mc(res.pct) }}>{res.pct}%</div>
                                </div>
                                <PBar value={res.pct} color={mc(res.pct)} h={8} />
                             </Card>

                             <Card style={{ padding: 20, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ fontWeight: 600, fontSize: 16, color: "#1F2937", marginBottom: 16 }}>Skill Analysis</div>
                                
                                {res.strong.length > 0 && (
                                   <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Strong Skills</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                         {res.strong.map(s => <span key={s} style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "3px 10px", borderRadius: 16, fontSize: 12 }}>{s}</span>)}
                                      </div>
                                   </div>
                                )}

                                {res.developing.length > 0 && (
                                   <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Developing Skills</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                         {res.developing.map(s => <span key={s} style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", padding: "3px 10px", borderRadius: 16, fontSize: 12 }}>{s}</span>)}
                                      </div>
                                   </div>
                                )}

                                {res.missingCore.length > 0 && (
                                   <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Missing Core Skills</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                         {res.missingCore.map(s => <span key={s} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", padding: "3px 10px", borderRadius: 16, fontSize: 12 }}>{s}</span>)}
                                      </div>
                                   </div>
                                )}

                                {res.bonus.length > 0 && (
                                   <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Bonus Skills</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                         {res.bonus.map(s => <span key={s} style={{ background: "#F3F4F6", color: "#4B5563", border: "1px solid #E5E7EB", padding: "3px 10px", borderRadius: 16, fontSize: 12 }}>{s}</span>)}
                                      </div>
                                   </div>
                                )}
                                
                                <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E5E5" }}>
                                   <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginBottom: 12 }}>Priority Learning List</div>
                                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {res.priorityList.slice(0, 5).map((p, i) => (
                                         <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#FAFAFA", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                                            <span style={{ fontSize: 14, color: "#374151" }}>{i+1}. {p.name}</span>
                                            <span style={{ fontSize: 11, background: p.priority==="High" ? "#FEE2E2" : "#F3F4F6", color: p.priority==="High" ? "#991B1B" : "#4B5563", padding: "3px 8px", borderRadius: 16, fontWeight: 600 }}>{p.priority}</span>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             </Card>
                          </div>
                       )}

                       {/* TAB CONTENT: AI Insights */}
                       {activeTab === "ai" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                             <Card style={{ padding: 20, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>AI Career Advisor</div>
                                <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>Generate personalized insights based on your specific profile and missing skills.</p>
                                
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                                   <Btn onClick={() => callAi('gap-analysis')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", fontSize: 13, padding: "8px 14px", borderRadius: 6 }}>Explain My Skill Gaps</Btn>
                                   <Btn onClick={() => callAi('roadmap')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", fontSize: 13, padding: "8px 14px", borderRadius: 6 }}>Generate 30-Day Roadmap</Btn>
                                   <Btn onClick={() => document.querySelector('.ai-fab')?.click()} style={{ background: "#FFFFFF", color: "#FF4F1F", border: "1px solid #FFD5CC", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", fontSize: 13, padding: "8px 14px", borderRadius: 6 }}>Ask AI About My Career</Btn>
                                </div>
                             </Card>
                             
                             {(aiResponse.gap || aiResponse.roadmap || aiResponse.loading || aiResponse.error) && (
                                <Card style={{ padding: 24, borderRadius: 10, background: "#FFFFFF", border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
                                   {aiResponse.loading && <div style={{ color: "#6B7280", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Generating insights... please wait.</div>}
                                   {aiResponse.error && <div style={{ color: "#DC2626", fontSize: 14, padding: "10px 0" }}>{aiResponse.error}</div>}
                                   {aiResponse.gap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: "#1F2937", borderBottom: "1px solid #E5E5E5", paddingBottom: 10 }}>Skill Gap Analysis</div><div style={{ fontSize: 14, color: "#374151" }}>{renderAiText(aiResponse.gap)}</div></div>}
                                   {aiResponse.roadmap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: "#1F2937", borderBottom: "1px solid #E5E5E5", paddingBottom: 10 }}>30-Day Action Plan</div><div style={{ fontSize: 14, color: "#374151" }}>{renderAiText(aiResponse.roadmap)}</div></div>}
                                </Card>
                             )}
                          </div>
                       )}

                       {/* TAB CONTENT: Career Explorer */}
                       {activeTab === "career" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                             <Card style={{ padding: 24, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                   <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>Jobs You Can Target</div>
                                   <Btn onClick={findJobs} disabled={loadingJobs} style={{ background: "#FFFFFF", color: "#FF4F1F", border: "1px solid #FFD5CC", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", padding: "6px 14px", fontSize: 13, borderRadius: 6 }}>{loadingJobs ? "Matching..." : "Find Matches"}</Btn>
                                </div>
                                
                                {jobMatches.length > 0 ? (
                                   <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                      {jobMatches.map((j, i) => (
                                         <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8, background: "#FAFAFA" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                               <div>
                                                  <div style={{ fontWeight: 600, fontSize: 15, color: "#1F2937", marginBottom: 4 }}>{j.title}</div>
                                                  <div style={{ fontSize: 13, color: "#6B7280" }}>{j.company} • {j.location}</div>
                                               </div>
                                               <div style={{ fontWeight: 700, fontSize: 14, color: j.compatibility > 50 ? "#059669" : "#D97706", background: j.compatibility > 50 ? "#ECFDF5" : "#FEF3C7", padding: "4px 8px", borderRadius: 6 }}>{j.compatibility}% Match</div>
                                            </div>
                                            {j.tags && j.tags.length > 0 && (
                                               <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                                                  {j.tags.slice(0, 4).map(t => <span key={t} style={{ fontSize: 11, background: "#FFFFFF", border: "1px solid #D1D5DB", color: "#4B5563", padding: "2px 6px", borderRadius: 4 }}>{t}</span>)}
                                               </div>
                                            )}
                                            {j.applyUrl && (
                                               <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "#FF4F1F", fontWeight: 600, textDecoration: "none" }}>View Job →</a>
                                            )}
                                         </div>
                                      ))}
                                   </div>
                                ) : (
                                   <div style={{ color: "#6B7280", fontSize: 14, textAlign: "center", padding: "16px 0" }}>Click 'Find Matches' to discover real jobs suitable for your skills.</div>
                                )}
                             </Card>

                             <Card style={{ padding: 24, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 12 }}>Compare Careers</div>
                                <div style={{ color: "#6B7280", fontSize: 13, marginBottom: 12 }}>Select other roles to see how your current skills match up.</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                                   {Object.keys(rolesData).filter(r => r !== role).slice(0, 5).map(r => (
                                      <button key={r} onClick={() => handleCompare(r)} style={{ background: compareRoles.includes(r) ? "#F3F4F6" : "#FFFFFF", border: compareRoles.includes(r) ? "1px solid #9CA3AF" : "1px solid #D1D5DB", padding: "6px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#374151", fontWeight: compareRoles.includes(r) ? 600 : 400 }}>
                                         {compareRoles.includes(r) ? "✓ " : "+ "}{r}
                                      </button>
                                   ))}
                                </div>
                                
                                {compareRoles.length > 0 && (
                                   <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {compareRoles.map(cr => {
                                         const crRes = calculateReadiness(cr, skills);
                                         return (
                                            <div key={cr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA", border: "1px solid #E5E7EB", padding: "12px 16px", borderRadius: 8 }}>
                                               <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{cr}</span>
                                               <span style={{ fontSize: 15, fontWeight: 700, color: mc(crRes.pct) }}>{crRes.pct}%</span>
                                            </div>
                                         );
                                      })}
                                   </div>
                                )}
                             </Card>
                          </div>
                       )}

                       {/* TAB CONTENT: Growth */}
                       {activeTab === "growth" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                             <Card style={{ padding: 24, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                   <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>Projects You Should Build Next</div>
                                   <Btn onClick={() => callAi('project-recommendations')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", padding: "6px 12px", fontSize: 12, borderRadius: 6 }}>AI Recommend</Btn>
                                </div>
                                
                                {aiResponse.projects ? (
                                   <div style={{ fontSize: 14, color: "#374151" }}>{renderAiText(aiResponse.projects)}</div>
                                ) : (
                                   <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      {(res.projs || []).map((p, i) => (
                                         <div key={i} style={{ border: "1px solid #E5E7EB", background: "#FAFAFA", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                                            <span style={{ fontSize: 18 }}>🛠️</span>
                                            <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{p}</span>
                                         </div>
                                      ))}
                                      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 8, fontStyle: "italic" }}>Click "AI Recommend" for personalized project ideas based on your skill gaps.</div>
                                   </div>
                                )}
                             </Card>

                             <Card style={{ padding: 24, borderRadius: 10, border: "1px solid #E5E5E5", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", background: "#FFFFFF" }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937", marginBottom: 16 }}>Career Progress</div>
                                {getProgressHistory().length > 0 ? (
                                   <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                      {getProgressHistory().slice().reverse().map((h, i) => (
                                         <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i === getProgressHistory().length - 1 ? "none" : "1px solid #F3F4F6", paddingBottom: i === getProgressHistory().length - 1 ? 0 : 10 }}>
                                            <div style={{ fontSize: 13, color: "#6B7280" }}>{new Date(h.date).toLocaleDateString()} at {new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1F2937" }}>{h.pct}%</div>
                                         </div>
                                      ))}
                                   </div>
                                ) : (
                                   <div style={{ fontSize: 14, color: "#6B7280" }}>No history found for this role. Complete more analyses over time to track your growth.</div>
                                )}
                             </Card>
                          </div>
                       )}
                     </>
                   )}
                 </div>
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
