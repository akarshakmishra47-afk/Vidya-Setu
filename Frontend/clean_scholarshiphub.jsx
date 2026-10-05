    function ScholarshipHub() {
      const { user } = useUser();
      const addToast = useToast();
      const [allScholarships, setAllScholarships] = useState([]);
      const [myApplications, setMyApplications] = useState([]);
      const [loading, setLoading] = useState(true);
      const [activeTab, setActiveTab] = useState("all");
      const [searchQuery, setSearchQuery] = useState("");
      const [selectedLevel, setSelectedLevel] = useState("all");
      const [selectedBranch, setSelectedBranch] = useState("all");
      const [selectedYear, setSelectedYear] = useState("all");
      const [selectedPgCourse, setSelectedPgCourse] = useState("all");
      const [selectedSpecialCat, setSelectedSpecialCat] = useState("all");
      const [selectedScope, setSelectedScope] = useState("all");
      const [selectedState, setSelectedState] = useState("all");
      const [selectedGender, setSelectedGender] = useState("all");
      const [sortBy, setSortBy] = useState("deadline");
      const [pipelineStatus, setPipelineStatus] = useState(null);

      const [applyingFor, setApplyingFor] = useState(null);
      const [uploadedDoc, setUploadedDoc] = useState({});
      const [howToApplyScholarship, setHowToApplyScholarship] = useState(null);
      const [activeGuide, setActiveGuide] = useState(null);
      const [customProblems, setCustomProblems] = useState([]);
      const [showReportForm, setShowReportForm] = useState(false);
      const [newProblem, setNewProblem] = useState({ title: "", desc: "" });
      const [isSyncing, setIsSyncing] = useState(false);
      const [syncStep, setSyncStep] = useState(0);

      const [showAI, setShowAI] = useState(false);
      const [aiInput, setAiInput] = useState("");
      const [aiMessages, setAiMessages] = useState([
        { sender: "ai", text: "Hello! I am Vidya AI, trained to assist higher education students with verified scholarships across India: B.Tech / B.E., Postgraduate (M.Tech GATE, UGC NSPGS, MCA, MBA), and Defence / CAPF personnel wards. How can I assist you?" }
      ]);
      const [aiLoading, setAiLoading] = useState(false);

      const handleAiSubmit = () => {
        if (!aiInput.trim()) return;
        const userMsg = aiInput;
        setAiMessages(prev => [...prev, { sender: "user", text: userMsg }]);
        setAiInput("");
        setAiLoading(true);

        setTimeout(() => {
          let response = "I'm here to help higher education scholars! For this query, I recommend checking our verified eligibility guides or contacting your college scholarship nodal officer.";
          const lower = userMsg.toLowerCase();

          if (lower.includes("gate") || lower.includes("m.tech") || lower.includes("mtech") || lower.includes("pg scholarship")) {
            response = "For AICTE PG Scholarship (M.Tech/M.E.), students with a valid GATE/CEED score admitted to AICTE-approved institutions receive ₹12,400/month via DBT. Apply at pgscholarship.aicte-india.org.";
          } else if (lower.includes("defence") || lower.includes("ksb") || lower.includes("ex-servicemen") || lower.includes("army") || lower.includes("pmss")) {
            response = "For Defence wards (PMSS KSB / RMDF / AWES), dependent children and widows of Ex-Servicemen and serving Army personnel pursuing B.Tech or recognized PG courses are eligible for annual stipends ranging from ₹12,000 to ₹36,000/yr on ksb.gov.in and awesindia.com.";
          } else if (lower.includes("capf") || lower.includes("crpf") || lower.includes("bsf") || lower.includes("cisf") || lower.includes("itbp") || lower.includes("warb")) {
            response = "For CAPF wards (CRPF, BSF, CISF, ITBP, SSB, Assam Rifles), the Prime Minister's Scholarship Scheme (WARB/MHA) grants ₹30,000/yr (boys) and ₹36,000/yr (girls) for professional B.Tech and PG courses on scholarships.gov.in.";
          } else if (lower.includes("dbt") || lower.includes("bank") || lower.includes("npci") || lower.includes("account") || lower.includes("seeding")) {
            response = "For DBT/Aadhaar Seeding, visit your home bank branch with your original Aadhaar card and passbook. Request 'Aadhaar Seeding for DBT (Direct Benefit Transfer)'. It typically updates on the NPCI mapper in 24-48 hours.";
          } else if (lower.includes("pragati") || lower.includes("aicte")) {
            response = "For AICTE Pragati (Girls in B.Tech), ensure you have an official 1st year / 2nd year lateral admission allotment letter from state counseling (JoSAA/UPTAC/MHT-CET) and family income certificate < ₹8 Lakh.";
          } else if (lower.includes("single girl") || lower.includes("indira gandhi") || lower.includes("nspgs") || lower.includes("ugc")) {
            response = "UGC offers the National Scholarship for Post Graduate Studies (₹15,000/month) and the Post-Graduate Indira Gandhi Scholarship for Single Girl Child (₹36,200/yr) for regular full-time Master's degree students on scholarships.gov.in.";
          } else if (lower.includes("income") || lower.includes("caste") || lower.includes("certificate")) {
            response = "Ensure your digital income/caste certificate is valid online on your state's revenue portal. Income certificates are valid for 3 financial years.";
          }

          setAiMessages(prev => [...prev, { sender: "ai", text: response }]);
          setAiLoading(false);
        }, 1100);
      };

      const handleSyncExternal = async () => {
        setIsSyncing(true);
        setSyncStep(0);
        setTimeout(() => setSyncStep(1), 800);
        setTimeout(() => setSyncStep(2), 1800);

        try {
          const res = await fetch(`${API_BASE_URL}/api/scholarships/fetch-latest`, { method: 'POST' });
          if (res.ok) {
            await loadData();
            addToast("12-Hour Sync Triggered", "Synchronized verified Central, State, and CSR B.Tech scholarships.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_download</span>, T.success);
          } else {
            await loadData();
            addToast("Data Refreshed", "Loaded latest B.Tech scholarship records.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>, T.teal);
          }
        } catch (e) {
          addToast("Network Notice", "Showing cached verified scholarships.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>, T.warn);
        } finally {
          setIsSyncing(false);
        }
      };

      const TROUBLESHOOTING_GUIDES = [
        {
          id: "dbt",
          title: "DBT / Aadhaar Seeding Not Verified",
          desc: "Bank account is not mapped with NPCI for Direct Benefit Transfer. Scholarship disbursement will fail.",
          icon: "account_balance",
          steps: [
            ["1", "Visit Home Bank Branch", "Carry original Aadhaar Card + Bank Passbook"],
            ["2", "Request Aadhaar Seeding", "Fill the Mandate Form for NPCI Aadhaar Mapping for DBT"],
            ["3", "Check NPCI Status", "Verify on npci.org.in or myaadhaar.uidai.gov.in → Bank Seeding Status"],
            ["4", "Wait 24–48 Hours", "DBT linking updates on government servers within 2 business days"],
            ["5", "Re-verify on Portal", "Log in to NSP or State Portal to ensure DBT status is Active"]
          ]
        },
        {
          id: "mismatch",
          title: "University Data & Enrollment Mismatch",
          desc: "Mismatch between entered marks/roll number and university records reported by institution.",
          icon: "assignment_late",
          steps: [
            ["1", "Verify Enrollment Number", "Check your official University ERP or ID card for the exact format"],
            ["2", "Verify Previous Marks", "Ensure SGPA/CGPA or Percentage accurately matches your official grade card"],
            ["3", "Use Correction Window", "Access the official portal during the correction schedule"],
            ["4", "Submit Hardcopy", "Submit the revised declaration and original marksheets to college nodal officer"]
          ]
        },
        {
          id: "attendance",
          title: "Institute Reported Attendance Below 75%",
          desc: "Application suspect due to low attendance percentage uploaded by college.",
          icon: "event_busy",
          steps: [
            ["1", "Check College Attendance ERP", "Verify your subject-wise attendance with your department"],
            ["2", "Contact HOD / Department Head", "If attendance was marked incorrectly, request a rectification note"],
            ["3", "Submit Valid Proof", "In case of medical or official leave, provide authorized medical certificates"],
            ["4", "College Nodal Resubmission", "Ensure the college scholarship officer forwards the updated verification"]
          ]
        },
        {
          id: "server",
          title: "Portal Server Errors & Session Timeouts",
          desc: "Official government portals (NSP, MahaDBT, UP Saksham) experiencing 500/504 errors.",
          icon: "dns",
          steps: [
            ["1", "Access During Off-Peak Hours", "Try filling forms early morning (5 AM - 8 AM) or late night"],
            ["2", "Clear Cache & Incognito Mode", "Use Chrome Incognito mode with disabled extensions"],
            ["3", "Save Draft After Every Section", "Never leave forms idle; save after completing each educational tab"],
            ["4", "Compress Upload Documents", "Ensure all PDFs/JPEGs are strictly within 50KB-200KB limits"]
          ]
        },
        {
          id: "certificate",
          title: "Invalid Income / Caste Certificate",
          desc: "Digital verification failed due to expired certificate or mismatched name spelling.",
          icon: "description",
          steps: [
            ["1", "Verify on State e-District", "Check application number and certificate validity on state portal"],
            ["2", "Verify Name Spelling", "Name on certificate must match Aadhaar card letter-for-letter"],
            ["3", "Renew Expired Certificate", "Income certificates are strictly valid for 3 financial years only"],
            ["4", "Provide Valid Certificate", "Upload the freshly issued tehsildar/revenue authority certificate"]
          ]
        },
        {
          id: "pending_district",
          title: "Pending at District / State Welfare Committee",
          desc: "Application verified by college but awaiting district welfare officer (DSWO) sanction.",
          icon: "hourglass_empty",
          steps: [
            ["1", "Check Scrutiny Schedule", "District committee verification continues till late academic year"],
            ["2", "Inspect Suspect List", "Verify if your application appears on your college's suspect list"],
            ["3", "Contact District Welfare Officer", "If delayed unreasonably after all verifications, contact your local DSWO"],
            ["4", "Lodge Grievance on Jan Sunwai", "Submit an official ticket on state grievance portals if needed"]
          ]
        }
      ];

      const loadData = async () => {
        setLoading(true);
        try {
          const [res1, res2, res3, res4] = await Promise.all([
            fetch(`${API_BASE_URL}/api/scholarships`),
            Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
            fetch(`${API_BASE_URL}/api/scholarships/issues`),
            fetch(`${API_BASE_URL}/api/scholarships/status`)
          ]);
          setAllScholarships(Array.isArray(await res1.clone().json()) ? await res1.json() : []);
          if (res2.ok) setMyApplications(await res2.json());
          if (res3.ok) setCustomProblems(await res3.json());
          if (res4.ok) setPipelineStatus(await res4.json());
        } catch (e) {
          addToast("Offline Mode", "Showing cached verified B.Tech scholarships", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>, T.warn);
        } finally {
          setLoading(false);
        }
      };

      React.useEffect(() => { loadData(); }, []);

      const handleApply = async () => {
        if (!applyingFor) return;
        addToast("Applying...", "Verifying B.Tech Engineering Eligibility", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sync</span>, T.teal);
        try {
          setApplyingFor(null);
          setUploadedDoc({});
          addToast("Application Recorded", "Your verification documents have been attached.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>, T.success);
        } catch (e) {
          addToast("Network Error", "Could not submit application", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>, T.rose);
        }
      };

      const handleFileUpload = (docName, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedDoc(prev => ({ ...prev, [docName]: e.target.result }));
          addToast("Document Attached", docName + " uploaded successfully.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task</span>, T.teal);
        };
        reader.readAsDataURL(file);
      };

      const TABS = [
        { id: "all", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>school</span> All Verified Schemes</>, c: T.indigo },
        { id: "btech", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>engineering</span> B.Tech / B.E.</>, c: T.indigo },
        { id: "pg", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>menu_book</span> Postgraduate (PG)</>, c: T.indigo },
        { id: "Defence", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>shield</span> Defence Wards</>, c: T.rose },
        { id: "CAPF", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>local_police</span> CAPF Wards</>, c: T.rose },
        { id: "recommended", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>star</span> Recommended</>, c: T.orange },
        { id: "Government", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance</span> Government</>, c: T.success },
        { id: "Private/NGO", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>volunteer_activism</span> CSR / Foundation</>, c: T.orange },
        { id: "dashboard", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>dashboard</span> My Applications</>, c: T.teal },
        { id: "troubleshooting", label: <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>help_center</span> DBT & Portal Help</>, c: T.orange },
      ];

      const LEVEL_OPTIONS = [
        { id: "all", label: "All Education Levels" },
        { id: "btech", label: "B.Tech / B.E. Degree" },
        { id: "pg", label: "Postgraduate (PG / Master’s)" },
        { id: "defence", label: "Defence Personnel Wards" },
        { id: "capf", label: "CAPF Personnel Wards" }
      ];

      const PG_COURSES = [
        { id: "all", label: "All PG Programs" },
        { id: "M.Tech", label: "M.Tech / M.E." },
        { id: "MCA", label: "MCA" },
        { id: "MSc", label: "M.Sc (STEM)" },
        { id: "MBA", label: "MBA" },
        { id: "MA", label: "M.A." },
        { id: "M.Com", label: "M.Com" }
      ];

      const BRANCH_FILTERS = [
        { id: "all", label: "All Engineering Branches" },
        { id: "Computer Science Engineering", label: "Computer Science (CSE / IT)" },
        { id: "Electronics & Communication", label: "Electronics & Comm (ECE)" },
        { id: "Electrical Engineering", label: "Electrical (EEE)" },
        { id: "Mechanical Engineering", label: "Mechanical Engg" },
        { id: "Civil Engineering", label: "Civil Engg" },
        { id: "Chemical Engineering", label: "Chemical Engg" },
        { id: "AI & Data Science", label: "AI, ML & Data Science" },
      ];

      const BTECH_YEARS = [
        { id: "all", label: "All Academic Years" },
        { id: "1st Year", label: "1st Year (Freshers)" },
        { id: "2nd Year", label: "2nd Year (Lateral / Renewal)" },
        { id: "3rd Year", label: "3rd Year" },
        { id: "4th Year", label: "4th Year (Final Year)" },
      ];

      const STATE_OPTIONS = [
        "All States / UTs",
        "Uttar Pradesh",
        "Maharashtra",
        "West Bengal",
        "Odisha",
        "Gujarat",
        "Bihar",
        "Karnataka",
        "Tamil Nadu",
        "Telangana",
        "Andhra Pradesh",
        "Rajasthan",
        "Madhya Pradesh",
        "Delhi",
        "Punjab",
        "Haryana",
        "Kerala",
        "North Eastern Region (Assam, AP, MN, ML, MZ, NL, SK, TR)"
      ];

      const isRecommended = (s) => {
        if (!s.eligibility) return true;
        const { familyIncome = 999999, casteCategory = 'General', defenceDependent = false, capfDependent = false } = user || {};

        if (s.eligibility.maxIncome && familyIncome > s.eligibility.maxIncome) return false;
        if (s.eligibility.allowedCategories && Array.isArray(s.eligibility.allowedCategories) && s.eligibility.allowedCategories.length > 0) {
          if (!s.eligibility.allowedCategories.includes(casteCategory) && !s.eligibility.allowedCategories.includes('All')) return false;
        }
        if (s.eligibility.isDefenceRequired && !defenceDependent) return false;
        if (s.eligibility.isCapfRequired && !capfDependent) return false;

        return true;
      };

      // Comprehensive multi-category filtering engine
      const visibleScholarships = allScholarships.filter(s => {
        // 1. Tab category filter
        if (activeTab === "btech") {
          if (s.isBTechEligible !== true) return false;
        } else if (activeTab === "pg") {
          if (s.isPGEligible !== true) return false;
        } else if (activeTab === "Defence") {
          if (s.isDefenceEligible !== true && s.category !== 'Defence') return false;
        } else if (activeTab === "CAPF") {
          if (s.isCapfEligible !== true && s.category !== 'CAPF') return false;
        } else if (activeTab === "recommended") {
          if (!isRecommended(s)) return false;
        } else if (activeTab === "Government") {
          if (s.category !== 'Government' && s.category !== 'Institute') return false;
        } else if (activeTab === "Private/NGO") {
          if (s.category !== 'Private/NGO' && s.category !== 'Private' && s.category !== 'Corporate') return false;
        }

        // 2. Dropdown Level Filter
        if (selectedLevel === "btech") {
          if (s.isBTechEligible !== true) return false;
        } else if (selectedLevel === "pg") {
          if (s.isPGEligible !== true) return false;
        } else if (selectedLevel === "defence") {
          if (s.isDefenceEligible !== true && s.category !== 'Defence') return false;
        } else if (selectedLevel === "capf") {
          if (s.isCapfEligible !== true && s.category !== 'CAPF') return false;
        }

        // 3. PG Course Filter
        if (selectedPgCourse !== "all") {
          const pgList = Array.isArray(s.pgCourses) ? s.pgCourses : [];
          const matchesPg = pgList.some(c => c.toLowerCase().includes(selectedPgCourse.toLowerCase()) || c === 'All PG Programs');
          if (!matchesPg) return false;
        }

        // 4. Engineering Branch Filter (applied when s is B.Tech eligible or branch is selected)
        if (selectedBranch !== "all") {
          const branches = Array.isArray(s.engineeringBranches) ? s.engineeringBranches : [];
          if (!branches.includes(selectedBranch) && !branches.includes('All Engineering Branches')) return false;
        }

        // 5. Academic Year Filter
        if (selectedYear !== "all") {
          const years = Array.isArray(s.btechYears) ? s.btechYears : [];
          const matchesYear = years.some(y => y.includes(selectedYear) || y === 'All Years');
          if (!matchesYear) return false;
        }

        // 6. Geographic Scope Filter
        if (selectedScope === "all_india") {
          if (s.coverageScope !== 'All India') return false;
        } else if (selectedScope === "state_specific") {
          if (s.coverageScope !== 'State Specific') return false;
        }

        // 7. State Filter
        if (selectedState !== "all" && selectedState !== "All States / UTs") {
          if (s.coverageScope === 'State Specific' && s.state && s.state.toLowerCase() !== selectedState.toLowerCase()) {
            return false;
          }
        }

        // 8. Gender Filter
        if (selectedGender === "female") {
          if (s.gender !== 'Female' && (s.eligibility && s.eligibility.gender !== 'Female')) return false;
        }

        // 9. Search Query Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchTitle = (s.title || '').toLowerCase().includes(query);
          const matchProvider = (s.provider || '').toLowerCase().includes(query);
          const matchDesc = (s.description || '').toLowerCase().includes(query);
          const matchState = (s.state || '').toLowerCase().includes(query);
          const matchBranches = Array.isArray(s.engineeringBranches) && s.engineeringBranches.some(b => b.toLowerCase().includes(query));
          const matchPg = Array.isArray(s.pgCourses) && s.pgCourses.some(p => p.toLowerCase().includes(query));
          const matchSpecial = Array.isArray(s.specialCategories) && s.specialCategories.some(sp => sp.toLowerCase().includes(query));
          const matchTags = Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(query));

          if (!matchTitle && !matchProvider && !matchDesc && !matchState && !matchBranches && !matchPg && !matchSpecial && !matchTags) {
            return false;
          }
        }

        return true;
      }).sort((a, b) => {
        if (sortBy === 'deadline') {
          if (!a.deadlineDate && !b.deadlineDate) return 0;
          if (!a.deadlineDate) return 1;
          if (!b.deadlineDate) return -1;
          return new Date(a.deadlineDate) - new Date(b.deadlineDate);
        } else if (sortBy === 'latest') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        } else if (sortBy === 'government') {
          if (a.category === 'Government' && b.category !== 'Government') return -1;
          if (a.category !== 'Government' && b.category === 'Government') return 1;
          return 0;
        }
        return 0;
      });

      const getCategoryIcon = (cat) => {
        if (cat === 'Government') return "account_balance";
        if (cat === 'Defence' || cat === 'CAPF') return "shield";
        if (cat === 'Institute') return "school";
        return "volunteer_activism";
      };

      const getStatusColor = (st) => st === 'Approved' ? T.success : st === 'Rejected' ? T.rose : T.orange;

      const catColors = {
        'Government': { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
        'Defence': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
        'CAPF': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
        'Institute': { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
        'Private/NGO': { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA' },
        'Private': { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA' },
        'Corporate': { bg: '#FFF7ED', text: '#D97706', border: '#FED7AA' }
      };

      return (
        <div className="hub-container">
          <style>{`
            .hub-container { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); background: #fdfdfd; }
            .premium-hero {
              background: linear-gradient(145deg, #ffffff 0%, #f4f7fb 100%);
              border-bottom: 1px solid rgba(226, 232, 240, 0.9);
              padding: 40px 48px; position: relative; overflow: hidden;
            }
            .premium-hero::after {
              content: ''; position: absolute; right: -5%; top: -20%;
              width: 600px; height: 600px;
              background: radial-gradient(circle, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 60%);
              border-radius: 50%; pointer-events: none;
            }
            .premium-hero-inner {
              position: relative; z-index: 1; display: flex; justify-content: space-between;
              align-items: center; flex-wrap: wrap; gap: 24px; max-width: 1600px; margin: 0 auto;
            }
            .premium-badge {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.25);
              border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 700;
              display: inline-flex; align-items: center; gap: 6px;
            }
            .premium-btn-sync {
              background: white; color: #4f46e5; border: 1px solid #e2e8f0;
              box-shadow: 0 4px 12px rgba(0,0,0,0.03); border-radius: 12px; padding: 10px 18px;
              font-size: 13.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center;
              gap: 6px; transition: all 0.25s ease;
            }
            .premium-btn-sync:hover:not(:disabled) {
              transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); border-color: #cbd5e1;
            }
            .premium-tabs-container {
              display: flex; gap: 10px; margin-bottom: 28px; padding-bottom: 8px;
              overflow-x: auto; scrollbar-width: none;
            }
            .premium-tab {
              background: white; border: 1px solid #e2e8f0; color: #64748b;
              padding: 10px 20px; border-radius: 100px; font-size: 14px; font-weight: 600;
              cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center;
              gap: 8px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.02);
            }
            .premium-tab:hover { background: #f8fafc; color: #334155; transform: translateY(-1px); }
            .premium-tab.active {
              background: linear-gradient(135deg, #1e293b, #0f172a); color: white;
              border-color: #0f172a; box-shadow: 0 6px 16px rgba(15,23,42,0.2);
            }
            .premium-filter-bar {
              background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
              border: 1px solid rgba(255,255,255,0.6); box-shadow: 0 10px 40px rgba(0,0,0,0.05);
              border-radius: 20px; padding: 24px; margin-bottom: 32px; display: flex; flex-direction: column; gap: 16px;
            }
            .premium-input, .premium-select {
              padding: 12px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
              font-size: 13.5px; font-weight: 500; color: #334155; outline: none; transition: all 0.2s ease;
            }
            .premium-input:focus, .premium-select:focus {
              background: white; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15);
            }
            .premium-filter-btn {
              background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 100px;
              padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
            }
            .premium-filter-btn:hover { background: #f1f5f9; color: #334155; }
            .premium-filter-btn.active {
              background: #4f46e5; color: white; border-color: #4338ca; box-shadow: 0 4px 10px rgba(79,70,229,0.25);
            }
            .premium-card {
              background: white; border-radius: 20px; border: 1px solid #f1f5f9; padding: 28px;
              display: flex; flex-direction: column; transition: all 0.35s ease;
              box-shadow: 0 4px 20px rgba(0,0,0,0.03); position: relative; overflow: hidden;
            }
            .premium-card:hover {
              transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: #e2e8f0;
            }
            .premium-card::before {
              content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 5px;
              background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899); opacity: 0; transition: opacity 0.3s ease;
            }
            .premium-card:hover::before { opacity: 1; }
            .premium-pill {
              background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; border-radius: 8px;
              padding: 6px 10px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;
            }
            .premium-btn-outline {
              flex: 1; padding: 12px; border-radius: 12px; font-size: 13.5px; font-weight: 700; cursor: pointer;
              display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.25s ease;
              background: white; border: 1px solid #cbd5e1; color: #334155;
            }
            .premium-btn-outline:hover { background: #f8fafc; border-color: #94a3b8; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
            .premium-btn-primary {
              flex: 1.2; padding: 12px; border-radius: 12px; font-size: 13.5px; font-weight: 700; cursor: pointer; text-decoration: none;
              display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.25s ease;
              background: linear-gradient(135deg, #FF4F1F, #E04419); border: none; color: white;
              box-shadow: 0 4px 12px rgba(255, 79, 31, 0.25);
            }
            .premium-btn-primary:hover {
              transform: translateY(-2px); box-shadow: 0 8px 20px rgba(255, 79, 31, 0.35); background: linear-gradient(135deg, #E04419, #C23A13);
            }
            .premium-btn-disabled {
              flex: 1.2; padding: 12px; border-radius: 12px; font-size: 13.5px; font-weight: 700; cursor: not-allowed; text-decoration: none;
              display: flex; align-items: center; justify-content: center; gap: 8px;
              background: #9ca3af; border: none; color: white;
            }
          `}</style>
            {/* ── SCREEN HERO ── */}
            <div className="premium-hero">
              <div className="premium-hero-inner">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', margin: 0 }}>Higher Education Scholarships</h1>
                    <span className="premium-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span> B.Tech • PG • Defence • CAPF
                    </span>
                  </div>
                  <p style={{ color: '#475569', fontSize: 15, margin: 0, maxWidth: 800, lineHeight: 1.5 }}>
                    Verified scholarships for undergraduate engineering (B.Tech/B.E.), postgraduate programs (M.Tech/MCA/MSc/MBA), and Defence/CAPF personnel wards across India.
                  </p>
                </div>

                {/* 12-Hour Sync Telemetry Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '8px 16px', fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10B981' }}>autorenew</span>
                    <span>12-hr Sync: <b style={{ color: '#0f172a' }}>Active</b></span>
                    {pipelineStatus && pipelineStatus.lastRefresh && (
                      <span style={{ color: '#94a3b8' }}>• {new Date(pipelineStatus.lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  <button onClick={handleSyncExternal} disabled={isSyncing} className="premium-btn-sync">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>sync</span>
                    {isSyncing ? 'Refreshing...' : 'Sync Latest'}
                  </button>
                </div>
              </div>
            </div>

            <div className="screen-body" style={{ padding: "32px 48px 60px", maxWidth: 1600, margin: "0 auto" }}>
              {/* ── TOP-LEVEL TABS ── */}
              <div className="premium-tabs-container">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} className={`premium-tab ${activeTab === t.id ? 'active' : ''}`}>
                    {t.label}
                    {t.id === "dashboard" && myApplications.length > 0 && (
                      <span style={{ background: activeTab === t.id ? 'white' : '#FF4F1F', color: activeTab === t.id ? '#0f172a' : 'white', borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
                        {myApplications.length}
                      </span>
                    )}
                  </button>
                ))}

              </div>
            )}

              {/* ── SEARCH & SPECIFIC FILTERS ── */}
              {activeTab !== "troubleshooting" && activeTab !== "dashboard" && (
                <div className="premium-filter-bar">
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: '#94a3b8' }}>search</span>
                      <input
                        type="text"
                        placeholder="Search scholarships by name, degree, branch, provider, state..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="premium-input"
                        style={{ width: '100%', paddingLeft: 44, paddingRight: 36 }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      )}
                    </div>

                    <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)} className="premium-select">
                      {LEVEL_OPTIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>

                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="premium-select">
                      {BTECH_YEARS.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                    </select>

                    <select value={selectedScope} onChange={e => { setSelectedScope(e.target.value); if (e.target.value === 'all_india') setSelectedState('all'); }} className="premium-select">
                      <option value="all">🌐 All India & States</option>
                      <option value="all_india">🇮🇳 All India Schemes Only</option>
                      <option value="state_specific">📍 State Specific Schemes</option>
                    </select>

                    <select value={selectedState} onChange={e => { setSelectedState(e.target.value); if (e.target.value !== 'all' && e.target.value !== 'All States / UTs') setSelectedScope('all'); }} className="premium-select">
                      {STATE_OPTIONS.map(st => <option key={st} value={st === 'All States / UTs' ? 'all' : st}>{st}</option>)}
                    </select>

                    <button onClick={() => setSelectedGender(prev => prev === 'female' ? 'all' : 'female')} 
                      className="premium-select" style={{ background: selectedGender === 'female' ? '#FDF2F8' : '#f8fafc', color: selectedGender === 'female' ? '#BE185D' : '#334155', borderColor: selectedGender === 'female' ? '#FBCFE8' : '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>female</span> Girls Only
                    </button>

                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="premium-select" style={{ marginLeft: 'auto' }}>
                      <option value="deadline">⏳ Deadline (Earliest)</option>
                      <option value="latest">✨ Recently Added</option>
                      <option value="government">🏛️ Government First</option>
                    </select>
                  </div>

                  {(activeTab === 'pg' || selectedLevel === 'pg') ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 8 }}>PG Course:</span>
                      {PG_COURSES.map(pg => (
                        <button key={pg.id} onClick={() => setSelectedPgCourse(pg.id)} className={`premium-filter-btn ${selectedPgCourse === pg.id ? 'active' : ''}`}>
                          {pg.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 8 }}>Branch:</span>
                      {BRANCH_FILTERS.map(b => (
                        <button key={b.id} onClick={() => setSelectedBranch(b.id)} className={`premium-filter-btn ${selectedBranch === b.id ? 'active' : ''}`}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {(selectedBranch !== 'all' || selectedPgCourse !== 'all' || selectedLevel !== 'all' || selectedYear !== 'all' || selectedScope !== 'all' || selectedState !== 'all' || selectedGender !== 'all' || searchQuery) && (
                    <div>
                      <button onClick={() => { setSelectedLevel('all'); setSelectedBranch('all'); setSelectedPgCourse('all'); setSelectedYear('all'); setSelectedScope('all'); setSelectedState('all'); setSelectedGender('all'); setSearchQuery(''); }}
                        style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                        Reset All Filters
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── CONTENT AREA ── */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, animation: "spin 1s linear infinite", color: '#4f46e5' }}>sync</span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginTop: 16 }}>Loading premium scholarships...</div>
                </div>
              ) : activeTab === "troubleshooting" ? (
                <div style={{ maxWidth: 800, margin: "0 auto" }}>
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, marginBottom: 24, boxShadow: "0 4px 12px rgba(245,158,11,0.05)" }}>
                    <span style={{ fontSize: 24 }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}>Common Scholarship & Portal Issues</div>
                      <div style={{ fontSize: 13.5, color: '#78350F', marginTop: 4 }}>Step-by-step resolution guides for DBT bank linking, university enrollment mismatch, AICTE nodal verification, and fee reimbursement.</div>
                    </div>
                  </div>

                  <div style={{ background: "linear-gradient(135deg, #0f172a, #312e81)", borderRadius: 16, padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 32, flexWrap: "wrap", boxShadow: "0 10px 25px rgba(15,23,42,0.15)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.2)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>smart_toy</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#fff", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Ask Vidya AI Higher Education Advisor</div>
                        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Instant guidance on DBT mapping, AICTE GATE stipend, NSP OTR, Defence PMSS, and fee waivers.</div>
                      </div>
                    </div>
                    <button onClick={() => setShowAI(true)} style={{ background: "white", color: "#312e81", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", transition: "all 0.2s ease", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat_bubble</span> Chat Now
                    </button>
                  </div>

                  <div className="grid-2" style={{ gap: 20 }}>
                    {[...TROUBLESHOOTING_GUIDES, ...customProblems].map(guide => (
                      <div key={guide.id || guide._id} className="premium-card">
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                          <div className="premium-icon-box" style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', color: '#e11d48' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{guide.icon}</span>
                          </div>
                          <div>
                            <div className="premium-card-title">{guide.title}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, flex: 1, marginBottom: 20 }}>{guide.desc}</div>
                        <button onClick={() => setActiveGuide(guide)} className="premium-btn-outline" style={{ borderStyle: 'dashed', borderColor: '#e11d48', color: '#e11d48' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_book</span> View Guide
                        </button>
                      </div>
                    ))}
                    <div className="premium-card" style={{ borderStyle: 'dashed', borderColor: '#cbd5e1', alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer" }} onClick={() => setShowReportForm(true)}>
                      <div className="premium-icon-box" style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#4f46e5', marginBottom: 16 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>add</span>
                      </div>
                      <div className="premium-card-title">Facing a Different Portal Issue?</div>
                      <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Report your unique problem and our team will add verified steps.</div>
                    </div>
                  </div>
                </div>
              ) : activeTab === "dashboard" ? (
                <div>
                  {myApplications.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 24px", color: '#64748b', background: 'white', borderRadius: 20, border: '1px dashed #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <div style={{ marginBottom: 20 }}><span className="material-symbols-outlined" style={{ fontSize: 56, color: '#cbd5e1' }}>inbox</span></div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>No Applications Found</div>
                      <div style={{ fontSize: 14, marginTop: 8 }}>Apply for scholarships to track them here.</div>
                    </div>
                  ) : (
                    <div className="grid-2" style={{ gap: 20 }}>
                      {myApplications.map(app => (
                        <div key={app._id} className="premium-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF4F1F', textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{app.categoryApplied} Scholarship</div>
                              <div className="premium-card-title">{app.scholarshipId?.title || "Unknown Scholarship"}</div>
                            </div>
                            <span className="premium-badge" style={{ background: getStatusColor(app.status) + '15', color: getStatusColor(app.status), boxShadow: 'none' }}>{app.status}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}><span style={{ color: '#64748b' }}>Date Applied</span><span style={{ fontWeight: 600, color: '#0f172a' }}>{new Date(app.submittedAt).toLocaleDateString()}</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span style={{ color: '#64748b' }}>Reference ID</span><span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#4f46e5', fontWeight: 600 }}>#{app._id.slice(-6).toUpperCase()}</span></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                      Showing <b style={{ color: '#0f172a', fontWeight: 700 }}>{visibleScholarships.length}</b> verified higher education scholarships
                    </div>
                  </div>

                  {visibleScholarships.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 24px", color: '#64748b', background: 'white', borderRadius: 20, border: '1px dashed #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 56, color: '#cbd5e1', marginBottom: 20 }}>search_off</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>No Scholarships Match Your Current Filters</div>
                      <div style={{ fontSize: 14, marginTop: 8, maxWidth: 500, margin: '8px auto 24px', lineHeight: 1.5 }}>
                        Try selecting "All Education Levels" or resetting your state and course filters to explore more opportunities.
                      </div>
                      <button onClick={() => { setSelectedLevel('all'); setSelectedBranch('all'); setSelectedPgCourse('all'); setSelectedYear('all'); setSelectedScope('all'); setSelectedState('all'); setSelectedGender('all'); setSearchQuery(''); }}
                        className="btn-primary" style={{ padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid-2" style={{ gap: 24 }}>
                      {visibleScholarships.map(s => {
                        const badgeStyle = catColors[s.category] || { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
                        const statusInfo = s.status === 'closed'
                          ? { bg: '#fef2f2', text: '#e11d48', border: '#fecdd3', label: 'Closed', icon: 'cancel' }
                          : s.status === 'closing_soon'
                            ? { bg: '#fffbeb', text: '#d97706', border: '#fde68a', label: 'Closing Soon', icon: 'hourglass_top' }
                            : s.status === 'upcoming'
                              ? { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', label: 'Upcoming', icon: 'event' }
                              : { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', label: 'Open', icon: 'check_circle' };
                        const isStateSpecific = s.coverageScope === 'State Specific' && s.state && s.state !== 'All India';

                        return (
                          <div key={s._id || s.deduplicationKey} className="premium-card">
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                              <div className="premium-icon-box">
                                <span className="material-symbols-outlined" style={{ fontSize: 26 }}>{getCategoryIcon(s.category)}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="premium-card-title">{s.title}</div>
                                <div style={{ color: '#64748b', fontSize: 13.5, marginTop: 4, fontWeight: 500 }}>{s.provider}</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                                <span style={{ background: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  {s.category}
                                </span>
                                <span style={{ background: statusInfo.bg, color: statusInfo.text, border: `1px solid ${statusInfo.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{statusInfo.icon}</span> {statusInfo.label}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                              {isStateSpecific ? (
                                <span className="premium-pill" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#ffedd5' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>location_on</span> {s.state}
                                </span>
                              ) : (
                                <span className="premium-pill" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe' }}>
                                  🇮🇳 All India
                                </span>
                              )}
                              {s.isBTechEligible && (
                                <span className="premium-pill" style={{ background: '#eef2ff', color: '#4338ca', borderColor: '#e0e7ff' }}>
                                  ⚙️ B.Tech / B.E.
                                </span>
                              )}
                              {s.isPGEligible && (
                                <span className="premium-pill" style={{ background: '#faf5ff', color: '#7e22ce', borderColor: '#f3e8ff' }}>
                                  🎓 Postgraduate {(s.pgCourses && s.pgCourses[0] && s.pgCourses[0] !== 'All PG Programs') ? `(${s.pgCourses[0]})` : ''}
                                </span>
                              )}
                              {s.isDefenceEligible && (
                                <span className="premium-pill" style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}>
                                  🛡️ Defence Ward
                                </span>
                              )}
                              {s.isCapfEligible && (
                                <span className="premium-pill" style={{ background: '#ecfeff', color: '#0e7490', borderColor: '#cffafe' }}>
                                  👮 CAPF Ward
                                </span>
                              )}
                              {s.gender === 'Female' && (
                                <span className="premium-pill" style={{ background: '#fdf2f8', color: '#be185d', borderColor: '#fce7f3' }}>
                                  👩 Girls Only
                                </span>
                              )}
                            </div>

                            {s.description && (
                              <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: "0 0 20px", flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {s.description}
                              </p>
                            )}

                            <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: 12, alignItems: 'center' }}>
                              {s.startDate && (
                                <span style={{ fontSize: 13, color: '#475569', display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>event_available</span> Opens: <b style={{ color: '#0f172a' }}>{new Date(s.startDate).toLocaleDateString()}</b>
                                </span>
                              )}
                              <span style={{ fontSize: 13, color: '#475569', display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.status === 'closing_soon' ? '#d97706' : '#64748b' }}>schedule</span> Deadline: <b style={{ color: s.status === 'closing_soon' ? '#d97706' : '#0f172a' }}>{s.deadlineText || s.deadline || 'Not announced'}</b>
                              </span>
                              <span style={{ fontSize: 13, color: '#475569', display: "flex", alignItems: "center", gap: 6, marginLeft: 'auto', fontWeight: 500 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>payments</span> <b style={{ color: '#059669', fontSize: 14 }}>{s.amount}</b>
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                              <button onClick={() => setHowToApplyScholarship(s)} className="premium-btn-outline">
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>checklist</span> Guide & Eligibility
                              </button>
                              <a href={s.officialUrl || "https://scholarships.gov.in"} target="_blank" rel="noopener noreferrer"
                                className={s.status === 'closed' ? "premium-btn-disabled" : "premium-btn-primary"}>
                                {s.status === 'closed' ? 'Portal Closed' : <>Official Portal <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span></>}
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* HOW TO APPLY & ELIGIBILITY SCHOLARSHIP MODAL */}
          <Modal open={!!howToApplyScholarship} onClose={() => setHowToApplyScholarship(null)} title={howToApplyScholarship ? "📋 Eligibility & Guide: " + howToApplyScholarship.title : ""} aboveNav={true}>
            {howToApplyScholarship && (
              <>
                {/* Scholarship info summary */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 12, background: "linear-gradient(135deg,rgba(79,70,229,0.06),rgba(99,102,241,0.04))", border: "1px solid rgba(79,70,229,0.18)", marginBottom: 18 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: T.indigo + "18", border: `1px solid ${T.indigo}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: T.indigo }}>{getCategoryIcon(howToApplyScholarship.category)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: T.text }}>{howToApplyScholarship.provider}</div>
                    <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>
                      {howToApplyScholarship.coverageScope === 'State Specific' ? `📍 State: ${howToApplyScholarship.state}` : '🇮🇳 Scope: All India'} • Deadline: <b>{howToApplyScholarship.deadlineText || howToApplyScholarship.deadline}</b>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: 13.5 }}>{howToApplyScholarship.amount}</div>
                    <span style={{ display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: howToApplyScholarship.status === 'closed' ? '#FEE2E2' : '#ECFDF5', color: howToApplyScholarship.status === 'closed' ? '#DC2626' : '#059669' }}>
                      {howToApplyScholarship.status === 'closed' ? 'Closed' : howToApplyScholarship.status === 'closing_soon' ? 'Closing Soon' : howToApplyScholarship.status === 'upcoming' ? 'Upcoming' : 'Open'}
                    </span>
                  </div>
                </div>

                {/* Eligibility Criteria Highlights */}
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#4F46E5' }}>verified</span>
                    Eligibility Highlights
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: '#6B7280' }}>Degree / Level:</span> <b style={{ color: '#111827' }}>{(howToApplyScholarship.courses || []).join(', ') || (howToApplyScholarship.educationLevels || []).join(', ')}</b></div>
                    {howToApplyScholarship.isBTechEligible && <div><span style={{ color: '#6B7280' }}>Engineering Branches:</span> <b style={{ color: '#111827' }}>{(howToApplyScholarship.engineeringBranches || ['All Branches']).slice(0, 3).join(', ')}</b></div>}
                    {howToApplyScholarship.isPGEligible && <div><span style={{ color: '#6B7280' }}>PG Programs:</span> <b style={{ color: '#111827' }}>{(howToApplyScholarship.pgCourses || ['All PG Programs']).join(', ')}</b></div>}
                    {howToApplyScholarship.isDefenceEligible && <div><span style={{ color: '#6B7280' }}>Defence Category:</span> <b style={{ color: '#991B1B' }}>Ex-Servicemen / Army Personnel Wards</b></div>}
                    {howToApplyScholarship.isCapfEligible && <div><span style={{ color: '#6B7280' }}>CAPF Category:</span> <b style={{ color: '#0E7490' }}>CRPF, BSF, CISF, ITBP, SSB, AR</b></div>}
                    <div><span style={{ color: '#6B7280' }}>Max Annual Income:</span> <b style={{ color: '#111827' }}>{howToApplyScholarship.eligibility?.maxIncome && howToApplyScholarship.eligibility.maxIncome < 90000000 ? `₹${howToApplyScholarship.eligibility.maxIncome.toLocaleString('en-IN')}` : 'No Strict Income Cap'}</b></div>
                    <div><span style={{ color: '#6B7280' }}>Gender:</span> <b style={{ color: '#111827' }}>{howToApplyScholarship.gender || 'All Eligible'}</b></div>
                  </div>
                </div>

                {/* Step-by-step instructions from verified source */}
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: T.indigo }}>checklist</span>
                  Step-by-Step Application Guide
                </div>
                {(howToApplyScholarship.howToApply || []).length > 0 ? (
                  howToApplyScholarship.howToApply.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: T.indigo + "12", border: `1px solid ${T.indigo}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: T.indigo }}>{i + 1}</div>
                      <div style={{ color: T.text, fontSize: 12.5, paddingTop: 3, lineHeight: 1.45 }}>{step}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: T.muted, fontSize: 12.5, padding: "8px 0" }}>Visit the official portal for detailed application steps.</div>
                )}

                {/* Required documents */}
                {(howToApplyScholarship.documentsRequired || []).length > 0 && (
                  <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: T.indigo, marginBottom: 6 }}>📄 Mandatory Documents Required</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {howToApplyScholarship.documentsRequired.map(doc => (
                        <span key={doc} style={{ background: T.indigo + "14", color: T.indigo, border: `1px solid ${T.indigo}28`, borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{doc}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Official URL & Safety Notice */}
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: T.warn, marginBottom: 4 }}>🌐 Official Government / Awarding Portal</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                    Authentic Website: <b style={{ color: T.indigo }}>{howToApplyScholarship.officialUrl}</b><br />
                    • Always verify HTTPS before uploading Aadhaar or B.Tech fee receipts.<br />
                    • Ensure your bank account is active on the NPCI Aadhaar DBT mapper.
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button onClick={() => setHowToApplyScholarship(null)}
                    style={{ flex: 1, background: T.gray, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Close
                  </button>
                  <a href={howToApplyScholarship.officialUrl || "https://scholarships.gov.in"} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 2, background: `linear-gradient(135deg,${T.indigo},#6366F1)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                    Apply on Official Portal ↗
                  </a>
                </div>
              </>
            )}
          </Modal>

          {/* APPLICATION SIMULATION MODAL */}
          {applyingFor && (
            <Modal title="Attach Verification Documents" onClose={() => { setApplyingFor(null); setUploadedDoc({}); }}>
              <div style={{ padding: 14, background: "#FFFBF0", border: "1px solid #FDE68A", borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#D97706", fontSize: 13 }}>⚠️ Important Government Regulation</div>
                <div style={{ color: "#92400E", fontSize: 12, marginTop: 3 }}>Students may hold only one active government scholarship concurrently. Dual claims from Central and State portals result in automatic cancellation.</div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Required Certificates</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {applyingFor.documentsRequired.map(doc => (
                  <div key={doc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${T.border}`, padding: "10px 14px", borderRadius: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{doc}</div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="file"
                        id={`hub-upload-${doc}`}
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(doc, e.target.files[0])}
                      />
                      <label
                        htmlFor={`hub-upload-${doc}`}
                        style={{
                          background: uploadedDoc[doc] ? T.success + "15" : T.teal + "15",
                          color: uploadedDoc[doc] ? T.success : T.teal,
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: uploadedDoc[doc] ? "default" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {uploadedDoc[doc] ? <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span> Attached</> : <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span> Attach</>}
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={handleApply} style={{ background: `linear-gradient(135deg,${T.success},#10B981)`, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 800, cursor: "pointer", width: "100%", transition: "all .2s ease" }}>
                Submit Application Profile
              </button>
            </Modal>
          )}

          {/* VIDYA AI ASSISTANT MODAL */}
          {showAI && createPortal(
            <div style={{ position: "fixed", bottom: 85, right: 24, width: 380, maxWidth: "calc(100vw - 48px)", background: "#fff", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.18)", zIndex: 99999, overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${T.border}` }}>
              <div style={{ padding: 14, background: '#4338CA', color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🤖</span> Vidya AI Scholarship Advisor
                </div>
                <button onClick={() => setShowAI(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.8, fontSize: 16, display: "flex" }}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", height: "380px", background: "#fff" }}>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "12px" }}>
                  {aiMessages.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: 14, borderBottomRightRadius: m.sender === "user" ? 2 : 14, borderBottomLeftRadius: m.sender === "ai" ? 2 : 14, background: m.sender === "user" ? '#4338CA' : "#F3F4F6", color: m.sender === "user" ? "#fff" : T.text, fontSize: 12.5, lineHeight: 1.45 }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 2, background: "#F3F4F6", color: T.muted, fontSize: 12.5 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, animation: "spin 1s linear infinite", verticalAlign: "middle" }}>sync</span> Consulting engineering portal guidelines...
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, padding: "10px", borderTop: `1px solid ${T.border}` }}>
                  <input
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAiSubmit()}
                    placeholder="Ask about AICTE, DBT, B.Tech fee waivers..."
                    style={{ flex: 1, padding: "10px 14px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 20, fontSize: 12.5, outline: "none" }}
                  />
                  <button onClick={handleAiSubmit} style={{ width: 38, height: 38, borderRadius: "50%", background: '#4338CA', color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* REPORT PROBLEM MODAL */}
          <Modal open={showReportForm} onClose={() => setShowReportForm(false)} title="Report Scholarship Portal Issue" aboveNav={true}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 4, display: "block" }}>Issue Summary</label>
                <input type="text" value={newProblem.title} onChange={e => setNewProblem({ ...newProblem, title: e.target.value })} placeholder="e.g. AICTE Pragati portal OTR verification issue" style={{ width: "100%", padding: "10px 12px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 4, display: "block" }}>Details & Error Message</label>
                <textarea value={newProblem.desc} onChange={e => setNewProblem({ ...newProblem, desc: e.target.value })} placeholder="Describe what happened and which engineering portal you were using..." rows="3" style={{ width: "100%", padding: "10px 12px", background: "#F9FAFB", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, resize: "vertical" }} />
              </div>
              <button onClick={async () => {
                if (!newProblem.title) return addToast("Error", "Please enter an issue title", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>, T.rose);
                try {
                  const res = await fetch(`${API_BASE_URL}/api/scholarships/issues`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newProblem.title, desc: newProblem.desc })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setCustomProblems([data.issue, ...customProblems]);
                    setShowReportForm(false);
                    setNewProblem({ title: "", desc: "" });
                    addToast("Issue Logged", "Our team will evaluate and publish a guide.", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>, T.success);
                  }
                } catch (e) {
                  addToast("Error", "Failed to report problem", <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>, T.rose);
                }
              }} style={{ background: `linear-gradient(135deg,${T.indigo},#6366F1)`, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 800, cursor: "pointer", marginTop: 6 }}>
                Submit Report
              </button>
            </div>
          </Modal>

          {/* ACTIVE GUIDE MODAL */}
          <Modal open={!!activeGuide} onClose={() => setActiveGuide(null)} title={activeGuide ? `🛠️ ${activeGuide.title}` : ""} aboveNav={true}>
            {activeGuide && (
              <>
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: T.rose }}>{activeGuide.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: T.text }}>{activeGuide.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{activeGuide.desc}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: T.indigo }}>checklist</span>
                  Step-by-Step Resolution
                </div>
                {activeGuide.steps.map(([s, t, d]) => (
                  <div key={s} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: T.indigo + "12", border: `1px solid ${T.indigo}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: T.indigo }}>{s}</div>
                    <div style={{ color: T.text, fontSize: 12.5, paddingTop: 3, lineHeight: 1.4 }}>
                      <strong>{t}</strong><br /><span style={{ color: T.muted }}>{d}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setActiveGuide(null)}
                    style={{ flex: 1, background: T.gray, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Close Guide
                  </button>
                  <button onClick={() => setActiveGuide(null)}
                    style={{ flex: 2, background: `linear-gradient(135deg,${T.success},#10B981)`, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                    Got It, Thank You
                  </button>
                </div>
              </>
            )}
          </Modal>

          {/* SYNC LOADER OVERLAY */}
          {isSyncing && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.indigo + "15", color: T.indigo, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 30, animation: "spin 1s linear infinite" }}>sync</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.text, marginBottom: 6 }}>Syncing Verified B.Tech Engineering Portals...</div>
              <div style={{ color: T.muted, fontSize: 13 }}>
                {syncStep === 0 && "Connecting to National Scholarship Portal (NSP)..."}
                {syncStep === 1 && "Verifying AICTE, State Engineering Portals, and Corporate CSR Foundations..."}
                {syncStep === 2 && "Validating B.Tech branch eligibility and official application URLs..."}
              </div>
              <div style={{ width: 220, height: 4, background: T.border, borderRadius: 2, marginTop: 20, overflow: "hidden" }}>
                <div style={{ width: syncStep === 0 ? "30%" : syncStep === 1 ? "65%" : "95%", height: "100%", background: T.indigo, transition: "width 0.8s ease" }}></div>
              </div>
            </div>
          )}
        </div>
      );
    }
