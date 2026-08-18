const express = require('express');
const router = express.Router();

router.post('/chat', async (req, res) => {
    try {
        const { message, userContext } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey || apiKey === 'your_key_here') {
            return res.status(500).json({ 
                error: "Groq API Key is missing. Please add GROQ_API_KEY to your environment settings." 
            });
        }

        const systemPrompt = `
You are the "Vidya-Setu AI Assistant", the official friendly AI for students of the Vidya-Setu platform, designed specifically for AKTU (Dr. A.P.J. Abdul Kalam Technical University) students.

IDENTITY & MISSION:
- Your primary goal is to assist students in navigating their academic and career journey using Vidya-Setu's tools.
- Maintain a helpful, encouraging, and professional tone.
- Always identify as the "Vidya-Setu Assistant".

KNOWLEDGE OF VIDYA-SETU FEATURES:
When relevant to the user's query, you MUST mention and guide users to these specific sections of Vidya-Setu:
1. **Jobs & Internships**: We offer dedicated sections for Paid Internships, Free Internships, and AKTU-specific Engineering Jobs.
2. **Scholarship Center**: A hub for finding and applying to various student scholarships.
3. **Academic Resources**: Students can access AKTU Notes, Syllabus, and Previous Year Questions (PYQs) right here.
4. **Exam & Result Updates**: We provide real-time updates on AKTU results, date sheets, and important notifications.
5. **Marketplace**: A place for students to buy, sell, or donate academic materials like books or drafters.
6. **Student Perks**: Exclusive discounts and deals curated for the student community.

BEHAVIORAL GUIDELINES:
- **Prioritize the Platform**: If a user asks about careers, internships, scholarships, or exams, always mention that Vidya-Setu has dedicated sections for these and encourage them to check those tabs.
- **Accuracy & Honesty**: Provide highly accurate, factual answers. Do NOT hallucinate or guess information. Think step-by-step before answering. If you do not know the answer to a specific technical or academic question, admit it and guide them on how to find out.
- **Direct & Helpful**: Provide clear, concise answers. Avoid fluff. If the information is on Vidya-Setu, point them there. Base all your advice entirely on factual information.

User Context:
- Name: ${userContext?.name || 'Student'}
- Branch: ${userContext?.branch || 'N/A'}
- Year: ${userContext?.year || 'N/A'}
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.1,
                max_tokens: 2048
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            const msg = data.choices[0].message;
            const reply = msg.content || msg.reasoning || (msg.reasoning_details?.[0]?.text ?? null);
            if (!reply) {
                console.error('OpenRouter empty content:', data);
                throw new Error("AI returned an empty response. Please try again.");
            }
            res.json({ reply });
        } else {
            console.error('Groq Error Response:', data);
            throw new Error(data.error?.message || "Groq API error");
        }
    } catch (error) {
        console.error('Groq Chat Error:', error);
        res.status(500).json({ error: "The AI is thinking a bit too hard. Please try again in a few seconds!" });
    }
});

router.post('/career-analyze', async (req, res) => {
    try {
        const { type, role, skills, missingSkills, coreSkills, bonusSkills, readiness, userContext } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey || apiKey === 'your_key_here') {
            return res.status(500).json({ 
                error: "Groq API Key is missing. Please add GROQ_API_KEY to your environment settings." 
            });
        }

        let taskPrompt = "";
        if (type === 'gap-analysis') {
            taskPrompt = `Explain why the student's readiness for ${role} is at ${readiness}%. Identify the biggest weaknesses, highest-priority skills to learn first (from missing core skills: ${missingSkills.join(', ')}), and what can be ignored for now.`;
        } else if (type === 'roadmap') {
            taskPrompt = `Generate a personalized 30-day roadmap to help the student become a ${role}. Focus on their missing skills: ${missingSkills.join(', ')}. Structure it by Week 1, Week 2, Week 3, Week 4 with specific skills to learn and practice tasks. Do not use generic advice.`;
        } else if (type === 'project-recommendations') {
            taskPrompt = `Recommend 3 specific projects the student should build to improve their readiness for ${role} based on their missing skills (${missingSkills.join(', ')}). Explain why each project is recommended, the skills it develops, and the difficulty.`;
        } else if (type === 'skill-verification') {
            taskPrompt = `Generate a short 3-question multiple-choice assessment to verify the student's proficiency in ${skills[0] || 'one of their skills'}.`;
        } else {
            taskPrompt = `Analyze the student's career profile for ${role}.`;
        }

        const systemPrompt = `
You are the "Vidya-Setu AI Career Advisor", a specialized AI designed to provide highly actionable, personalized career guidance to engineering students.

Student Profile Context:
- Name: ${userContext?.name || 'Student'}
- Target Role: ${role}
- Current Readiness Score: ${readiness}%
- Current Skills: ${skills.join(', ')}
- Missing Core Skills: ${missingSkills.join(', ')}
- Bonus Skills Recommended: ${bonusSkills.join(', ')}

Guidelines:
1. Provide a direct, professional, and structured response.
2. Base ALL your advice STRICTLY on the provided student profile and missing skills. Do NOT invent generic advice that ignores the user's specific context. Be highly accurate and realistic.
3. Use proper markdown formatting: use newlines to separate bullet points, use --- for horizontal rules, use | pipe tables for comparisons. Do NOT use <br> or any HTML tags.
4. If recommending technologies to learn, be highly specific and practical (e.g., "Learn Express.js routing" instead of "Learn backend"). Avoid generic buzzwords.

Task: ${taskPrompt}
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Please generate the requested career analysis." }
                ],
                temperature: 0.1,
                max_tokens: 2048
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            const msg = data.choices[0].message;
            const reply = msg.content || msg.reasoning || (msg.reasoning_details?.[0]?.text ?? null);
            if (!reply) throw new Error("AI returned an empty response.");
            res.json({ reply });
        } else {
            console.error('Groq Error Response:', data);
            throw new Error(data.error?.message || "Groq API error");
        }
    } catch (error) {
        console.error('Groq Career Analyze Error:', error);
        res.status(500).json({ error: "The AI is thinking a bit too hard. Please try again in a few seconds!" });
    }
});

// ============================================================
// Exam Analytics AI Endpoint — Optional enhancement for Prashna-Kosh
// ============================================================

router.post('/exam-analyze', async (req, res) => {
    try {
        const { type, exam, subject, topics, stats, userContext, specificTopic } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey || apiKey === 'your_key_here') {
            return res.status(500).json({ 
                error: "Groq API Key is missing. Please add GROQ_API_KEY to your environment settings." 
            });
        }

        const hasData = topics && topics.length > 0;

        let taskPrompt = "";
        if (!hasData && type !== 'pyq-explain' && type !== 'detect-patterns') {
            taskPrompt = `The user is asking about the subject "${subject}" in the "${exam}" exam. However, we do not currently have enough verified Previous Year Question (PYQ) data to generate reliable statistical predictions or probabilities. Provide general syllabus guidance and study advice, but clearly state that this is general guidance, not based on verified PYQ trends.`;
        } else {
            switch (type) {
                case 'what-to-study-first':
                    taskPrompt = `Recommend a study order for the subject "${subject}" in the "${exam}" exam. Base this strictly on the provided verified topic probabilities and frequencies: ${topics.map(t => `${t.t} (${t.p}%)`).join(', ')}. Explicitly state that this recommendation is based on the available verified PYQ data. Do NOT invent topics or probabilities.`;
                    break;
                case 'study-plan':
                    taskPrompt = `Generate a ${req.body.duration || 7}-day personalized study and revision plan for the subject "${subject}" in the "${exam}" exam. Prioritize high-frequency topics provided: ${topics.slice(0, 5).map(t => `${t.t} (${t.p}%)`).join(', ')}. Detail daily goals. Explicitly state this plan is based on verified PYQ data.`;
                    break;
                case 'limited-time':
                    taskPrompt = `The student has very limited time (${req.body.duration || 3} days) to prepare for "${subject}" in the "${exam}" exam. Create a highly compressed strategy focusing strictly on the highest probability topics: ${topics.slice(0, 5).map(t => `${t.t} (${t.p}%)`).join(', ')}. Tell them what to skip or deprioritize. Explicitly state this is based on verified PYQ data.`;
                    break;
                case 'topic-explain':
                    taskPrompt = `Explain how to prepare for the topic "${specificTopic}" in the context of the "${subject}" subject for the "${exam}" exam. Include common question styles and mistakes to avoid. Note that this topic has a probability of ${req.body.topicProbability || 'high'}% based on verified PYQs. Do NOT invent new statistics.`;
                    break;
                case 'detect-patterns':
                    taskPrompt = `Analyze the following verified PYQ questions for "${subject}" (${exam}) and identify recurring concepts, patterns, and question styles:\n\n${(req.body.questions || []).map((q, i) => `${i+1}. ${q.question}`).join('\n')}\n\nDo NOT invent new questions. Only analyze the provided ones. Explain the patterns clearly.`;
                    break;
                case 'practice-test':
                    taskPrompt = `Generate a practice test of ${req.body.count || 5} questions for "${subject}" (${exam}) at a "${req.body.difficulty || 'mixed'}" difficulty level. Focus on the high-priority topics provided: ${topics.slice(0, 3).map(t => t.t).join(', ')}. IMPORTANT: Label all questions clearly with "🤖 AI Generated Practice" and do NOT claim these are official PYQs. Include brief solutions or hints at the end.`;
                    break;
                case 'pyq-explain':
                    taskPrompt = `Explain the following official PYQ for "${subject}" (${exam}), topic "${req.body.topic || 'Unknown'}":\n\n"${req.body.question}"\n\nExplain what concept it tests, the approach to solve it, and common mistakes. Do NOT modify the original question. Ensure you state this is an explanation of an existing verified question.`;
                    break;
                case 'chat':
                    taskPrompt = `The student asks: "${req.body.userMessage}". Answer their query using the provided verified PYQ context for "${subject}" (${exam}). The top topics are ${topics.slice(0, 5).map(t => `${t.t} (${t.p}%)`).join(', ')}. Never invent statistics.`;
                    break;
                default:
                    taskPrompt = `Analyze the PYQ trends for "${subject}" (${exam}). The top topics are ${topics.slice(0, 3).map(t => t.t).join(', ')}. Suggest an exam strategy based on this real data.`;
            }
        }

        const systemPrompt = `
You are the "Vidya-Setu AI Exam Analyst", a specialized AI designed to analyze actual Previous Year Questions (PYQs) and provide highly actionable exam strategies for AKTU and GATE students.

Student Profile:
- Name: ${userContext?.name || 'Student'}
- Branch: ${userContext?.branch || 'N/A'}
- Semester: ${userContext?.semester || 'N/A'}

Exam Context:
- Exam: ${exam}
- Subject: ${subject}
- Total Verified PYQs Analyzed: ${stats?.totalQuestions || 0}
- Years Covered: ${stats?.yearsCovered || 0}
- Top 3 Focus Topics: ${hasData ? topics.slice(0, 3).map(t => t.t).join(', ') : 'Insufficient Data'}

Guidelines:
1. Provide a direct, professional, and highly accurate structured response.
2. STRICT DATA ADHERENCE: Base ALL your advice ONLY on the provided PYQ data context. NEVER hallucinate, invent, or guess PYQ statistics, topics, or questions that are not explicitly provided in the context. If data is insufficient, state that clearly instead of guessing.
3. Use proper markdown formatting: bullet points, bold text, and | pipe tables for topic lists. Use newlines between items. Do NOT use <br> or any HTML tags.
4. Keep it concise, analytical, and highly valuable. Do not add unnecessary fluff.

Task: ${taskPrompt}
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Please generate the requested exam analysis." }
                ],
                temperature: 0.1,
                max_tokens: 2048
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            const msg = data.choices[0].message;
            const reply = msg.content || msg.reasoning || (msg.reasoning_details?.[0]?.text ?? null);
            if (!reply) throw new Error("AI returned an empty response.");
            res.json({ reply });
        } else {
            console.error('Groq Error Response:', data);
            throw new Error(data.error?.message || "Groq API error");
        }
    } catch (error) {
        console.error('Groq Exam Analyze Error:', error);
        res.status(500).json({ error: "The AI is thinking a bit too hard. Please try again in a few seconds!" });
    }
});

