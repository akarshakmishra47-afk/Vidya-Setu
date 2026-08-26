require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Scholarship = require('./models/Scholarship');

const seedData = [
  // ── GOVERNMENT ──────────────────────────────────────────────
  {
    title: "UP Post-Matric Scholarship (SC/ST/OBC/General)",
    provider: "Samaj Kalyan Vibhag — Govt. of Uttar Pradesh",
    category: "Government",
    amount: "Full Tuition Fee Reimbursement",
    deadline: "November 30, 2026",
    description: "The flagship state scholarship for students from economically weaker sections studying in UP institutions. Covers full tuition fee and maintenance allowance directly via DBT.",
    officialUrl: "https://scholarship.up.gov.in",
    tags: ["UP", "State", "SC", "ST", "OBC", "General", "EWS", "Tuition Fee"],
    howToApply: [
      "Go to scholarship.up.gov.in and click 'Student Registration'.",
      "Register using your Aadhaar-linked mobile number and create a password.",
      "Fill in personal details: name, category, district, course, and college.",
      "Upload required documents — Income Certificate, Caste Certificate, Aadhaar, Fee Receipt, and Marksheet.",
      "Submit the form and note your Application Reference Number.",
      "Verify your application at your college/institute within the deadline.",
      "Track status on the portal under 'Track Application'."
    ],
    eligibility: { maxIncome: 200000, allowedCategories: ['SC', 'ST', 'OBC'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Caste Certificate', 'Aadhaar Card', 'Fee Receipt', 'Previous Year Marksheet', 'Bank Passbook']
  },
  {
    title: "UP Post-Matric Scholarship (General / EWS)",
    provider: "Samaj Kalyan Vibhag — Govt. of Uttar Pradesh",
    category: "Government",
    amount: "₹2,000 – ₹5,000/yr (Maintenance Allowance)",
    deadline: "November 30, 2026",
    description: "Extended scholarship for General category students under the Economically Weaker Section (EWS) criterion studying in UP state institutions.",
    officialUrl: "https://scholarship.up.gov.in",
    tags: ["UP", "State", "General", "EWS"],
    howToApply: [
      "Visit scholarship.up.gov.in and select 'General/EWS Student Registration'.",
      "Complete profile with income proof and EWS certificate.",
      "Attach domicile certificate proving UP residency.",
      "Submit institute-verified application before the deadline.",
      "Track status: 'View Application' section."
    ],
    eligibility: { maxIncome: 200000, allowedCategories: ['General', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['EWS Certificate', 'Income Certificate', 'Domicile Certificate', 'Aadhaar Card', 'Fee Receipt']
  },
  {
    title: "NSP — Central Sector Scheme of Scholarship (CSS)",
    provider: "Ministry of Education, Govt. of India",
    category: "Government",
    amount: "₹10,000/yr (Fresher) | ₹20,000/yr (PG)",
    deadline: "October 31, 2026",
    description: "Central government merit-based scholarship via the National Scholarship Portal (NSP) for students who scored above the 80th percentile in Class 12 board exams.",
    officialUrl: "https://scholarships.gov.in",
    tags: ["NSP", "National", "Merit", "Central Govt", "12th Topper"],
    howToApply: [
      "Visit scholarships.gov.in — the official National Scholarship Portal.",
      "Click 'New Registration' and complete OTP verification with Aadhaar.",
      "Select 'Ministry of Education → Central Sector Scheme'.",
      "Fill academic details: board, percentage, institution, course.",
      "Upload income certificate, Aadhaar, and Class 12 marksheet.",
      "Submit and track via Student Dashboard on NSP."
    ],
    eligibility: { maxIncome: 450000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Class 12 Marksheet', 'Income Certificate', 'Aadhaar Card', 'Bank Account Details', 'Current Enrollment Certificate']
  },
  {
    title: "NSP — Post-Matric Scholarship for SC Students",
    provider: "Ministry of Social Justice, Govt. of India",
    category: "Government",
    amount: "As per course (Full fee + maintenance)",
    deadline: "October 31, 2026",
    description: "Central scholarship for Scheduled Caste students pursuing post-matriculation or post-secondary courses anywhere in India.",
    officialUrl: "https://scholarships.gov.in",
    tags: ["NSP", "SC", "Scheduled Caste", "National", "Post-Matric"],
    howToApply: [
      "Log in to scholarships.gov.in with your Student registration.",
      "Select 'Ministry of Social Justice → Post-Matric Scholarship for SC'.",
      "Fill all mandatory fields accurately — caste and income are mandatory.",
      "Upload Caste Certificate (SC), Income Certificate, Fee Receipt.",
      "Submit and get it verified by your college nodal officer."
    ],
    eligibility: { maxIncome: 250000, allowedCategories: ['SC'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['SC Caste Certificate', 'Income Certificate', 'Aadhaar Card', 'Fee Receipt', 'Marksheet']
  },

  // ── DEFENCE ─────────────────────────────────────────────────
  {
    title: "PMSS — Prime Minister's Scholarship Scheme (Ex-Servicemen)",
    provider: "Kendriya Sainik Board, Ministry of Defence",
    category: "Defence",
    amount: "₹3,000/month (Boys) | ₹3,600/month (Girls)",
    deadline: "October 15, 2026",
    description: "Exclusive scholarship for dependent wards and widows of Ex-Servicemen / Ex-Coast Guard personnel pursuing 1st year of technical, medical, or professional degree programs.",
    officialUrl: "https://ksb.gov.in/pmss.htm",
    tags: ["PMSS", "Ex-Servicemen", "Defence", "Army", "Navy", "Air Force", "Coast Guard"],
    howToApply: [
      "Visit ksb.gov.in and click on 'PMSS Online Application'.",
      "Register with Ex-Serviceman's PPO number and pensioner details.",
      "Fill in ward (student) personal and academic details.",
      "Upload: Ex-Serviceman ID Card / Discharge Book, Aadhaar, admission letter.",
      "For martyrs/disabled: attach relevant PCDA certificate.",
      "Submit online — no physical copy required.",
      "Merit list is published on the KSB portal after the deadline."
    ],
    eligibility: { maxIncome: 99999999, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: true, isCapfRequired: false },
    documentsRequired: ['Ex-Serviceman ID / Discharge Book', 'Aadhaar Card', 'PPO Copy (if retired)', 'Admission Letter', 'Marksheet', 'Bank Account Details']
  },
  {
    title: "Honourble Mention Scholarship — Army Welfare Education Society (AWES)",
    provider: "AWES / Army Welfare",
    category: "Defence",
    amount: "₹1,500 – ₹8,000/month",
    deadline: "September 30, 2026",
    description: "Scholarship for wards of serving Army personnel for pursuing professional degree programs in engineering, medical, and management.",
    officialUrl: "https://www.awesindia.com",
    tags: ["Army", "AWES", "Serving Personnel", "Defence"],
    howToApply: [
      "Visit awesindia.com and navigate to the Scholarships section.",
      "Download the application form and fill it offline.",
      "Attach service certificate from Commanding Officer.",
      "Submit via the soldier's unit records office.",
      "Results are communicated through the unit."
    ],
    eligibility: { maxIncome: 99999999, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: true, isCapfRequired: false },
    documentsRequired: ['Serving Certificate from CO', 'Aadhaar Card', 'Admission Proof', 'Marksheet']
  },

  // ── CAPF ────────────────────────────────────────────────────
  {
    title: "PMSS — Prime Minister's Scholarship for CAPF / AR",
    provider: "Ministry of Home Affairs, Govt. of India",
    category: "CAPF",
    amount: "₹3,000/month (Boys) | ₹3,600/month (Girls)",
    deadline: "December 15, 2026",
    description: "Scholarship for dependent wards of Central Armed Police Forces (CRPF, BSF, CISF, ITBP, SSB, NSG) and Assam Rifles personnel. Martyrs and disabled personnel get priority.",
    officialUrl: "https://scholarships.gov.in",
    tags: ["CAPF", "CRPF", "BSF", "CISF", "ITBP", "SSB", "NSG", "Assam Rifles", "PMSS"],
    howToApply: [
      "Go to scholarships.gov.in, register or log in.",
      "Select 'Ministry of Home Affairs → PMSS for CAPF & AR'.",
      "Enter your parent's CAPF service details accurately.",
      "Upload: Service certificate, Aadhaar, Admission Letter, Marksheet.",
      "For martyr/disabled: PPO/Disability certificate from the department.",
      "Submit within deadline and track status on NSP portal."
    ],
    eligibility: { maxIncome: 99999999, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: true },
    documentsRequired: ['CAPF Service Certificate', 'Aadhaar Card', 'Admission Letter', 'PPO (if retired)', 'Disability Certificate (if applicable)', 'Marksheet']
  },
  {
    title: "PMSS – Wards of State/UT Police personnel martyred in Terror/Naxal attacks",
    provider: "Ministry of Home Affairs, Govt. of India",
    category: "CAPF",
    amount: "₹3,000/month (Boys) | ₹3,600/month (Girls)",
    deadline: "October 31, 2026",
    description: "For eligible wards of police personnel who died during qualifying terror/Naxal attacks.",
    officialUrl: "https://scholarships.gov.in/All-Scholarships?utm_source=chatgpt.com",
    tags: ["PMSS", "Police", "State Police", "UT Police", "Martyrs"],
    howToApply: [
      "Go to scholarships.gov.in, register or log in.",
      "Select 'Ministry of Home Affairs → PMSS for State/UT Police'.",
      "Upload necessary documents including the certificate of martyrdom.",
      "Submit within the deadline and track status on the NSP portal."
    ],
    eligibility: { maxIncome: 99999999, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Martyrdom Certificate', 'Aadhaar Card', 'Admission Letter', 'Marksheet']
  },

  // ── PRIVATE / NGO ────────────────────────────────────────────
  {
    title: "HDFC Bank Parivartan ECSS Programme 2026-27",
    provider: "HDFC Bank (Parivartan)",
    category: "Private/NGO",
    amount: "₹15,000 to ₹75,000",
    deadline: "Check Official Website",
    description: "A scholarship initiative by HDFC Bank providing financial assistance to meritorious students with limited financial means. Open to students from Class 1 to PG level. Preference given to those facing personal or family crises.",
    officialUrl: "https://www.parivartanecss.com",
    tags: ["HDFC", "Private", "CSR", "School", "UG", "PG", "Diploma", "Crisis Support"],
    howToApply: [
      "Visit the official website: www.parivartanecss.com",
      "Select your applicable education category (Classes 1-12, Diploma, UG, or PG).",
      "Create an account or log in to start the application.",
      "Fill in personal, academic, and financial details.",
      "Upload required documents, including proof of crisis (if applicable).",
      "Submit the application."
    ],
    eligibility: { maxIncome: 600000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Aadhaar Card', 'Previous Year Marksheet', 'Current Year Admission Proof', 'Proof of Crisis (if any)', 'Bank Account Details']
  },
  {
    title: "Reliance Foundation Undergraduate Scholarship 2026-27",
    provider: "Reliance Foundation",
    category: "Private/NGO",
    amount: "Up to ₹2,00,000 over 4 years",
    deadline: "January 12, 2027",
    description: "Merit-cum-means scholarship for undergraduate students across India pursuing engineering, pure sciences, social sciences, or humanities. Includes mentoring and networking.",
    officialUrl: "https://www.scholarships.reliancefoundation.org/UG_Scholarship",
    tags: ["Reliance", "Private", "Merit", "Need-based", "Engineering", "Science"],
    howToApply: [
      "Visit reliancefoundation.org/scholarships and click 'Apply Now'.",
      "Register with your email and mobile number.",
      "Fill in 12th marks, family income details, and college enrollment.",
      "Write a 500-word essay on your goals and challenges.",
      "Submit application and appear for the online aptitude screening.",
      "Shortlisted candidates will be called for a virtual interview."
    ],
    eligibility: { maxIncome: 1500000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Aadhaar Card', 'Class 12 Marksheet', 'College Enrollment Certificate', 'Bank Details']
  },
  {
    title: "Tata Capital Pankh Scholarship Programme",
    provider: "Tata Capital Ltd.",
    category: "Private/NGO",
    amount: "Up to ₹50,000/yr",
    deadline: "August 31, 2026",
    description: "Scholarship for meritorious but financially needy students pursuing graduation (including engineering). Focuses on students from rural or semi-urban backgrounds.",
    officialUrl: "https://www.tata.com/newsroom/community/tata-capital-pankh-scholarship?utm_source=chatgpt.com",
    tags: ["Tata", "Private", "Need-based", "Engineering", "Rural"],
    howToApply: [
      "Go to buddy4study.com and search 'Tata Capital Pankh'.",
      "Create a free account on Buddy4Study platform.",
      "Fill in personal, academic, and income information.",
      "Upload income certificate, marksheets, and Aadhaar.",
      "Submit application — shortlisted candidates interviewed online."
    ],
    eligibility: { maxIncome: 400000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Aadhaar Card', 'Class 12 Marksheet', 'Admission Proof']
  },

  {
    title: "SBI Platinum Jubilee Asha Scholarship 2026",
    provider: "SBI Foundation",
    category: "Private/NGO",
    amount: "₹15,000 - ₹15,00,000",
    deadline: "October 31, 2026",
    description: "The SBI Platinum Jubilee Asha Scholarship is one of India's largest scholarship initiatives, supporting meritorious students from economically weaker backgrounds — from Class 9 all the way to study abroad. It ensures that financial challenges never hinder access to quality education.",
    officialUrl: "https://www.sbiashascholarship.co.in",
    tags: ["SBI", "Asha", "Platinum Jubilee", "Class 9-12", "UG/PG", "Study Abroad"],
    howToApply: [
      "Visit the official SBI Asha Scholarship portal (sbiashascholarship.co.in).",
      "Register using your email or mobile number.",
      "Fill out the online application form with personal and academic details.",
      "Upload required documents (Income Certificate, Aadhaar, previous marksheets).",
      "Submit the application and save the reference number."
    ],
    eligibility: { maxIncome: 300000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Aadhaar', 'Previous Year Marksheet', 'Bank Passbook']
  },
  {
    title: "LIC Golden Jubilee Scholarship — B.Tech",
    provider: "LIC Golden Jubilee Foundation",
    category: "Private/NGO",
    amount: "₹30,000 per year",
    deadline: "Check Official Website",
    description: "Scholarship for students from economically weaker sections pursuing BE / B.Tech / B.Arch in India. Paid in 2 instalments of ₹15,000 and available for the duration of the course.",
    officialUrl: "https://www.licindia.in/en/web/guest/golden-jubilee-foundation?utm_source=chatgpt.com",
    tags: ["LIC", "Private", "B.Tech", "B.Arch", "Need-based"],
    howToApply: [
      "Visit the official LIC Golden Jubilee Foundation page.",
      "Check the eligibility criteria carefully.",
      "Submit the online application form when active.",
      "Provide necessary documents including Class 12/Diploma marksheet and income proof."
    ],
    eligibility: { maxIncome: 450000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Aadhaar Card', 'Class 12 / Diploma Marksheet', 'Bank Details']
  },

  // ── INSTITUTE ────────────────────────────────────────────────
  {
    title: "AKTU Chancellor's Merit Scholarship",
    provider: "APJ Abdul Kalam Technical University (AKTU)",
    category: "Institute",
    amount: "₹50,000/yr",
    deadline: "January 15, 2027",
    description: "Awarded to the top 100 university rank holders across AKTU-affiliated colleges based on cumulative semester CGPA. No income restriction.",
    officialUrl: "https://aktu.ac.in",
    tags: ["AKTU", "Merit", "University Rank", "Engineering", "Institute"],
    howToApply: [
      "No separate application required — AKTU identifies toppers automatically.",
      "Ensure your CGPA and enrollment details are updated in the AKTU portal.",
      "The list is published after the final semester results of each year.",
      "Amount is directly credited to your registered bank account via DBT.",
      "Contact your college examination cell for any discrepancy."
    ],
    eligibility: { maxIncome: 99999999, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['University Marksheet', 'College ID Card', 'Bank Account Details']
  },

];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    // Removed deleteMany to prevent wiping other scholarships in the DB
    // await Scholarship.deleteMany({});
    // console.log('🗑️  Cleared existing scholarships');
    let count = 0;
    for (const s of seedData) {
      const doc = {
        ...s,
        source: 'seed',
        deduplicationKey: 'seed::' + s.title.toLowerCase().replace(/\s+/g, ''),
        status: 'active',
        isActive: true
      };
      await Scholarship.updateOne(
        { deduplicationKey: doc.deduplicationKey },
        { $set: doc },
        { upsert: true }
      );
      count++;
      console.log(`  ${count}. [${s.category}] ${s.title}`);
    }
    console.log(`🎉 Successfully seeded ${count} Scholarships!`);
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Error seeding Scholarships:', err.message);
  });
