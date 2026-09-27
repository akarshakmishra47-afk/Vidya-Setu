require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const PYQ = require('../models/PYQ');

const paperData = {
  'CS': {
    subjects: [
      { name: 'Theory of Computation', topics: ['Regular Languages', 'Context Free Languages', 'Turing Machines'] },
      { name: 'Operating Systems', topics: ['Process Scheduling', 'Deadlocks', 'Memory Management'] },
      { name: 'Computer Networks', topics: ['TCP/IP', 'Routing Algorithms', 'Application Layer'] },
      { name: 'Database Management', topics: ['SQL Queries', 'Normalization', 'Transactions'] }
    ],
    mockQuestions: [
      "Consider the language L = { a^n b^n | n >= 0 }. Is it regular?",
      "Which of the following scheduling algorithms is non-preemptive?",
      "What is the maximum number of edges in a bipartite graph with n vertices?",
      "A relation R is in 3NF if and only if...",
      "The time complexity of binary search is...",
      "In TCP, the window size is used for...",
      "Which of the following is true about context-free grammars?",
      "A deadlock occurs when...",
      "Find the subnet mask for a Class C network.",
      "What is the output of the following SQL query?"
    ]
  },
  'DA': {
    subjects: [
      { name: 'Artificial Intelligence', topics: ['Search Algorithms', 'Logic & Reasoning', 'Machine Learning Basics'] },
      { name: 'Data Science', topics: ['Probability Distribution', 'Hypothesis Testing', 'Data Visualization'] },
      { name: 'Machine Learning', topics: ['Linear Regression', 'Neural Networks', 'SVM'] },
      { name: 'Programming & Data Structures', topics: ['Arrays & Strings', 'Trees & Graphs', 'Algorithm Complexity'] }
    ],
    mockQuestions: [
      "Which search algorithm is guaranteed to be optimal if the heuristic is admissible?",
      "In a normal distribution, what percentage of data falls within one standard deviation?",
      "Which activation function is most commonly used in hidden layers of a neural network?",
      "Calculate the p-value for the following hypothesis test...",
      "What is the time complexity of building a heap?",
      "Support Vector Machines attempt to maximize...",
      "Explain the difference between L1 and L2 regularization.",
      "Which logic gate can act as a universal gate?",
      "Identify the outlier in the following scatter plot data.",
      "What is the output of a sigmoid function?"
    ]
  },
  'ECE': {
    subjects: [
      { name: 'Analog Circuits', topics: ['Diodes & Applications', 'Op-Amps', 'BJT & MOSFETs'] },
      { name: 'Digital Circuits', topics: ['Logic Gates', 'Combinational Circuits', 'Microprocessors'] },
      { name: 'Signals and Systems', topics: ['Fourier Transform', 'Z-Transform', 'LTI Systems'] },
      { name: 'Communications', topics: ['Analog Communication', 'Digital Communication', 'Information Theory'] }
    ],
    mockQuestions: [
      "Calculate the voltage gain of the following inverting op-amp circuit.",
      "Which of the following is an example of an LTI system?",
      "Find the Z-transform of the given sequence.",
      "What is the Shannon channel capacity of a channel with bandwidth B?",
      "In an FM signal, the modulation index is defined as...",
      "Identify the logic implemented by the given CMOS circuit.",
      "What is the threshold voltage of a typical enhancement mode MOSFET?",
      "Calculate the Nyquist rate for the signal x(t) = sinc(100t).",
      "Which flip-flop avoids the race-around condition?",
      "Determine the Fourier series coefficients for a square wave."
    ]
  }
};

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database Connected');

    // First, clear existing GATE questions
    await PYQ.deleteMany({ exam: 'GATE CSE' });
    console.log('🗑️ Cleared old GATE questions');

    const pyqs = [];

    // Iterate over each GATE paper code
    for (const paperCode of ['CS', 'DA', 'ECE']) {
      const data = paperData[paperCode];

      // Generate 150 questions per paper randomly spread across 5 years (2020-2024)
      for (let i = 0; i < 150; i++) {
        const subjectObj = data.subjects[Math.floor(Math.random() * data.subjects.length)];
        const topic = subjectObj.topics[Math.floor(Math.random() * subjectObj.topics.length)];
        const year = 2020 + Math.floor(Math.random() * 5); // 2020 to 2024
        const marks = Math.random() > 0.5 ? 1 : 2;
        const questionText = data.mockQuestions[Math.floor(Math.random() * data.mockQuestions.length)] + ` (Mock Question ${i + 1})`;

        pyqs.push({
          exam: 'GATE CSE', // Keeping 'GATE CSE' as the unified exam type for DB query compatibility
          gatePaper: paperCode,
          subject: subjectObj.name,
          topic: topic,
          year: year,
          question: questionText,
          marks: marks,
          questionType: 'MCQ',
          difficulty: marks === 1 ? 'Medium' : 'Hard',
          isVerified: true,
          isSampleData: true,
          source: `GATE ${year} ${paperCode}`,
          sourceYear: year
        });
      }
    }

    await PYQ.insertMany(pyqs);
    console.log(`🎉 Successfully seeded ${pyqs.length} GATE questions into the database (150 each for CS, DA, ECE)!`);

  } catch (err) {
    console.error('❌ Seeding Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database Disconnected');
  }
}

seed();