// Resume Analysis Endpoint
router.post('/resume/analyze', async (req, res) => {
    try {
        const { rollNo, userContext } = req.body;
        const User = require('../models/User');
        const user = await User.findOne({ rollNo });
        const resumeText = user ? user.resumeText : null;
        
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey || apiKey === 'your_key_here') {
            return res.status(500).json({ 
                error: "Groq API Key is missing. Please add GROQ_API_KEY to your environment settings." 
            });
        }
        
        if (!resumeText) {
            return res.status(400).json({ error: "Resume text is missing." });
        }

        const systemPrompt = `
You are the "Vidya-Setu AI Resume Analyzer", an expert recruiter and career advisor.
Your task is to analyze the provided resume text and the student's context, and output a STRICT JSON response.

Student Profile Context:
- Name: ${userContext?.name || 'Student'}
- Branch: ${userContext?.branch || 'N/A'}
- Year: ${userContext?.year || 'N/A'}
- Domain of Interest: ${userContext?.domain || 'Software Engineering'}
- Claimed Skills (Profile): ${userContext?.skills?.join(', ') || 'None provided'}

Guidelines:
1. Analyze the resume content thoroughly. Do NOT invent information.
2. Calculate a "score" (0-100) based on how well the resume matches their Target Domain and Branch.
3. Identify strengths, gaps, and missing evidence (e.g., projects, metrics).
4. Provide a personalized skill roadmap with highly actionable, specific tasks.
5. Provide actionable improvements for the resume itself.
6. The output MUST be a valid JSON object matching the exact structure below, without any markdown formatting outside the JSON, and no extra explanatory text.

Required JSON Structure:
{
  "score": 0,
  "targetDomain": "string",
  "strengths": ["string"],
  "gaps": ["string"],
  "skillsToLearn": [
    { "skill": "string", "priority": "High|Medium|Low", "reason": "string", "suggestedProject": "string" }
  ],
  "resumeImprovements": ["string"],
  "projectImprovements": ["string"],
  "recommendedRoles": ["string"],
  "priorityActions": ["string"]
}
`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Here is the resume text to analyze:\n\n" + resumeText }
                ],
                temperature: 0.1,
                max_tokens: 2000
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            let jsonString = data.choices[0].message.content;
            
            // Basic cleanup in case of extra spaces
            jsonString = jsonString.trim();
            
            let parsedData;
            try {
                parsedData = JSON.parse(jsonString);
            } catch (e) {
                console.error("Failed to parse Groq response as JSON:", jsonString);
                return res.status(500).json({ error: "AI returned invalid JSON format." });
            }
            
            // Save to User model
            const User = require('../models/User');
            await User.findOneAndUpdate(
                { rollNo },
                { $set: { resumeAnalysis: parsedData } },
                { strict: false }
            );

            res.json({ success: true, analysis: parsedData });
        } else {
            console.error('Groq Error Response:', data);
            throw new Error(data.error?.message || "Groq API error");
        }
    } catch (error) {
        console.error('Groq Resume Analyze Error:', error);
        res.status(500).json({ error: "Failed to analyze resume. Please try again later." });
    }
});

module.exports = router;

