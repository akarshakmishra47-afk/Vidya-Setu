require('dotenv').config();
console.log("GROQ_API_KEY loaded:", !!process.env.GROQ_API_KEY);
console.log("GROQ_API_KEY length:", process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.length : 0);
console.log("GROQ_API_KEY starts with:", process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 4) : "N/A");
