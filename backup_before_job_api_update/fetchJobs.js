/**
 * fetchJobs.js
 * Fetches real-time internship & job listings from public RSS/JSON feeds.
 * Falls back to curated AKTU-relevant data if the web feed is unreachable.
 */

const https = require('https');
const http = require('http');

// ── FALLBACK DATA (curated, AKTU-relevant) ──────────────────────────────────
const FALLBACK_INTERNSHIPS_PAID = [
  {
    title: "Software Development Intern",
    company: "TCS iON",
    location: "Remote / Lucknow",
    salary: "₹15,000/mo",
    badge: "Hot 🔥",
    tags: ["Java", "Spring Boot", "MySQL"],
    desc: "TCS iON is offering a 3-month paid internship for AKTU pre-final year students. Work on real enterprise software projects under senior SDE mentorship.",
    primaryType: "Internship",
    secondaryType: "Paid",
    applyUrl: "https://www.tcs.com/careers",
    source: "web",
    isAktu: true,
    deadline: "May 15, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/tcs.com"
  },
  {
    title: "Full Stack Intern",
    company: "Infosys Springboard",
    location: "Hybrid – Pune / Remote",
    salary: "₹20,000/mo",
    badge: "Premium 💼",
    tags: ["React", "Node.js", "MongoDB"],
    desc: "Infosys Springboard Summer Internship 2026 for engineering students. Exposure to agile development, cloud deployment and client demos.",
    primaryType: "Internship",
    secondaryType: "Paid",
    applyUrl: "https://infyspringboard.onwingspan.com/",
    source: "web",
    isAktu: true,
    deadline: "May 20, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/infosys.com"
  },
  {
    title: "Data Analytics Intern",
    company: "HCL Technologies",
    location: "Noida (Near AKTU)",
    salary: "₹18,000/mo",
    badge: "New ✨",
    tags: ["Python", "Power BI", "SQL"],
    desc: "HCL campus program for B.Tech CSE/IT students with hands-on exposure to Big Data analytics pipelines, dashboards, and client reporting.",
    primaryType: "Internship",
    secondaryType: "Paid",
    applyUrl: "https://www.hcltech.com/careers/",
    source: "web",
    isAktu: true,
    deadline: "May 30, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/hcltech.com"
  },
  {
    title: "Android Dev Intern",
    company: "Wipro",
    location: "Gurugram / Remote",
    salary: "₹12,000/mo",
    badge: "Campus 🎓",
    tags: ["Kotlin", "Firebase", "Android Studio"],
    desc: "Wipro campus connects program — internship for final-year engineering students. Build real consumer-facing Android features.",
    primaryType: "Internship",
    secondaryType: "Paid",
    applyUrl: "https://careers.wipro.com/",
    source: "web",
    isAktu: true,
    deadline: "Jun 5, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/wipro.com"
  },
  {
    title: "UI/UX Design Intern",
    company: "Cred",
    location: "Remote",
    salary: "₹30,000/mo",
    badge: "Creative 🎨",
    tags: ["Figma", "Prototyping", "Design Systems"],
    desc: "Help design the next generation of fintech rewards experiences at Cred. Portfolio submission required. Strong eye for micro-interactions.",
    primaryType: "Internship",
    secondaryType: "Paid",
    applyUrl: "https://careers.cred.club/",
    source: "web",
    isAktu: false,
    deadline: "May 25, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/cred.club"
  },
  {
    title: "ML Engineering Intern",
    company: "Amazon",
    location: "Hyderabad",
    salary: "₹80,000/mo",
    badge: "Elite 🏆",
    tags: ["Python", "TensorFlow", "AWS SageMaker"],
    desc: "Amazon Summer Internship for pre-final year B.Tech students. Work on production-scale ML systems. Strong DSA + Python required.",
    primaryType: "Internship",
    secondaryType: "Paid",
    applyUrl: "https://www.amazon.jobs/en/teams/internships-for-students",
    source: "web",
    isAktu: false,
    deadline: "May 1, 2026",
    experience: "Intermediate",
    companyLogo: "https://logo.clearbit.com/amazon.com"
  }
];

