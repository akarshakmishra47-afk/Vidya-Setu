# 🎓 Vidya Setu

> **Empowering Students with Opportunities, Insights, and AI-Driven Career Growth.**

Vidya Setu is a comprehensive, full-stack platform designed to bridge the gap between university students and their professional futures. Built with a robust MERN stack and powered by cutting-edge AI integrations, it provides students with intelligent resume analysis, curated job and internship listings, and a highly advanced automated scholarship tracking system.

---

## ✨ Key Features

- **🎓 Advanced Scholarship Hub:** A centralized dashboard for finding verified financial aid.
  - **Automated Live Scraper:** Built-in web scraper that dynamically pulls the latest Private, Trending, and Recently Added scholarships directly from `indiascholarships.in`.
  - **Dynamic Filtering:** Real-time client-side filters for Education Level, State Domicile, Gender, and Social Category with smooth-scroll pagination.
  - **DBT & Portal Troubleshooting:** A dedicated help center providing step-by-step resolution guides for DBT bank linking, AICTE verification, and university enrollment mismatches.
- **🤖 AI-Powered Resume Analyzer:** Upload your resume and receive instant, actionable feedback and ATS optimization suggestions powered by the Groq LLM API.
- **💼 Job & Internship Portal:** A curated, easily searchable database of early-career opportunities, hackathons, and internships.
- **🛒 Community & Marketplace:** Built-in community interactions and a marketplace designed specifically for students.
- **⚡ Real-Time Study Lounges:** Low-latency Socket.io collaborative study rooms with live student presence indicators and topic-based group chat.
- **📚 Academic Vault & GATE Preparation:** Categorized repository of university PYQs and competitive GATE question papers with an interactive mock test simulator.
- **🔐 Secure Authentication:** Production-grade JWT authentication with strict route protection and role-based access control (RBAC).
- **📊 Real-Time Analytics & Admin Dashboard:** Comprehensive insights into platform usage, application statuses, and active opportunities.

## 🛠️ Tech Stack

**Frontend (Client):**
- [React.js](https://reactjs.org/) - UI Library.
- [Vite](https://vitejs.dev/) - Next-generation frontend tooling.
- Custom CSS & Modern UI - Responsive, premium "human-designed" interface with optimized typography and layouts.

**Backend (API & Services):**
- [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) - RESTful API architecture.
- [MongoDB](https://www.mongodb.com/) & Mongoose - NoSQL database and schema management.
- [Cheerio](https://cheerio.js.org/) & [Axios](https://axios-http.com/) - HTML parsing and HTTP requests for the automated scholarship scraper.
- [Groq LLM API](https://groq.com/) - High-speed AI inference for resume analysis.
- [JSON Web Tokens (JWT)](https://jwt.io/) & [Bcrypt.js](https://www.npmjs.com/package/bcryptjs) - Authentication and password hashing.
- [Cloudinary](https://cloudinary.com/) - Cloud image and asset storage.
- PDF-Parse & PDFKit - For handling and analyzing resume PDFs.

---

## 📂 Folder Structure Overview

The project is structured into two main directories, keeping the client and server codebases cleanly separated:

```text
Vidya Setu/
├── Backend/                 # Express.js REST API
│   ├── middleware/          # JWT auth, error handling, and rate limiting
│   ├── models/              # Mongoose schemas (User, Job, Scholarship, etc.)
│   ├── routes/              # API routes (scholarshipRoutes.js, userRoutes.js)
│   ├── services/            # Background services (scholarshipFetcher.js scraper)
│   ├── cloudinaryConfig.js  # Cloudinary configuration
│   └── server.js            # Node.js entry point
│
└── Frontend/                # React.js Client (Vite)
    ├── public/              # Static assets (images, icons)
    ├── src/
    │   └── main.jsx         # Core React application (Contains unified UI & Logic)
    ├── index.html           # Main HTML template
    └── vite.config.js       # Vite configuration
```

---

## 🚀 Local Setup & Installation

Follow these steps to get a local copy up and running.

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas URI)

### 2. Clone the Repository
```bash
git clone https://github.com/akarshakmishra47-afk/Vidya-Setu.git
cd Vidya-Setu
```

### 3. Backend Setup
Navigate to the backend directory, install dependencies, and configure the environment:
```bash
cd Backend
npm install
```

Create a `.env` file in the `Backend` directory and add the following variables:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
GROQ_API_KEY=your_groq_llm_api_key

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

### 4. Frontend Setup
Open a new terminal window, navigate to the frontend directory, and install dependencies:
```bash
cd Frontend
npm install
```

### 5. Running the Application

**Start the Backend Server:**
```bash
cd Backend
npm run dev
```
*(The API will be available at `http://localhost:5000`)*

**Start the Frontend Development Server:**
```bash
cd Frontend
npm run dev
```
*(The React app will start with Vite at `http://localhost:5173`)*

---

## 📖 Usage Instructions

1. **🎓 Scholarship Discovery & Eligibility Filtering:**
   - Navigate to the **Scholarship Hub** from the navigation bar.
   - Filter listings dynamically by Education Level (Undergraduate, Diploma, PG), State Domicile, Gender, and Social Category.
   - Click any card to inspect full eligibility requirements, award amounts, deadlines, and direct application links.
   - Access the **DBT Help Desk** tab for step-by-step resolution guides on Aadhaar bank seeding and portal errors.

2. **🤖 AI-Powered Resume & ATS Audit:**
   - Head over to **Career Compass / Resume Analyzer**.
   - Upload your resume (PDF/DOCX format) and click **Analyze Resume**.
   - Review your comprehensive ATS score (0–100%), skill breakdown (Impact, Brevity, Action Verbs), detected missing industry keywords, and AI-tailored bullet-point recommendations powered by Groq LLM.

3. **📚 Academic Vault & GATE Preparation:**
   - Open **Academic Vault** or **GATE Insights**.
   - Filter previous years' question papers (PYQs) by engineering branch, semester, and target subject code.
   - Launch the interactive **Timed Mock Examination Simulator** to practice questions under real exam conditions with immediate automated grading.

4. **⚡ Real-Time Study Lounges & Community Discussions:**
   - Check the live online student counter and join subject-specific **Study Lounges**.
   - Collaborate via real-time WebSocket group chat and shared study attachments.
   - Participate in the **Community Hub** to post queries, share insights, and interact with peers and student mentors.

5. **🛍️ Campus Store (P2P Marketplace) & Student Perks:**
   - Visit the **Campus Store** to buy or sell used textbooks, calculators, and hostel essentials directly with verified campus peers.
   - Browse the **Student Perks** tab to claim verified software discounts, student developer packs, and free educational licenses.

---

## 🛡️ Security & Best Practices
- **NoSQL Injection Prevention:** All inputs and ObjectIds are strictly validated before database queries.
- **Data Privacy:** Passwords are never sent to the client, and sensitive tokens are securely managed.
- **Robust Error Handling:** The backend catches all unhandled rejections and prevents stack trace leaks in production environments.

---

*Designed & Developed for the students of tomorrow.*
