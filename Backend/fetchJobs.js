/**
 * fetchJobs.js
 * Fetches real-time internship & job listings from Remotive and Arbeitnow APIs.
 * Filters for B.Tech/engineering students (internships, entry-level, junior roles).
 * Removes senior positions and maintains ~100 curated listings.
 * Automatically refreshes every 60 minutes with error resilience.
 */

const https = require('https');
const http = require('http');

// ── CONFIGURATION ───────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = Number(process.env.JOBS_REFRESH_MS) || (60 * 60 * 1000); // 60 minutes default
const TIMEOUT_MS = 12000; // API request timeout
const TARGET_TOTAL_JOBS = 100; // Target ~100 jobs
const TARGET_INTERNSHIPS = 35; // Target 30-40 internships
const MIN_JOBS = 60; // Minimum jobs if internships can't fill quota

// ── REFRESH STATE ────────────────────────────────────────────────────────────
let isRefreshing = false;
let lastRefreshTime = null;
let lastRefreshError = null;
let refreshStartTime = null;

// ── KEYWORDS FOR FILTERING ──────────────────────────────────────────────────
const SENIOR_KEYWORDS = [
  'senior', 'sr.', 'sr ', 'lead', 'tech lead', 'principal', 'staff',
  'architect', 'director', 'vice president', 'vp ', 'head of', 'manager',
  '5+ years', '6+ years', '7+ years', '8+ years', '10+ years'
];

const PRIORITY_KEYWORDS = [
  'internship', 'intern', 'fresher', 'freshers', 'graduate', 'graduate trainee',
  'trainee', 'entry level', 'entry-level', 'junior', 'student', 'apprentice',
  'new grad'
];

const TECH_ROLE_KEYWORDS = [
  'software engineer', 'software developer', 'web developer', 'frontend developer',
  'backend developer', 'full stack developer', 'react developer', 'node.js developer',
  'java developer', 'python developer', 'data analyst', 'data science', 'machine learning',
  'artificial intelligence', 'ai/ml', 'cloud', 'devops', 'cybersecurity', 'qa engineer',
  'test engineer', 'automation engineer', 'network engineer', 'database', 'embedded', 'electronics'
];

const RELEVANT_BRANCHES = [
  'b.tech', 'b.e.', 'engineering', 'cse', 'it', 'ece', 'eee', 'mechanical',
  'civil', 'mtech', 'computer science', 'information technology'
];

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
function httpGet(url, retries = 3, delayMs = 1000) {
  return new Promise(async (resolve, reject) => {
    const attemptRequest = async (attempt) => {
      try {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
          timeout: TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            // Check if response is valid JSON or HTML (rate limiting)
            if (data.trim().startsWith('<')) {
              if (attempt < retries) {
                console.log(`⚠️  Got HTML response, retrying (attempt ${attempt + 1}/${retries})...`);
                setTimeout(() => attemptRequest(attempt + 1), delayMs * Math.pow(2, attempt));
              } else {
                reject(new Error('API returned HTML (rate limited or server error)'));
              }
            } else {
              resolve(data);
            }
          });
        });
        req.on('error', (error) => {
          if (attempt < retries) {
            console.log(`⚠️  Request failed, retrying (attempt ${attempt + 1}/${retries})...`);
            setTimeout(() => attemptRequest(attempt + 1), delayMs * Math.pow(2, attempt));
          } else {
            reject(error);
          }
        });
        req.on('timeout', () => {
          req.destroy();
          if (attempt < retries) {
            console.log(`⚠️  Request timeout, retrying (attempt ${attempt + 1}/${retries})...`);
            setTimeout(() => attemptRequest(attempt + 1), delayMs * Math.pow(2, attempt));
          } else {
            reject(new Error('Request timed out'));
          }
        });
      } catch (error) {
        reject(error);
      }
    };
    attemptRequest(0);
  });
}

// ── UTILITY: Normalize string for comparison ──────────────────────────────────
function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── UTILITY: Check if job matches senior keywords (exclusion) ──────────────────
function isSeniorPosition(title, desc = '') {
  const combined = `${title} ${desc}`.toLowerCase();
  return SENIOR_KEYWORDS.some(keyword => combined.includes(keyword));
}

// ── UTILITY: Score job relevance for B.Tech/engineering ─────────────────────
function scoreJobRelevance(job) {
  let score = 0;
  const titleLower = (job.title || '').toLowerCase();
  const descLower = (job.desc || '').toLowerCase();
  const locLower = (job.location || '').toLowerCase();
  const combined = `${titleLower} ${descLower} ${locLower}`;

  // Priority keywords boost score
  PRIORITY_KEYWORDS.forEach(keyword => {
    if (titleLower.includes(keyword)) score += 10;
    if (descLower.includes(keyword)) score += 5;
  });

  // Tech role keywords
  TECH_ROLE_KEYWORDS.forEach(keyword => {
    if (titleLower.includes(keyword)) score += 8;
    if (descLower.includes(keyword)) score += 3;
  });

  // Branch relevance
  RELEVANT_BRANCHES.forEach(branch => {
    if (combined.includes(branch)) score += 5;
  });

  // Type bonus
  if (job.primaryType === 'Internship') score += 15;
  if (job.secondaryType === 'Paid') score += 3;

  // AKTU bonus
  if (job.isAktu) score += 5;

  return Math.max(0, score);
}

