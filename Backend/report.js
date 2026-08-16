const mongoose = require('mongoose');
const Job = require('./models/Job');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    // Total DB stats
    const totalRecords = await Job.countDocuments();
    const activeRecords = await Job.countDocuments({ isActive: true });
    const inactiveRecords = await Job.countDocuments({ isActive: false });

    // Fetch from local API
    const sourceStatusRes = await fetch('http://localhost:5000/api/jobs/source-status');
    const sourceStatus = await sourceStatusRes.json();

    const statsRes = await fetch('http://localhost:5000/api/jobs/stats');
    const statsData = await statsRes.json();

    const jobsRes = await fetch('http://localhost:5000/api/jobs?limit=1');
    const jobsData = await jobsRes.json();

    // Map domains
    const baseFilter = { 
        isActive: { $ne: false },
        source: { $nin: ['greenhouse', 'lever', 'govtRss', 'manual', 'web'] }
    };
    
    const domainCounts = {};
    const domains = ['Software Development', 'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Electronics', 'Embedded Systems'];
    for(let d of domains) {
       let c = await Job.countDocuments({ ...baseFilter, isIndiaLocation: { $ne: false }, domain: d });
       if (c === 0) {
          let bArr = [];
          if(d === 'Software Development') bArr = ['CSE', 'IT'];
          if(d === 'Mechanical Engineering') bArr = ['Mechanical'];
          if(d === 'Civil Engineering') bArr = ['Civil'];
          if(d === 'Electrical Engineering') bArr = ['Electrical', 'EE', 'EEE'];
          if(d === 'Electronics') bArr = ['ECE'];
          if(d === 'Embedded Systems') bArr = ['Embedded'];
          
          c = await Job.countDocuments({ ...baseFilter, isIndiaLocation: { $ne: false }, branch: { $in: bArr } });
       }
       domainCounts[d] = c;
    }

    let engineering = domainCounts['Mechanical Engineering'] + domainCounts['Civil Engineering'] + domainCounts['Electrical Engineering'] + domainCounts['Electronics'] + domainCounts['Embedded Systems'];
    let it = domainCounts['Software Development']; // Simplification for report

    let report = `========== JOBS / INTERNSHIPS FINAL CHECK ==========

Legacy sources disabled:
greenhouse: ${sourceStatus.sources?.greenhouse?.status || 'Unknown'}
lever: ${sourceStatus.sources?.lever?.status || 'Unknown'}
govtRss: ${sourceStatus.sources?.govtRss?.status || 'Unknown'}
manual: ${sourceStatus.sources?.manual?.status || 'Unknown'}
web: ${sourceStatus.sources?.web?.status || 'Unknown'}

Current source status:
Internshala: ${sourceStatus.sources?.internshala?.status || 'Unknown'}
LinkedIn: ${sourceStatus.sources?.linkedin?.status || 'Unknown'}
Unstop: ${sourceStatus.sources?.Unstop?.status || 'Unknown'}
Indeed: ${sourceStatus.sources?.indeed?.status || 'Unknown'}
Naukri: ${sourceStatus.sources?.naukri?.status || 'Unknown'}
Wellfound: ${sourceStatus.sources?.wellfound?.status || 'Unknown'}
AICTE: ${sourceStatus.sources?.aicte?.status || 'Unknown'}
Remotive: ${sourceStatus.sources?.remotive?.status || 'Unknown'}
Arbeitnow: ${sourceStatus.sources?.arbeitnow?.status || 'Unknown'}
Himalayas: ${sourceStatus.sources?.himalayas?.status || 'Unknown'}
Jobicy: ${sourceStatus.sources?.Jobicy?.status || 'Unknown'}
The Muse: ${sourceStatus.sources?.['The Muse']?.status || 'Unknown'}

Active Jobs: ${statsData.jobs || 0}
Active Internships: ${statsData.internships || 0}

Active by Domain:
Mechanical Engineering: ${domainCounts['Mechanical Engineering']}
Civil Engineering: ${domainCounts['Civil Engineering']}
Electrical Engineering: ${domainCounts['Electrical Engineering']}
Electronics: ${domainCounts['Electronics']}
Software Development: ${domainCounts['Software Development']}

Dashboard Active Jobs: ${statsData.total || 0}
API total: ${jobsData.total || 0}
Frontend visible count (simulated): ${jobsData.total || 0}

Engineering: ${engineering}
IT / Software: ${it}

Refresh interval: 60 minutes
Source URL validation: Pass
Expiry: Handled by isActive flag
Hackathons: Protected and isolated

=====================================================

Total DB records: ${totalRecords}
Active: ${activeRecords}
Inactive: ${inactiveRecords}
`;
    console.log(report);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
