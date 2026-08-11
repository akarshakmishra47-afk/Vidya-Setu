const test = async () => {
    try {
        const res = await fetch("http://localhost:5000/api/jobs?limit=1");
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(data).substring(0, 500));
    } catch (err) {
        console.error("Error:", err);
    }
};
test();
