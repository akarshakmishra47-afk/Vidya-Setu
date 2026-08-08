require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const Subject = require('./models/Subject');
const Role = require('./models/Role');

const SUBS = {
  "Data Structures & Algorithms": [{ t: "Arrays & Hashing", p: 92, y: [2019, 2020, 2021, 2022, 2023] }, { t: "Linked Lists", p: 88, y: [2020, 2021, 2022, 2023] }, { t: "Trees & BST", p: 85, y: [2019, 2021, 2022, 2023] }, { t: "Stacks & Queues", p: 78, y: [2019, 2020, 2022, 2023] }, { t: "Graph Algorithms", p: 72, y: [2020, 2021, 2023] }, { t: "Dynamic Programming", p: 65, y: [2021, 2022] }, { t: "Sorting Algorithms", p: 60, y: [2019, 2020] }, { t: "Heaps", p: 45, y: [2022] }],
  "Operating Systems": [{ t: "Process Scheduling", p: 95, y: [2019, 2020, 2021, 2022, 2023] }, { t: "Memory Management", p: 88, y: [2019, 2021, 2022, 2023] }, { t: "Deadlocks", p: 82, y: [2020, 2021, 2022, 2023] }, { t: "File Systems", p: 75, y: [2019, 2020, 2022] }, { t: "Synchronization", p: 70, y: [2020, 2021, 2022] }, { t: "Virtual Memory", p: 65, y: [2019, 2021] }],
  "Database Management Systems": [{ t: "SQL Queries & Joins", p: 96, y: [2019, 2020, 2021, 2022, 2023] }, { t: "Normalization (1NF–BCNF)", p: 90, y: [2019, 2020, 2022, 2023] }, { t: "ER Diagrams", p: 85, y: [2020, 2021, 2022, 2023] }, { t: "Transactions & ACID", p: 76, y: [2021, 2022, 2023] }, { t: "Indexing & B-Trees", p: 68, y: [2019, 2020, 2021] }, { t: "NoSQL Concepts", p: 42, y: [2022, 2023] }],
  "Computer Networks": [{ t: "OSI vs TCP/IP", p: 94, y: [2019, 2020, 2021, 2022, 2023] }, { t: "IP Addressing & Subnetting", p: 87, y: [2019, 2021, 2022, 2023] }, { t: "Routing Algorithms", p: 80, y: [2020, 2021, 2022] }, { t: "TCP vs UDP", p: 75, y: [2019, 2020, 2022, 2023] }, { t: "DNS & DHCP", p: 65, y: [2021, 2022] }, { t: "HTTP & Application Layer", p: 58, y: [2022, 2023] }],
};

const ROLES = {
  "Frontend Developer": { req: ["HTML/CSS", "JavaScript", "React", "Git", "REST APIs"], nice: ["TypeScript", "Next.js", "Redux", "Tailwind"], projs: ["E-commerce App", "Weather Dashboard", "Portfolio Site", "To-Do PWA"] },
  "Backend Developer": { req: ["Python/Node.js", "SQL", "REST APIs", "Git", "Linux"], nice: ["Docker", "Redis", "MongoDB", "AWS"], projs: ["URL Shortener API", "Authentication System", "CRUD Blog App", "Chat Application"] },
  "Data Scientist": { req: ["Python", "NumPy/Pandas", "ML Basics", "Statistics", "SQL"], nice: ["TensorFlow", "Deep Learning", "Data Visualization", "R"], projs: ["MNIST Digit Classifier", "House Price Prediction", "Sentiment Analysis", "EDA on Real Dataset"] },
  "DevOps Engineer": { req: ["Linux", "Docker", "Git", "CI/CD", "Networking"], nice: ["Kubernetes", "Terraform", "AWS/GCP", "Prometheus"], projs: ["Dockerize a Web App", "Jenkins CI Pipeline", "AWS EC2 Deployment", "Bash Automation"] },
  "Android Developer": { req: ["Java/Kotlin", "Android Studio", "XML Layouts", "Git", "REST APIs"], nice: ["Jetpack Compose", "Firebase", "MVVM", "Room DB"], projs: ["Notes App", "Weather App", "Expense Tracker", "Chat App (Firebase)"] },
};

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("No MONGO_URI"); process.exit(1); }

  try {
    await mongoose.connect(uri);

    // Seed Subjects
    await Subject.deleteMany({});
    const subDocs = Object.keys(SUBS).map(name => ({
      name,
      topics: SUBS[name].map(t => ({ title: t.t, probability: t.p, years: t.y }))
    }));
    await Subject.insertMany(subDocs);
    console.log("Subjects seeded.");

    // Seed Roles
    await Role.deleteMany({});
    const roleDocs = Object.keys(ROLES).map(title => ({
      title,
      reqSkills: ROLES[title].req,
      niceSkills: ROLES[title].nice,
      projects: ROLES[title].projs
    }));
    await Role.insertMany(roleDocs);
    console.log("Roles seeded.");

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
seed();
