# 🎓 Vidya Setu

> **Empowering Students with Opportunities, Insights, and AI-Driven Career Growth.**

Vidya Setu is a comprehensive, full-stack platform designed to bridge the gap between university students and their professional futures. Built with a robust MERN stack and powered by cutting-edge AI integrations, it provides students with intelligent resume analysis, curated job and internship listings, and streamlined scholarship tracking.

---

## ✨ Key Features

- **🤖 AI-Powered Resume Analyzer:** Upload your resume and receive instant, actionable feedback and ATS optimization suggestions powered by the Groq LLM API.
- **💼 Job & Internship Portal:** A curated, easily searchable database of early-career opportunities, hackathons, and internships.
- **🎓 Scholarship Tracking:** Stay on top of financial aid with a centralized dashboard for tracking, applying, and monitoring active scholarships.
- **🔐 Secure Authentication:** Production-grade JWT authentication with strict route protection and role-based access control (RBAC).
- **📊 Real-Time Analytics & Admin Dashboard:** Comprehensive insights into platform usage, application statuses, and active opportunities.

## 🛠️ Tech Stack

**Frontend:**
- [React.js](https://reactjs.org/) - Component-driven UI.
- Context API - State management.
- HTML5 / CSS3 - Modern, responsive styling.

**Backend:**
- [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) - RESTful API architecture.
- [MongoDB](https://www.mongodb.com/) & Mongoose - NoSQL database and schema management.
- [Groq LLM API](https://groq.com/) - High-speed AI inference for resume analysis.
- [JSON Web Tokens (JWT)](https://jwt.io/) & [Bcrypt.js](https://www.npmjs.com/package/bcryptjs) - Authentication and password hashing.

---

## 📂 Folder Structure Overview

The project is structured into two main directories, keeping the client and server codebases cleanly separated:

```text
Vidya Setu/
├── Backend/                 # Express.js REST API
│   ├── config/              # Database and environment configurations
│   ├── controllers/         # Request handling and business logic
│   ├── middleware/          # JWT auth, error handling, and rate limiting
│   ├── models/              # Mongoose schemas (User, Job, Scholarship, etc.)
│   ├── routes/              # API route definitions (userRoutes, jobRoutes, etc.)
│   ├── scripts/             # Database seeding and migration scripts
│   └── server.js            # Node.js entry point
│
└── Frontend/                # React.js Client
    ├── src/
    │   ├── components/      # Reusable UI components (Navbar, Cards, Modals)
    │   ├── context/         # React Context for global state (AuthContext)
    │   ├── pages/           # Main route views (Dashboard, Jobs, ResumeAnalyzer)
    │   ├── services/        # API client modules
    │   └── App.js           # Main React component and router
    └── public/              # Static assets (images, icons)
```

---

## 🚀 Local Setup & Installation

Follow these steps to get a local copy up and running.

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas URI)

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/vidya-setu.git
cd vidya-setu
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
```

### 4. Frontend Setup
Open a new terminal window, navigate to the frontend directory, and install dependencies:
```bash
cd Frontend
npm install
```

Create a `.env` file in the `Frontend` directory (if required by your setup) to point to the backend URL:
```env
REACT_APP_API_URL=http://localhost:5000/api
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
npm start
```
*(The React app will open in your browser at `http://localhost:3000`)*

---

## 🛡️ Security & Best Practices
- **NoSQL Injection Prevention:** All inputs and ObjectIds are strictly validated before database queries.
- **Data Privacy:** Passwords are never sent to the client, and sensitive tokens are securely managed.
- **Robust Error Handling:** The backend catches all unhandled rejections and prevents stack trace leaks in production environments.

---

*Designed & Developed for the students of tomorrow.*
