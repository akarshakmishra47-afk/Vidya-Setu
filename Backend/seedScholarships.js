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

  // ── PRIVATE / NGO ────────────────────────────────────────────
  {
    title: "Reliance Foundation Undergraduate Scholarship",
    provider: "Reliance Foundation",
    category: "Private/NGO",
    amount: "Up to ₹2,00,000 over 4 years",
    deadline: "January 12, 2027",
    description: "Merit-cum-means scholarship for undergraduate students across India pursuing engineering, pure sciences, social sciences, or humanities. Includes mentoring and networking.",
    officialUrl: "https://www.reliancefoundation.org/scholarships",
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
    officialUrl: "https://www.buddy4study.com/page/tata-capital-pankh-scholarship",
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
    title: "L'Oréal India For Young Women in Science",
    provider: "L'Oréal India",
    category: "Private/NGO",
    amount: "₹2,50,000 (one-time)",
    deadline: "October 30, 2026",
    description: "Scholarship exclusively for female students pursuing pure sciences (Physics, Chemistry, Biology, Mathematics) at undergraduate level from any Indian university.",
    officialUrl: "https://www.lorealparisbeautyforall.com/scholarships",
    tags: ["Women", "Science", "Girls", "STEM", "Private"],
    howToApply: [
      "Visit L'Oréal India website and go to the Scholarship section.",
      "Fill in the scholarship application form with academic and personal details.",
      "Submit a research proposal or motivation letter.",
      "Shortlisted candidates go through a personal interview.",
      "Awards are announced annually in March."
    ],
    eligibility: { maxIncome: 99999999, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Aadhaar Card', 'Class 12 Marksheet', 'Admission Proof', 'Recommendation Letter']
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
  {
    title: "AICTE Pragati Scholarship (Girls in Technical Education)",
    provider: "AICTE, Ministry of Education",
    category: "Government",
    amount: "₹50,000/yr + ₹2,000/month contingency",
    deadline: "November 30, 2026",
    description: "Scholarship exclusively for girl students in AICTE-approved diploma/degree technical programs. One scholarship per family. Promotes women in STEM fields.",
    officialUrl: "https://www.aicte-india.org/bureaus/pgms/pragati",
    tags: ["AICTE", "Girls", "Women", "Technical", "Engineering", "Government"],
    howToApply: [
      "Visit aicte-india.org and go to 'Pragati / Saksham Scholarship'.",
      "Register & login via the AICTE scholarship portal.",
      "Fill in your technical program details and AICTE-recognized institution name.",
      "Upload income proof, Aadhaar, fee receipt, and enrollment certificate.",
      "Only one girl per family can apply.",
      "Submit online before the deadline and note your reference number."
    ],
    eligibility: { maxIncome: 800000, allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'], isDefenceRequired: false, isCapfRequired: false },
    documentsRequired: ['Income Certificate', 'Aadhaar Card', 'Fee Receipt', 'AICTE Institution Code', 'Enrollment Certificate', 'Affidavit (one girl per family)']
  }
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await Scholarship.deleteMany({});
    console.log('🗑️  Cleared existing scholarships');
    const inserted = await Scholarship.insertMany(seedData);
    console.log(`🎉 Successfully seeded ${inserted.length} Scholarships!`);
    inserted.forEach((s, i) => console.log(`  ${i+1}. [${s.category}] ${s.title}`));
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Error seeding Scholarships:', err.message);
  });
