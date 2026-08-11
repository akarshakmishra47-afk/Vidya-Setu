const test = async () => {
    try {
        const res = await fetch("http://localhost:5000/api/jobs?limit=300");
        const data = await res.json();
        
        const role = "Software Engineer";
        const skills = { "JavaScript": "Advanced", "React": "Intermediate" };
        const user = { branch: "Computer Science and Engineering" };
        
        let matchCount = 0;
        
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
            if (matchedTags > 0) matchScore += 10 + (matchedTags * 10); // boosted
            
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

            return { title: j.title, tags: jobTags, compatibility: Math.round(matchScore) };
        }).sort((a, b) => b.compatibility - a.compatibility);

        const above30 = matched.filter(j => j.compatibility >= 30);
        const above20 = matched.filter(j => j.compatibility >= 20);
        
        console.log(`Total jobs fetched: ${data.jobs.length}`);
        console.log(`Jobs >= 30 compatibility: ${above30.length}`);
        console.log(`Jobs >= 20 compatibility: ${above20.length}`);
        
        console.log("\nTop 5 matches:");
        matched.slice(0, 5).forEach(j => {
            console.log(`- [${j.compatibility}%] ${j.title} (Tags: ${j.tags.join(', ')})`);
        });

    } catch (err) {
        console.error("Error:", err);
    }
};
test();
