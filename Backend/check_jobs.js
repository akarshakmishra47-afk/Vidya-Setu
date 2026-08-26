const test = async () => {
    try {
        const res = await fetch("http://localhost:5000/api/jobs?limit=100");
        const data = await res.json();
        let issues = 0;
        data.jobs.forEach(j => {
            if (!j.tags || !Array.isArray(j.tags)) { console.log("Missing/invalid tags:", j._id); issues++; }
            if (!j.desc) { console.log("Missing desc:", j._id); issues++; }
            if (!j.title) { console.log("Missing title:", j._id); issues++; }
        });
        console.log("Total issues:", issues);
    } catch (err) {
        console.error("Error:", err);
    }
};
test();