// ── UTILITY: Deduplicate jobs ────────────────────────────────────────────────
function deduplicateJobs(jobs) {
  const seen = new Map();
  const deduplicated = [];

  jobs.forEach(job => {
    const key = `${normalizeString(job.title)}|${normalizeString(job.company)}|${normalizeString(job.location)}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      deduplicated.push(job);
    }
  });

  return deduplicated;
}

// ── UTILITY: Fetch from Remotive API ─────────────────────────────────────────
async function fetchRemotiveJobs() {
  try {
    console.log('🔄 Fetching from Remotive API...');
    
    // Remotive has no key requirement for public API
    const response = await httpGet('https://remotive.com/api/remote-jobs?limit=300');
    const data = JSON.parse(response);

    if (!data.jobs || !Array.isArray(data.jobs)) {
      console.log('⚠️  Remotive: No jobs in response');
      return [];
    }

    const jobs = data.jobs
      .filter(job => !isSeniorPosition(job.title, job.description))
      .map(job => ({
        title: (job.title || 'Remote Position').substring(0, 100),
        company: (job.company_name || 'Tech Company').substring(0, 80),
        location: job.candidate_required_location || 'Remote',
        salary: job.salary || 'Not specified',
        badge: 'Live 🌐',
        tags: Array.isArray(job.tags) ? job.tags.slice(0, 5) : ['Tech', 'Remote'],
        desc: (job.description || '').replace(/<[^>]*>/g, '').substring(0, 300),
        primaryType: job.title.toLowerCase().includes('intern') ? 'Internship' : 'Job',
        secondaryType: 'Full-Time',
        applyUrl: job.url || '#',
        source: 'remotive',
        isAktu: false,
        deadline: 'Rolling',
        experience: job.title.toLowerCase().includes('intern') ? 'Fresher' : '0-2 Years',
        companyLogo: job.company_logo || '',
        relevanceScore: 0 // Will be calculated
      }))
      .map(job => ({ ...job, relevanceScore: scoreJobRelevance(job) }))
      .filter(job => job.relevanceScore > 0);

    console.log(`✅ Remotive: Fetched and filtered ${jobs.length} relevant jobs`);
    return jobs;
  } catch (error) {
    console.error(`❌ Remotive API error: ${error.message}`);
    lastRefreshError = `Remotive: ${error.message}`;
    return [];
  }
}

// ── UTILITY: Fetch from Arbeitnow API ────────────────────────────────────────
async function fetchArbeithowJobs() {
  try {
    console.log('🔄 Fetching from Arbeitnow API...');
    
    // Arbeitnow has free public API with retry logic
    const response = await httpGet('https://www.arbeitnow.com/api/v2/job_posts', 3, 1000);
    const data = JSON.parse(response);

    if (!data.data || !Array.isArray(data.data)) {
      console.log('⚠️  Arbeitnow: No jobs in response');
      return [];
    }

    const jobs = data.data
      .filter(job => {
        const titleDesc = `${job.title} ${job.description}`.toLowerCase();
        // Filter for engineering/tech roles
        return (titleDesc.includes('engineer') || 
                titleDesc.includes('developer') ||
                titleDesc.includes('programmer') ||
                titleDesc.includes('analyst') ||
                titleDesc.includes('intern') ||
                titleDesc.includes('graduate')) &&
               !isSeniorPosition(job.title, job.description);
      })
      .map(job => {
        const isIntern = job.title.toLowerCase().includes('intern') || job.title.toLowerCase().includes('trainee');
        const isPaid = !job.title.toLowerCase().includes('unpaid') && !job.title.toLowerCase().includes('volunteer');
        return {
          title: (job.title || 'Position').substring(0, 100),
          company: (job.company || 'Company').substring(0, 80),
          location: job.location || 'Not specified',
          salary: job.salary || (isIntern && isPaid ? '₹3-5 LPA' : 'Not specified'),
          badge: 'Live 🌐',
          tags: ['Tech', isIntern ? 'Internship' : 'Job'],
          desc: (job.description || '').substring(0, 300),
          primaryType: isIntern ? 'Internship' : 'Job',
          secondaryType: isIntern ? (isPaid ? 'Paid' : 'Free') : 'Full-Time',
          applyUrl: job.url || '#',
          source: 'arbeitnow',
          isAktu: false,
          deadline: 'Rolling',
          experience: isIntern ? 'Fresher' : '0-2 Years',
          companyLogo: job.company_logo || '',
          relevanceScore: 0
        };
      })
      .map(job => ({ ...job, relevanceScore: scoreJobRelevance(job) }))
      .filter(job => job.relevanceScore > 0);

    console.log(`✅ Arbeitnow: Fetched and filtered ${jobs.length} relevant jobs (${jobs.filter(j => j.primaryType === 'Internship').length} internships)`);
    return jobs;
  } catch (error) {
    console.error(`❌ Arbeitnow API error: ${error.message}`);
    lastRefreshError = `Arbeitnow: ${error.message}`;
    // Return some fallback paid internships to ensure they show up
    console.log('⚠️  Using fallback internships as backup...');
    return FALLBACK_INTERNSHIPS_PAID.slice(0, 10);
  }
}

// ── UTILITY: Fetch from fallback data ────────────────────────────────────────
function getFallbackJobs() {
  return [...FALLBACK_INTERNSHIPS_PAID, ...FALLBACK_INTERNSHIPS_FREE, ...FALLBACK_AKTU_JOBS]
    .map(job => ({ ...job, relevanceScore: scoreJobRelevance(job) }));
}

// ── UTILITY: Curate final job list ───────────────────────────────────────────
function curateJobList(allJobs) {
  // Deduplicate
  const unique = deduplicateJobs(allJobs);
  console.log(`📊 After deduplication: ${unique.length} jobs`);

  // Sort by relevance score
  const sorted = unique.sort((a, b) => {
    // Prioritize internships
    const aTypeBonus = a.primaryType === 'Internship' ? 1000 : 0;
    const bTypeBonus = b.primaryType === 'Internship' ? 1000 : 0;
    return (b.relevanceScore + bTypeBonus) - (a.relevanceScore + aTypeBonus);
  });

  // Split into internships and jobs
  const internships = sorted.filter(j => j.primaryType === 'Internship').slice(0, TARGET_INTERNSHIPS);
  const regularJobs = sorted.filter(j => j.primaryType === 'Job');

  // Calculate how many regular jobs we need
  const jobsNeeded = Math.max(MIN_JOBS, TARGET_TOTAL_JOBS - internships.length);
  const selectedJobs = regularJobs.slice(0, jobsNeeded);

  // Combine
  let final = [...internships, ...selectedJobs];

  // If we still have fewer than target, include more internships or manual fallback
  if (final.length < TARGET_TOTAL_JOBS) {
    const additionalInternships = sorted
      .filter(j => j.primaryType === 'Internship' && !internships.includes(j))
      .slice(0, TARGET_TOTAL_JOBS - final.length);
    final = [...final, ...additionalInternships];
  }

  console.log(`🎯 Final curation: ${final.length} jobs (${internships.length} internships, ${selectedJobs.length} jobs)`);
  return final.slice(0, TARGET_TOTAL_JOBS);
}

// ── MAIN EXPORT: fetchLatestJobs ─────────────────────────────────────────────
async function fetchLatestJobs() {
  try {
    refreshStartTime = Date.now();
    isRefreshing = true;
    lastRefreshError = null;

    console.log('🚀 Starting job fetch cycle...');

    // Fetch from both APIs in parallel
    const [remotiveJobs, arbeithowJobs] = await Promise.all([
      fetchRemotiveJobs().catch(() => []),
      fetchArbeithowJobs().catch(() => [])
    ]);

    console.log(`📦 Collected: ${remotiveJobs.length} from Remotive, ${arbeithowJobs.length} from Arbeitnow`);

    // Combine API results
    let allApiJobs = [...remotiveJobs, ...arbeithowJobs];

    if (allApiJobs.length === 0) {
      console.log('⚠️  No API jobs fetched, using fallback data');
      allApiJobs = getFallbackJobs();
    } else {
      // Add fallback jobs as supplement (preserve manual curated jobs)
      const fallbackManual = FALLBACK_INTERNSHIPS_PAID.concat(FALLBACK_INTERNSHIPS_FREE, FALLBACK_AKTU_JOBS)
        .filter(job => job.source === 'manual');
      allApiJobs = [...allApiJobs, ...fallbackManual];
    }

    // Curate final list
    const curatedJobs = curateJobList(allApiJobs);

    lastRefreshTime = new Date().toISOString();
    isRefreshing = false;

    console.log(`✅ Fetch cycle complete: ${curatedJobs.length} jobs curated`);

    return curatedJobs;
  } catch (error) {
    console.error('❌ Fetch cycle error:', error.message);
    lastRefreshError = error.message;
    isRefreshing = false;
    
    // Return fallback on complete failure
    return getFallbackJobs().slice(0, TARGET_TOTAL_JOBS);
  }
}

// ── STATUS & UTILITY EXPORTS ─────────────────────────────────────────────────
function getRefreshStatus() {
  return {
    isRefreshing,
    lastRefreshTime,
    lastRefreshError,
    refreshIntervalMs: AUTO_REFRESH_MS,
    nextRefreshTime: lastRefreshTime 
      ? new Date(new Date(lastRefreshTime).getTime() + AUTO_REFRESH_MS).toISOString()
      : null,
    refreshDurationMs: refreshStartTime ? Date.now() - refreshStartTime : null
  };
}

module.exports = { 
  fetchLatestJobs, 
  getRefreshStatus,
  FALLBACK_INTERNSHIPS_PAID, 
  FALLBACK_INTERNSHIPS_FREE, 
  FALLBACK_AKTU_JOBS,
  AUTO_REFRESH_MS,
  isRefreshingCurrently: () => isRefreshing
};
