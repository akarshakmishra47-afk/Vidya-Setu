# 🎓 Vidya Setu - Student Web Portal

Vidya Setu is a comprehensive, all-in-one web portal designed to empower college students. It bridges the gap between campus life and professional growth by providing a centralized platform for discovering GATE PYQs, analyzing resumes using AI, finding real-time job opportunities, and buying/selling on a campus marketplace.

---

## 🚀 Key Features

*   **👤 Student Profiles & Portfolios**
    *   Secure student registration and authentication (Bcrypt hashed passwords, robust JWT session management).
    *   Dynamic user profiles with educational details and resume upload.
    *   Multi-tab session synchronization (logging out securely manages all tabs).
*   **🤖 AI Integration (Groq & LLaMA 3.3)**
    *   **Resume Intelligence:** PDF parsing and AI-powered resume analysis for gap identification and personalized career roadmaps.
    *   **Ask Prashna:** Built-in AI doubt solver for academic and technical queries.
*   **📚 GATE Insights**
    *   Dedicated repository for GATE Previous Year Questions (PYQs) covering CS, DA, and ECE.
    *   Advanced filtering by Year, Subject, and Topic.
*   **💼 Live Jobs, Internships & Hackathons Hub**
    *   Categorized listings (Jobs, Internships, Hackathons) with advanced filtering (Domain, Location, Work Mode).
*   **🛒 Campus Store (Marketplace)**
    *   A peer-to-peer marketplace where students can buy, sell, or exchange study materials, electronics, and other campus essentials.

---

## 🛠️ Technology Stack

**Frontend:**
*   React.js (Single-file monolithic architecture via Babel standalone)
*   Tailwind CSS for utility-first styling
*   Lucide React for iconography
*   Modern, responsive SPA design.

**Backend:**
*   Node.js & Express.js
*   **Database:** MongoDB & Mongoose
*   **Authentication:** Custom Auth / JWT / Bcrypt
*   **AI Integration:** Groq SDK (Llama 3 models)
*   **File Handling:** Multer, PDF-Parse, Cloudinary

---

## ⚙️ Installation & Setup

### Prerequisites
*   Node.js (v16+ recommended)
*   MongoDB Cluster (Atlas or Local)
*   Groq API Key
*   Cloudinary Account (For Resume Storage)

### 1. Clone the Repository
```bash
git clone https://github.com/akarshakmishra47-afk/Vidya-Setu.git
cd Vidya-Setu
```

### 2. Environment Variables
Create a `.env` file in the `Backend` directory and add the following:
```env
PORT=5000
FRONTEND_URL=http://localhost:5000
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Install Dependencies
From the root directory, run:
```bash
npm install
```
*(This automatically installs the backend dependencies via the root package.json)*

### 4. Run the Application
From the root directory, run:
```bash
npm start
```
*The server will start on port 5000 and serve the frontend locally at `http://localhost:5000/`.*

---

## 📂 Project Structure

```text
Vidya-Setu/
├── Backend/
│   ├── models/            # Mongoose Schemas (User, PYQ, Job, Product)
│   ├── routes/            # Express API Routes (userRoutes, academicRoutes, aiRoutes, etc.)
│   ├── .env               # Environment variables (ignored by Git)
│   └── server.js          # Entry point for the backend & frontend serving
├── Frontend/
│   ├── LandingPage.js     # React Landing Page UI
│   └── index.html         # Main entry point SPA (Contains React components & Tailwind)
├── package.json           # Root scripts (start, install)
└── .gitignore             # Git ignore rules
```

---

## 🛡️ Security

*   **Environment Variables:** Sensitive data like MongoDB URIs and API keys are strictly kept out of version control.
*   **Password Encryption:** All user passwords are encrypted using Bcrypt hashing before being saved to the database.
*   **Session Management:** Implements secure JWT access/refresh token rotation via HTTP-only cookies and cross-tab logout synchronization.
*   **Vulnerability Reporting:** See [SECURITY.md](SECURITY.md) for our security policy and reporting instructions.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check [issues page](https://github.com/akarshakmishra47-afk/Vidya-Setu/issues).

---

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
