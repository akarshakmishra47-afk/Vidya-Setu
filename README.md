# 🎓 Vidya Setu - Student Web Portal

Vidya Setu is a comprehensive, all-in-one web portal designed to empower college students. It bridges the gap between campus life and professional growth by providing a centralized platform for managing student profiles, discovering real-time job opportunities, analyzing resumes using AI, and buying/selling on a campus marketplace.

---

## 🚀 Key Features

*   **👤 Student Profiles & Portfolios**
    *   Secure student registration and authentication (Bcrypt hashed passwords).
    *   Dynamic user profiles with educational details, family income, and social links (LinkedIn, GitHub).
    *   Profile edit request system (admin approval workflow for locked profiles).
*   **🤖 AI Resume Intelligence**
    *   PDF resume parsing and text extraction.
    *   AI-powered (Groq) resume analysis for gap identification, skill mapping, and personalized career roadmaps.
*   **💼 Live Jobs, Internships & Hackathons Hub**
    *   Automated fetching from external sources (Remotive, Himalayas, HackerEarth, etc.) running every 24 hours.
    *   Categorized listings (Jobs, Internships, Hackathons) with advanced filtering (Domain, Location, Work Mode).
*   **🛒 Campus Store (Marketplace)**
    *   A peer-to-peer marketplace where students can buy, sell, or exchange study materials, electronics, and other campus essentials.
    *   Direct seller contact integration.
*   **📚 Scholarship Hub & Exam Analytics**
    *   Centralized repository for discovering relevant scholarships.
    *   Dashboard for tracking exam performance and analytics.

---

## 🛠️ Technology Stack

**Frontend:**
*   HTML5 / CSS3 / JavaScript (Vanilla + React/Vite ecosystem elements)
*   Responsive, modern UI with glassmorphism and gradient aesthetics

**Backend:**
*   Node.js & Express.js
*   **Database:** MongoDB & Mongoose
*   **Authentication:** Custom Auth / JWT / Bcrypt
*   **AI Integration:** Groq SDK for Resume Analysis
*   **File Handling:** Multer & PDF-Parse

---

## ⚙️ Installation & Setup

### Prerequisites
*   Node.js (v16+ recommended)
*   MongoDB Cluster (Atlas or Local)
*   Groq API Key

### 1. Clone the Repository
```bash
git clone https://github.com/akarshakmishra47-afk/Vidya-Setu.git
cd Vidya-Setu
```

### 2. Backend Setup
```bash
cd Backend
npm install
```
Create a `.env` file in the `Backend` directory and add the following:
```env
PORT=5000
FRONTEND_URL=http://localhost:5500
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_secret_here
```
Start the backend server:
```bash
npm start
```
*The server will start on port 5000 and the auto-refresh jobs engine will initialize.*

### 3. Frontend Setup
```bash
cd Frontend
npm install
```
If using Vite or a dev server, start it using:
```bash
npm run dev
```
*(Alternatively, serve `index.html` via Live Server or any static host).*

---

## 📂 Project Structure

```text
Vidya-Setu/
├── Backend/
│   ├── models/            # Mongoose Schemas (User, Job, Product, etc.)
│   ├── routes/            # Express API Routes (userRoutes, jobRoutes, aiRoutes)
│   ├── services/          # Background services (jobFetcher, AI adapters)
│   ├── .env               # Environment variables (ignored by Git)
│   └── server.js          # Entry point for the backend
├── Frontend/
│   ├── assets/            # Images, icons, and static files
│   ├── css/               # Styling files
│   ├── js/                # Client-side logic
│   └── index.html         # Main entry point for the UI
└── .gitignore             # Git ignore rules
```

---

## 🛡️ Security

*   **Environment Variables:** Sensitive data like MongoDB URIs and API keys are strictly kept out of version control. Use `.env.example`.
*   **Password Encryption:** All user passwords are encrypted using Bcrypt hashing before being saved to the database.
*   **Vulnerability Reporting:** See [SECURITY.md](SECURITY.md) for our security policy and reporting instructions.
*   **Hard-Coded Paths:** Note that there are some hard-coded local absolute paths in test scripts (e.g., `import_internshala.js`, `import_naukri.js`) which will need to be updated to relative paths or environment variables if moved to a different machine.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check [issues page](https://github.com/akarshakmishra47-afk/Vidya-Setu/issues).

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
