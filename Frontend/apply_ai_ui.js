const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');

// 1. Add state variables
html = html.replace(
  `const [aiLoading, setAiLoading] = useState(false);`,
  `const [aiLoading, setAiLoading] = useState(false);\n      const [aiModalOpen, setAiModalOpen] = useState(false);\n      const [aiModalTitle, setAiModalTitle] = useState("");\n      const [aiModalContent, setAiModalContent] = useState("");\n      const [aiActionLoading, setAiActionLoading] = useState(false);\n      const [aiChatInput, setAiChatInput] = useState("");`
);

// 2. Replace handleAskAi and add executeAiAction and submitChat
html = html.replace(
  `const handleAskAi = async () => {
        if (!analytics) return;
        try {
          setAiLoading(true); setAiReply("");
          const payload = {
             type: "general", exam: selExam, subject: selSub, 
             topics: analytics.topics || [], stats: { totalQuestions: analytics.totalQuestions, yearsCovered: analytics.yearsCovered },
             userContext: { name: user?.name, branch: user?.branch, semester: user?.semester }
          };
          const res = await fetch(\`\${API_BASE_URL}/api/ai/exam-analyze\`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error("AI failed");
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch(e) { throw new Error("Invalid JSON"); }
          if (data.reply) setAiReply(data.reply);
          else if (data.error) setAiReply(\`Error: \${data.error}\`);
        } catch(e) {
          setAiReply("AI is currently unavailable.");
        } finally { setAiLoading(false); }
      };`,
  `const executeAiAction = async (payload, title) => {
        if (!analytics) return;
        try {
          setAiModalOpen(true);
          setAiModalTitle(title);
          setAiModalContent("");
          setAiActionLoading(true);
          
          const fullPayload = {
             ...payload,
             exam: selExam, subject: selSub, 
             topics: analytics.topics || [], 
             stats: { totalQuestions: analytics.totalQuestions, yearsCovered: analytics.yearsCovered, probability: payload.topicProbability || null },
             userContext: { name: user?.name, branch: user?.branch, semester: user?.semester }
          };
          const res = await fetch(\`\${API_BASE_URL}/api/ai/exam-analyze\`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(fullPayload)
          });
          if (!res.ok) throw new Error("AI failed");
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch(e) { throw new Error("Invalid JSON"); }
          if (data.reply) setAiModalContent(data.reply);
          else if (data.error) setAiModalContent(\`Error: \${data.error}\`);
        } catch(e) {
          setAiModalContent("AI service is temporarily unavailable. Please try again later.");
        } finally { setAiActionLoading(false); }
      };

      const handleAskAi = () => {
         setAiModalOpen(true);
         setAiModalTitle("🤖 Ask AI About This Exam");
         setAiModalContent("I analyzed the available verified PYQ data for this subject.\\n\\nQuick actions:\\n- What should I study first?\\n- Explain the focus topics\\n- Make a 3-day plan\\n- Detect PYQ patterns\\n- Give me practice questions");
      };

      const submitChat = () => {
         if(!aiChatInput.trim()) return;
         executeAiAction({ type: 'chat', prompt: aiChatInput }, "💬 Chat Response");
         setAiChatInput("");
      };`
);

// 3. Replace AI strategy display block and main buttons
html = html.replace(
  `<div className="fade-up">
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <button onClick={loadQuestions} style={{ background: "#fff", border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>View All Questions</button>
                  <button onClick={handleAskAi} disabled={aiLoading} style={{ background: T.indigo, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>{aiLoading ? "AI Thinking..." : "Ask AI Analyst ✨"}</button>
                </div>
                
                {aiReply && (
                  <Card style={{ marginBottom: 16, border: \`1px solid \${T.indigo}40\`, background: \`\${T.indigo}08\` }}>
                    <h3 style={{color: T.indigo, marginBottom: 8}}>✨ AI Exam Strategy</h3>
                    <div style={{fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap"}}>{aiReply}</div>
                  </Card>
                )}`,
  `<div className="fade-up">
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <button onClick={loadQuestions} style={{ background: "#fff", border: "1px solid #ddd", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>View All Questions</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  <button onClick={() => executeAiAction({type: 'what-to-study-first'}, "✨ What to Study First")} style={{ background: T.indigo, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>✨ Tell Me What to Study First</button>
                  <button onClick={() => executeAiAction({type: 'study-plan', duration: 7}, "📅 7-Day Study Plan")} style={{ background: T.teal, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>✨ Generate My Study Plan</button>
                  <button onClick={() => executeAiAction({type: 'limited-time', duration: 3}, "⏳ Limited Time Strategy (3 Days)")} style={{ background: T.warn, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>⏳ I Have Limited Time (3 Days)</button>
                  <button onClick={handleAskAi} style={{ background: "#1F2937", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🤖 Ask AI About This Exam</button>
                </div>`
);