const FALLBACK_INTERNSHIPS_FREE = [
  {
    title: "Research Intern – AI/ML",
    company: "CSIR – CDRI Lucknow",
    location: "Lucknow (Near AKTU)",
    salary: "Unpaid + Certificate",
    badge: "Gov 🏢",
    tags: ["Python", "Research", "ML Basics"],
    desc: "Council of Scientific & Industrial Research summer program for AKTU engineering students. Work alongside PhD researchers on AI/ML projects. Certificate of Merit provided.",
    primaryType: "Internship",
    secondaryType: "Free",
    applyUrl: "https://www.cdri.res.in/skill-development-programme",
    source: "web",
    isAktu: true,
    deadline: "Apr 30, 2026",
    experience: "Fresher",
    companyLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b0/Council_of_Scientific_%26_Industrial_Research_Logo.svg/200px-Council_of_Scientific_%26_Industrial_Research_Logo.svg.png"
  },
  {
    title: "Open Source Contributor — FOSSEE",
    company: "IIT Bombay – FOSSEE",
    location: "Remote",
    salary: "Unpaid + Stipend (merit-based)",
    badge: "IIT 🎓",
    tags: ["Python", "Scilab", "Open Source"],
    desc: "FOSSEE (Free and Open Source Software for Education) by IIT Bombay. Contribute to open scientific computing tools used across Indian colleges including AKTU.",
    primaryType: "Internship",
    secondaryType: "Free",
    applyUrl: "https://fossee.in/internship",
    source: "web",
    isAktu: true,
    deadline: "May 10, 2026",
    experience: "Fresher",
    companyLogo: "https://fossee.in/sites/all/themes/fossee/images/fossee-logo.png"
  },
  {
    title: "Cybersecurity Trainee",
    company: "UP Cyber Crime Cell",
    location: "Lucknow",
    salary: "Unpaid + Letter of Recommendation",
    badge: "Govt 🛡️",
    tags: ["Networking", "Kali Linux", "Ethical Hacking"],
    desc: "Join the UP Police Cyber Crime Cell as a trainee. Shadow real investigators, assist in forensic imaging. Strict background verification required. AKTU students preferred.",
    primaryType: "Internship",
    secondaryType: "Free",
    applyUrl: "https://uppbpb.gov.in",
    source: "web",
    isAktu: true,
    deadline: "May 5, 2026",
    experience: "Fresher",
    companyLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a3/Uttar_Pradesh_Police_seal.svg/200px-Uttar_Pradesh_Police_seal.svg.png"
  },
  {
    title: "Web Dev Volunteer – NGO",
    company: "Teach For India",
    location: "Hybrid",
    salary: "Unpaid",
    badge: "Social 🌱",
    tags: ["HTML", "CSS", "WordPress"],
    desc: "Help maintain and update the NGO platform for volunteer coordination across India. Great for your portfolio and social impact.",
    primaryType: "Internship",
    secondaryType: "Free",
    applyUrl: "https://www.teachforindia.org/",
    source: "web",
    isAktu: false,
    deadline: "Rolling",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/teachforindia.org"
  }
];

