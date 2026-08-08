const express = require('express');
const router = express.Router();

router.post('/chat', async (req, res) => {
    try {
        const { message, userContext } = req.body;
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey || apiKey === 'your_key_here') {
            return res.status(500).json({ 
                error: "Groq API Key is missing. Please add it to your Render Settings as GROQ_API_KEY." 
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
- **General Knowledge**: You are a powerful AI (Llama 3.3) and can answer any general question (coding, science, literature, etc.). Do not limit your knowledge, but always frame it as coming from the Vidya-Setu Assistant.
- **Direct & Helpful**: Provide clear answers. If the information is on Vidya-Setu, point them there.

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
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            res.json({ reply: data.choices[0].message.content });
        } else {
            console.error('Groq Error Response:', data);
            throw new Error(data.error?.message || "Groq API error");
        }
    } catch (error) {
        console.error('Groq Chat Error:', error);
        res.status(500).json({ error: "The AI is thinking a bit too hard. Please try again in a few seconds!" });
    }
});

module.exports = router;
