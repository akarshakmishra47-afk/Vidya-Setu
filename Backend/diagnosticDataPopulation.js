const fs = require('fs');

async function checkAdapter(name, adapterPath, fetchFuncName) {
    console.log(`\n--- Diagnosing ${name} ---`);
    if (!fs.existsSync(adapterPath + '.js') && !fs.existsSync(adapterPath)) {
        return { name, exists: false, fetched: false, status: 'Unavailable', reason: 'Adapter file does not exist' };
    }
    
    let adapter;
    try {
        adapter = require(adapterPath);
    } catch (e) {
        return { name, exists: true, fetched: false, status: 'Error', reason: `Failed to load adapter: ${e.message}` };
    }

    const fetchFunc = adapter[fetchFuncName];
    if (!fetchFunc) {
        return { name, exists: true, fetched: false, status: 'Error', reason: `Function ${fetchFuncName} not found in adapter` };
    }

    try {
        console.log(`Executing ${fetchFuncName}...`);
        const result = await fetchFunc();
        return { 
            name, 
            exists: true, 
            fetched: true, 
            httpStatus: result.stats.error ? 'Error' : '200 OK',
            rawRecords: result.stats.fetched || 0,
            accepted: result.stats.accepted || 0,
            rejected: result.stats.rejected || 0,
            error: result.stats.error || null,
            status: result.stats.status || 'Unknown'
        };
    } catch (e) {
        return { name, exists: true, fetched: true, status: 'Error', error: e.message, reason: 'Adapter threw an exception during fetch' };
    }
}

async function run() {
    const sourcesToTest = [
        { name: 'Internshala', path: './services/jobs/sources/private/internshalaAdapter', func: 'fetchInternshalaJobs' },
        { name: 'LinkedIn', path: './services/jobs/sources/private/linkedinAdapter', func: 'fetchLinkedInJobs' },
        { name: 'Unstop', path: './services/jobs/sources/private/unstopAdapter', func: 'fetchUnstopJobs' },
        { name: 'Indeed', path: './services/jobs/sources/private/indeedAdapter', func: 'fetchIndeedJobs' },
        { name: 'Naukri', path: './services/jobs/sources/private/naukriAdapter', func: 'fetchNaukriJobs' },
        { name: 'Wellfound', path: './services/jobs/sources/private/wellfoundAdapter', func: 'fetchWellfoundJobs' },
        { name: 'AICTE', path: './services/jobs/sources/private/aicteAdapter', func: 'fetchAicteJobs' },
        { name: 'Remotive', path: './services/jobs/sources/private/remotiveAdapter', func: 'fetchRemotiveJobs' },
        { name: 'Arbeitnow', path: './services/jobs/sources/private/arbeitnowAdapter', func: 'fetchArbeitnowJobs' },
        { name: 'Himalayas', path: './services/jobs/sources/private/himalayasAdapter', func: 'fetchHimalayasJobs' },
        { name: 'Jobicy', path: './services/jobs/sources/private/jobicyAdapter', func: 'fetchJobicyJobs' },
        { name: 'The Muse', path: './services/jobs/sources/private/theMuseAdapter', func: 'fetchTheMuseJobs' }
    ];

    const results = [];
    for (const src of sourcesToTest) {
        const res = await checkAdapter(src.name, src.path, src.func);
        results.push(res);
    }

    console.log("\n\n========== SOURCE DATA DIAGNOSTIC ==========\n");
    console.log("Source | Attempted | Fetched | Accepted | Rejected | Active | Status | Reason\n");

    for (const r of results) {
        let reason = r.reason || r.error || (r.rejected > 0 ? 'Validation rejected records' : 'No records found');
        if (r.accepted > 0) reason = 'Working successfully';
        if (!r.exists) reason = 'Adapter not implemented/Unavailable';
        
        console.log(`${r.name} | Attempted: ${r.exists ? 'YES' : 'NO'} | Fetched: ${r.rawRecords || 0} | Accepted: ${r.accepted || 0} | Rejected: ${r.rejected || 0} | Active: ${r.accepted || 0} | Status: ${r.status || (r.exists ? 'Failed' : 'Unavailable')} | Reason: ${reason}`);
    }

    console.log("\n=============================================\n");
}

run();