// 4. Update 'Focus These First' logic
html = html.replace(
  `<div style={{ fontWeight: 700, marginBottom: 12, color: T.text }}>🎯 Focus These First (Top 3)</div>
                      {(analytics.topics || []).slice(0, 3).map(({ t, p }) => (
                        <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>🔥</span>
                          <span style={{ fontSize: 13, color: T.text }}>{t}</span>
                          <span style={{ marginLeft: "auto", fontFamily: 'Inter', color: T.rose, fontWeight: 700 }}>{p}%</span>
                        </div>
                      ))}`,
  `<div style={{ fontWeight: 700, marginBottom: 12, color: T.text }}>🎯 AI Recommended Focus</div>
                      {(analytics.topics || []).slice(0, 3).map(({ t, p }) => (
                        <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16 }}>🔥</span>
                          <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{t}</span>
                          <span style={{ marginLeft: "auto", fontFamily: 'Inter', color: T.rose, fontWeight: 700 }}>{p}%</span>
                          <button onClick={() => executeAiAction({type: 'topic-explain', specificTopic: t, topicProbability: p}, \`🎯 About \${t}\`)} style={{background: 'transparent', border: 'none', color: T.indigo, cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline', width: '100%', textAlign: 'left', marginLeft: 26}}>Why this topic?</button>
                        </div>
                      ))}`
);

// 5. Update viewPyqs top buttons
html = html.replace(
  `<button onClick={() => setViewPyqs(false)} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", marginBottom: 16, fontWeight: "bold", padding: 0 }}>← Back to Analytics</button>
                 {qLoading`,
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <button onClick={() => setViewPyqs(false)} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontWeight: "bold", padding: 0 }}>← Back to Analytics</button>
                    <div style={{display: 'flex', gap: 8}}>
                        <button onClick={() => executeAiAction({type: 'detect-patterns', questions: questions}, "🔎 PYQ Patterns")} style={{ background: T.indigo, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🔎 Detect PYQ Patterns</button>
                        <button onClick={() => executeAiAction({type: 'practice-test', count: 5}, "🧪 AI Practice Test")} style={{ background: T.teal, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🧪 Generate Practice Test</button>
                    </div>
                 </div>
                 {qLoading`
);

// 6. Update question card (Ask AI button)
html = html.replace(
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                             <Badge color={q.isVerified ? T.success : T.warn}>{q.isVerified ? "✅ Verified" : "⚠️ Sample Data"}</Badge>
                             <span style={{ fontSize: 12, color: T.muted }}>{q.year} • {q.marks ? \`\${q.marks} Marks\` : ''}</span>
                           </div>`,
  `<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                             <Badge color={q.isVerified ? T.success : T.warn}>{q.isVerified ? "✅ Verified" : "⚠️ Sample Data"}</Badge>
                             <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                                <button onClick={() => executeAiAction({type: 'pyq-explain', questionText: q.question, topic: q.topic}, "✨ PYQ Explanation")} style={{ background: "transparent", color: T.indigo, border: "none", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: 'underline' }}>Ask AI ✨</button>
                                <span style={{ fontSize: 12, color: T.muted }}>{q.year} • {q.marks ? \`\${q.marks} Marks\` : ''}</span>
                             </div>
                           </div>`
);

// 7. Add Modal at bottom
html = html.replace(
  `</div>
        </div>
      );
    }`,
  `</div>
            {aiModalOpen && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                <Card style={{ width: '90%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24, position: 'relative' }}>
                  <button onClick={() => setAiModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: T.muted }}>×</button>
                  <h3 style={{ marginTop: 0, marginBottom: 16, color: T.indigo }}>{aiModalTitle}</h3>
                  <div style={{ overflowY: 'auto', flex: 1, fontSize: 14, lineHeight: 1.6, color: T.text, whiteSpace: 'pre-wrap', paddingRight: 8 }}>
                    {aiActionLoading ? <div style={{textAlign: 'center', padding: 40, color: T.muted}}>AI is thinking...</div> : aiModalContent}
                  </div>
                  {aiModalTitle === "🤖 Ask AI About This Exam" && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <input type="text" value={aiChatInput} onChange={e => setAiChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitChat()} placeholder="Ask a question..." style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #ddd" }} />
                      <button onClick={submitChat} disabled={aiActionLoading} style={{ background: T.indigo, color: '#fff', border: 'none', padding: '0 16px', borderRadius: 8, cursor: 'pointer' }}>Send</button>
                    </div>
                  )}
                </Card>
              </div>
            )}
        </div>
      );
    }`
);

fs.writeFileSync(indexFile, html);
console.log("Successfully injected UI changes.");
