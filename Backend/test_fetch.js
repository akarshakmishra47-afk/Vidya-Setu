const test = async () => {
    try {
        const res = await fetch("http://localhost:5000/api/ai/career-analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                type: 'gap-analysis',
                role: 'Software Engineer',
                skills: ['JavaScript'],
                missingSkills: ['React', 'Node.js'],
                coreSkills: ['JavaScript', 'React', 'Node.js'],
                bonusSkills: ['TypeScript'],
                readiness: 50,
                userContext: { name: 'Test', branch: 'CS', year: '3' }
            })
        });
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Data:", data);
    } catch (err) {
        console.error("Error:", err);
    }
};
test();