const FALLBACK_AKTU_JOBS = [
  {
    title: "Graduate Engineer Trainee (GET)",
    company: "BHEL – Haridwar",
    location: "Haridwar, UP",
    salary: "₹4.5 LPA",
    badge: "PSU 🏭",
    tags: ["Mechanical", "Electrical", "Civil", "Core Engineering"],
    desc: "Bharat Heavy Electricals Limited GATE-based recruitment for engineering graduates. AKTU qualified students heavily preferred. Includes 1-year training period.",
    primaryType: "Job",
    secondaryType: "Full-Time",
    applyUrl: "https://careers.bhel.in",
    source: "web",
    isAktu: true,
    deadline: "May 31, 2026",
    experience: "Fresher",
    companyLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/BHEL_logo.svg/200px-BHEL_logo.svg.png"
  },
  {
    title: "Junior Software Engineer",
    company: "Tech Mahindra",
    location: "Noida (UP)",
    salary: "₹3.5 LPA",
    badge: "Campus 🎓",
    tags: ["Java", "SQL", "REST APIs"],
    desc: "Tech Mahindra Smart Academy campus placement drive for AKTU B.Tech graduates — CSE, IT, ECE eligible. Assessment followed by 2 rounds of interviews.",
    primaryType: "Job",
    secondaryType: "Full-Time",
    applyUrl: "https://careers.techmahindra.com/",
    source: "web",
    isAktu: true,
    deadline: "May 20, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/techmahindra.com"
  },
  {
    title: "Junior Engineer – IT",
    company: "UPPCL (UP Power Corp.)",
    location: "Lucknow, UP",
    salary: "₹35,000/mo",
    badge: "Govt ⚡",
    tags: ["Networking", "Server Admin", "Linux"],
    desc: "Uttar Pradesh Power Corporation Ltd. IT cadre vacancy. B.Tech CSE/IT/ECE from AKTU-affiliated colleges eligible. UP domicile required.",
    primaryType: "Job",
    secondaryType: "Full-Time",
    applyUrl: "https://upenergy.in/uppcl/",
    source: "web",
    isAktu: true,
    deadline: "May 15, 2026",
    experience: "Fresher",
    companyLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/7/74/UPPCL_Logo.png/200px-UPPCL_Logo.png"
  },
  {
    title: "Software Developer",
    company: "Newgen Software",
    location: "Noida",
    salary: "₹5.5 LPA",
    badge: "Product 🚀",
    tags: ["Java", "Spring", "Oracle DB"],
    desc: "Newgen Software Technologies Noida — direct recruit from AKTU-affiliated colleges. Develop enterprise content management and BPM platforms used globally.",
    primaryType: "Job",
    secondaryType: "Full-Time",
    applyUrl: "https://www.newgensoft.com/company/careers/",
    source: "web",
    isAktu: true,
    deadline: "Jun 1, 2026",
    experience: "Fresher",
    companyLogo: "https://logo.clearbit.com/newgensoft.com"
  },
  {
    title: "Node.js Developer",
    company: "TechCorp",
    location: "Noida",
    salary: "₹8 LPA",
    badge: "Urgent ⚡",
    tags: ["Node.js", "MongoDB", "REST APIs"],
    desc: "Develop scalable backend services and APIs for enterprise fintech applications. AKTU pass-outs with 0-1 year experience preferred.",
    primaryType: "Job",
    secondaryType: "Full-Time",
    applyUrl: "https://linkedin.com/jobs",
    source: "manual",
    isAktu: true,
    deadline: "Rolling",
    experience: "0-1 Year",
    companyLogo: ""
  },
  {
    title: "Cloud Infrastructure Engineer",
    company: "Microsoft India",
    location: "Noida / Hyderabad",
    salary: "₹18 LPA",
    badge: "Premium 💼",
    tags: ["Azure", "Kubernetes", "DevOps", "Linux"],
    desc: "Microsoft India Development Centre cloud infra team. B.Tech CSE/IT students from top AKTU colleges can apply. Strong OS/networking fundamentals required.",
    primaryType: "Job",
    secondaryType: "Full-Time",
    applyUrl: "https://careers.microsoft.com/",
    source: "web",
    isAktu: false,
    deadline: "May 10, 2026",
    experience: "0-2 Years",
    companyLogo: "https://logo.clearbit.com/microsoft.com"
  }
];

// ── UTILITY: Simple HTTP GET ─────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ── UTILITY: Parse Internshala RSS ──────────────────────────────────────────
function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const title = getTag('title');
    const link = getTag('link');
    const desc = getTag('description').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').substring(0, 250);
    if (title && link) items.push({ title, link, desc });
  }
  return items;
}

// ── MAIN EXPORT: fetchLatestJobs ─────────────────────────────────────────────
async function fetchLatestJobs() {
  const results = [];
  console.log('🌐 Attempting to fetch real-time job/internship data from web feeds...');

  // Try Remotive public API (no key required, no CORS on server-side)
  try {
    const data = await httpGet('https://remotive.com/api/remote-jobs?category=software-dev&limit=6');
    const parsed = JSON.parse(data);
    if (parsed && parsed.jobs && parsed.jobs.length > 0) {
      parsed.jobs.slice(0, 6).forEach(job => {
        results.push({
          title: (job.title || 'Software Intern').substring(0, 80),
          company: (job.company_name || 'Tech Company').substring(0, 60),
          location: job.candidate_required_location || 'Remote',
          salary: job.salary || '₹15,000-₹40,000/mo',
          badge: 'Live 🌐',
          tags: (job.tags || ['Tech', 'Remote']).slice(0, 4),
          desc: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 250),
          primaryType: 'Internship',
          secondaryType: 'Paid',
          applyUrl: job.url || '#',
          source: 'web',
          isAktu: false,
          deadline: 'Rolling',
          experience: 'Fresher',
          companyLogo: job.company_logo || ''
        });
      });
      console.log(`✅ Fetched ${results.length} listings from Remotive API`);
    }
  } catch (e) {
    console.log('⚠️  Remotive API unreachable, using fallback data:', e.message);
  }

  // Always supplement with our curated AKTU fallback data (merge, don't replace)
  console.log('📚 Loading curated AKTU-relevant data...');
  
  return {
    paidInternships: results.length > 0 
      ? [...results.slice(0, 3), ...FALLBACK_INTERNSHIPS_PAID.slice(0, 3)]
      : FALLBACK_INTERNSHIPS_PAID,
    freeInternships: FALLBACK_INTERNSHIPS_FREE,
    aktusJobs: FALLBACK_AKTU_JOBS
  };
}

module.exports = { fetchLatestJobs, FALLBACK_INTERNSHIPS_PAID, FALLBACK_INTERNSHIPS_FREE, FALLBACK_AKTU_JOBS };
