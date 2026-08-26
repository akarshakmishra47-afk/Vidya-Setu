const http = require('http');

const data = JSON.stringify({
    type: 'gap-analysis',
    role: 'Software Engineer',
    skills: ['JavaScript'],
    missingSkills: ['React', 'Node.js'],
    coreSkills: ['JavaScript', 'React', 'Node.js'],
    bonusSkills: ['TypeScript'],
    readiness: 50,
    userContext: { name: 'Test', branch: 'CS', year: '3' }
});

const options = {
    hostname: 'localhost',
    port: 5000, // Assuming default port is 5000 based on standard setups, wait, let me check server.js first. I'll just check if process is running.
    path: '/api/ai/career-analyze',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk.toString());
    res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', error => console.error('Request Error:', error));
req.write(data);
req.end();
