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
            if (line.startsWith('###')) return <h4 key={i} style={{ fontSize: 15, fontWeight: 600, margin: "14px 0 6px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h4>;
            if (line.startsWith('##')) return <h3 key={i} style={{ fontSize: 16, fontWeight: 700, margin: "16px 0 8px", color: "#1F2937" }}>{line.replace(/#/g, '').trim()}</h3>;
            if (line.startsWith('-')) return <li key={i} style={{ marginLeft: 20, marginBottom: 4, color: "#4B5563", fontSize: 14 }} dangerouslySetInnerHTML={{ __html: line.substring(1).trim().replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} style={{ marginBottom: 6, lineHeight: 1.5, color: "#4B5563", fontSize: 14 }} dangerouslySetInnerHTML={{ __html: line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />;
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
          <div className="screen-hero" style={{ background: "#FAFAFA", padding: "28px 36px", borderBottom: "1px solid #E5E7EB" }}>
            <div className="screen-hero-inner">
              <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 26, fontWeight: 800, color: "#1F2937", margin: 0 }}>🎯 Skill Matcher</h1>
              <p style={{ color: "#6B7280", fontSize: 14, margin: "6px 0 0 0" }}>Analyze your skills, find gaps, and plan your career path.</p>
            </div>
          </div>

          <div className="screen-body" style={{ background: "#FAFAFA", padding: "24px 36px 64px" }}>
            {loadingData ? (
               <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontSize: 14 }}>Loading career data...</div>
            ) : (
               <div className="two-panel-3-2">
                 {/* LEFT — Career Setup Card */}
                 <div className="section-block">
                   <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                     <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: "#1F2937" }}>Profile Setup</div>
                     
                     <label style={{ display: "block", color: "#4B5563", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Target Role</label>
                     <div style={{ position: "relative", marginBottom: 20 }}>
                       <select value={role} onChange={e => { setRole(e.target.value); setRes(null); }} style={{ width: "100%", padding: "10px 12px", background: "#FFFFFF", color: role ? "#1F2937" : "#6B7280", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, outline: "none", appearance: "none" }}>
                         <option value="">Select a career role...</option>
                         {Object.keys(rolesData).map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                       <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#6B7280", pointerEvents: "none", fontSize: 12 }}>▼</span>
                     </div>

                     <label style={{ display: "block", color: "#4B5563", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Your Skills (Tap to cycle proficiency)</label>
                     <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                       {allSkills.map(s => {
                         const lvl = skills[s];
                         const active = !!lvl;
                         return (
                           <button key={s} onClick={() => toggleSkill(s)} 
                             style={{ 
                               background: active ? "#FFF0ED" : "#FFFFFF", 
                               color: active ? "#FF4F1F" : "#4B5563", 
                               border: \`1px solid \${active ? "#FFD5CC" : "#E5E7EB"}\`, 
                               borderRadius: 6, padding: "4px 8px", fontSize: 13, fontWeight: active ? 600 : 400, 
                               cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .1s ease" 
                             }}>
                             {s}
                             {lvl === "Beginner" && <span style={{ fontSize: 10, background: "#FF4F1F", color: "#fff", padding: "1px 4px", borderRadius: 4 }}>Beg</span>}
                             {lvl === "Intermediate" && <span style={{ fontSize: 10, background: "#FF4F1F", color: "#fff", padding: "1px 4px", borderRadius: 4 }}>Int</span>}
                             {lvl === "Advanced" && <span style={{ fontSize: 10, background: "#FF4F1F", color: "#fff", padding: "1px 4px", borderRadius: 4 }}>Adv</span>}
                           </button>
                         );
                       })}
                     </div>

                     <Btn onClick={analyze} variant="primary" disabled={!role || Object.keys(skills).length === 0} style={{ width: "100%", padding: 10, fontSize: 14, background: "#FF4F1F", borderRadius: 6, boxShadow: "none" }}>Analyze Readiness</Btn>
                   </Card>
                 </div>

                 {/* RIGHT — Results Area */}
                 <div className="section-block" style={{ gap: 16 }}>
                   {!res ? (
                     <Card style={{ padding: "40px 20px", textAlign: "center", borderRadius: 8, border: "1px dashed #D1D5DB", boxShadow: "none", background: "#FFFFFF" }}>
                       <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                       <div style={{ fontWeight: 600, fontSize: 15, color: "#1F2937", marginBottom: 6 }}>Awaiting Analysis</div>
                       <div style={{ color: "#6B7280", fontSize: 13 }}>Select your skills and target role to view your readiness and career insights.</div>
                     </Card>
                   ) : (
                     <>
                       {/* 1. Readiness Score */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                             <div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>{role}</div>
                                <div style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>{res.pct}% Ready for this role</div>
                             </div>
                             <div style={{ fontSize: 24, fontWeight: 700, color: mc(res.pct) }}>{res.pct}%</div>
                          </div>
                          <PBar value={res.pct} color={mc(res.pct)} h={6} />
                       </Card>

                       {/* 2. Skills Analysis */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: "#1F2937", marginBottom: 12 }}>Skill Analysis</div>
                          
                          {res.strong.length > 0 && (
                             <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>Strong Skills</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                   {res.strong.map(s => <span key={s} style={{ background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s}</span>)}
                                </div>
                             </div>
                          )}

                          {res.developing.length > 0 && (
                             <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>Developing Skills</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                   {res.developing.map(s => <span key={s} style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s}</span>)}
                                </div>
                             </div>
                          )}

                          {res.missingCore.length > 0 && (
                             <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>Missing Core Skills</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                   {res.missingCore.map(s => <span key={s} style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s}</span>)}
                                </div>
                             </div>
                          )}

                          {res.bonus.length > 0 && (
                             <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>Bonus Skills</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                   {res.bonus.map(s => <span key={s} style={{ background: "#F3F4F6", color: "#4B5563", border: "1px solid #E5E7EB", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{s}</span>)}
                                </div>
                             </div>
                          )}
                       </Card>

                       {/* 3. Priority to Learn */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>Priority Learning List</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                             {res.priorityList.slice(0, 5).map((p, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#FAFAFA", borderRadius: 6, border: "1px solid #E5E7EB" }}>
                                   <span style={{ fontSize: 13, color: "#374151" }}>{i+1}. {p.name}</span>
                                   <span style={{ fontSize: 11, background: p.priority==="High" ? "#FEE2E2" : "#F3F4F6", color: p.priority==="High" ? "#991B1B" : "#4B5563", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{p.priority}</span>
                                </div>
                             ))}
                          </div>
                       </Card>

                       {/* 4. AI Insights */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginBottom: 6 }}>AI Career Advisor</div>
                          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Get personalized AI advice based on your exact profile.</p>
                          
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                             <Btn onClick={() => callAi('gap-analysis')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", boxShadow: "none", fontSize: 13, padding: "6px 12px", borderRadius: 6 }}>Explain Skill Gaps</Btn>
                             <Btn onClick={() => callAi('roadmap')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#1F2937", border: "1px solid #D1D5DB", boxShadow: "none", fontSize: 13, padding: "6px 12px", borderRadius: 6 }}>Generate Roadmap</Btn>
                             <Btn onClick={() => document.querySelector('.ai-fab')?.click()} style={{ background: "#FFFFFF", color: "#FF4F1F", border: "1px solid #FFD5CC", boxShadow: "none", fontSize: 13, padding: "6px 12px", borderRadius: 6 }}>Ask AI via Chat</Btn>
                          </div>

                          {(aiResponse.gap || aiResponse.roadmap || aiResponse.loading || aiResponse.error) && (
                             <div style={{ padding: 16, borderRadius: 6, background: "#F9FAFB", border: "1px solid #E5E7EB", marginTop: 8 }}>
                                {aiResponse.loading && <div style={{ color: "#6B7280", fontSize: 13, textAlign: "center" }}>Generating insights...</div>}
                                {aiResponse.error && <div style={{ color: "#DC2626", fontSize: 13 }}>{aiResponse.error}</div>}
                                {aiResponse.gap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#1F2937" }}>Skill Gap Analysis</div><div>{renderAiText(aiResponse.gap)}</div></div>}
                                {aiResponse.roadmap && !aiResponse.loading && <div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#1F2937" }}>30-Day Action Plan</div><div>{renderAiText(aiResponse.roadmap)}</div></div>}
                             </div>
                          )}
                       </Card>

                       {/* 5. Projects */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                             <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>Recommended Projects</div>
                             <Btn onClick={() => callAi('project-recommendations')} disabled={aiResponse.loading} style={{ background: "#FFFFFF", color: "#FF4F1F", border: "1px solid #FFD5CC", boxShadow: "none", padding: "4px 8px", fontSize: 12, borderRadius: 4 }}>AI Recommend</Btn>
                          </div>
                          
                          {aiResponse.projects ? (
                             <div style={{ padding: 12, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 6 }}>{renderAiText(aiResponse.projects)}</div>
                          ) : (
                             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(res.projs || []).map((p, i) => (
                                   <div key={i} style={{ border: "1px solid #E5E7EB", background: "#FAFAFA", borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                                      <span style={{ fontSize: 14 }}>🛠️</span>
                                      <span style={{ fontSize: 13, color: "#374151" }}>{p}</span>
                                   </div>
                                ))}
                             </div>
                          )}
                       </Card>

                       {/* 6. Jobs */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                             <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937" }}>Jobs You Can Target</div>
                             <Btn onClick={findJobs} disabled={loadingJobs} style={{ background: "#FFFFFF", color: "#FF4F1F", border: "1px solid #FFD5CC", boxShadow: "none", padding: "4px 8px", fontSize: 12, borderRadius: 4 }}>{loadingJobs ? "Matching..." : "Find Matches"}</Btn>
                          </div>
                          
                          {jobMatches.length > 0 ? (
                             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {jobMatches.map((j, i) => (
                                   <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 6, background: "#FAFAFA" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                         <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: "#1F2937", marginBottom: 2 }}>{j.title}</div>
                                            <div style={{ fontSize: 12, color: "#6B7280" }}>{j.company} • {j.location}</div>
                                         </div>
                                         <div style={{ fontWeight: 600, fontSize: 12, color: j.compatibility > 50 ? "#059669" : "#D97706", background: j.compatibility > 50 ? "#ECFDF5" : "#FEF3C7", padding: "2px 6px", borderRadius: 4 }}>{j.compatibility}% Match</div>
                                      </div>
                                      {j.applyUrl && (
                                         <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 12, color: "#FF4F1F", fontWeight: 600, textDecoration: "none" }}>View Job →</a>
                                      )}
                                   </div>
                                ))}
                             </div>
                          ) : (
                             <div style={{ color: "#6B7280", fontSize: 13, textAlign: "center", padding: "10px 0" }}>Click 'Find Matches' to discover real jobs based on your skills.</div>
                          )}
                       </Card>

                       {/* 7. Compare */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>Compare Careers</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                             {Object.keys(rolesData).filter(r => r !== role).slice(0, 5).map(r => (
                                <button key={r} onClick={() => handleCompare(r)} style={{ background: compareRoles.includes(r) ? "#F3F4F6" : "#FFFFFF", border: compareRoles.includes(r) ? "1px solid #9CA3AF" : "1px solid #D1D5DB", padding: "4px 8px", borderRadius: 4, fontSize: 12, cursor: "pointer", color: "#374151" }}>
                                   {compareRoles.includes(r) ? "✓ " : "+ "}{r}
                                </button>
                             ))}
                          </div>
                          
                          {compareRoles.length > 0 && (
                             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {compareRoles.map(cr => {
                                   const crRes = calculateReadiness(cr, skills);
                                   return (
                                      <div key={cr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA", border: "1px solid #E5E7EB", padding: "8px 12px", borderRadius: 6 }}>
                                         <span style={{ fontSize: 13, color: "#374151" }}>{cr}</span>
                                         <span style={{ fontSize: 14, fontWeight: 600, color: mc(crRes.pct) }}>{crRes.pct}%</span>
                                      </div>
                                   );
                                })}
                             </div>
                          )}
                       </Card>

                       {/* 8. Progress */}
                       <Card style={{ padding: 20, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#FFFFFF" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#1F2937", marginBottom: 12 }}>Career Progress</div>
                          {getProgressHistory().length > 0 ? (
                             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {getProgressHistory().slice().reverse().map((h, i) => (
                                   <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i === getProgressHistory().length - 1 ? "none" : "1px solid #F3F4F6", paddingBottom: i === getProgressHistory().length - 1 ? 0 : 8 }}>
                                      <div style={{ fontSize: 12, color: "#6B7280" }}>{new Date(h.date).toLocaleDateString()}</div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>{h.pct}%</div>
                                   </div>
                                ))}
                             </div>
                          ) : (
                             <div style={{ fontSize: 13, color: "#6B7280" }}>No history found. Complete analyses to track growth.</div>
                          )}
                       </Card>

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
