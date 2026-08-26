require('dotenv').config();
const mongoose = require('mongoose');
const PYQ = require('./models/PYQ');

const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : null;

if (!mongoURI) {
  console.error("❌ ERROR: MONGO_URI is missing in your .env file!");
  process.exit(1);
}

const seedData = [
  // AKTU B.Tech - Data Structures (Verified Data - meets sufficiency: >=5 questions, >=2 years)
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 3, subject: 'Data Structures',
    year: 2022, unit: 1, topic: 'Arrays',
    question: 'Write a C program to reverse an array without using a second array.',
    marks: 10, questionType: 'Programming', difficulty: 'Medium',
    isVerified: true, isSampleData: false, source: 'AKTU 2022 End Sem (Regular)', sourceYear: 2022
  },
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 3, subject: 'Data Structures',
    year: 2022, unit: 2, topic: 'Linked Lists',
    question: 'Explain the difference between singly and doubly linked lists. When would you prefer one over the other?',
    marks: 5, questionType: 'Conceptual', difficulty: 'Easy',
    isVerified: true, isSampleData: false, source: 'AKTU 2022 End Sem (Regular)', sourceYear: 2022
  },
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 3, subject: 'Data Structures',
    year: 2021, unit: 3, topic: 'Trees',
    question: 'Define AVL Tree. Perform rotations to insert the following elements into an empty AVL tree: 10, 20, 30, 40, 50, 25.',
    marks: 10, questionType: 'Numerical', difficulty: 'Hard',
    isVerified: true, isSampleData: false, source: 'AKTU 2021 End Sem', sourceYear: 2021
  },
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 3, subject: 'Data Structures',
    year: 2021, unit: 1, topic: 'Stacks',
    question: 'Convert the following infix expression to postfix using a stack: A * B + C / D.',
    marks: 5, questionType: 'Numerical', difficulty: 'Medium',
    isVerified: true, isSampleData: false, source: 'AKTU 2021 End Sem', sourceYear: 2021
  },
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 3, subject: 'Data Structures',
    year: 2023, unit: 4, topic: 'Graphs',
    question: 'Write BFS and DFS traversal algorithms for a graph. Compare their time and space complexities.',
    marks: 10, questionType: 'Theoretical', difficulty: 'Medium',
    isVerified: true, isSampleData: false, source: 'AKTU 2023 End Sem (Back)', sourceYear: 2023
  },
  // AKTU B.Tech - Data Structures (Sample Data - unverified)
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 3, subject: 'Data Structures',
    year: 2023, unit: 5, topic: 'Sorting',
    question: 'Explain Quick Sort algorithm with an example.',
    marks: 10, questionType: 'Theoretical', difficulty: 'Medium',
    isVerified: false, isSampleData: true
  },

  // AKTU B.Tech - Operating Systems (Sample Data ONLY - insufficient verified)
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 4, subject: 'Operating Systems',
    year: 2022, unit: 1, topic: 'Process Scheduling',
    question: 'Explain Round Robin scheduling with a Gantt chart.',
    marks: 10, questionType: 'Theoretical', difficulty: 'Medium',
    isVerified: false, isSampleData: true
  },
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 4, subject: 'Operating Systems',
    year: 2021, unit: 2, topic: 'Deadlocks',
    question: 'What are the necessary conditions for a deadlock?',
    marks: 5, questionType: 'Conceptual', difficulty: 'Easy',
    isVerified: false, isSampleData: true
  },
  // Adding one verified question to OS, but it won't be sufficient (need 5 questions, 2 years)
  {
    exam: 'AKTU B.Tech', branch: 'CSE', semester: 4, subject: 'Operating Systems',
    year: 2023, unit: 3, topic: 'Memory Management',
    question: 'Explain paging and segmentation. What is internal fragmentation?',
    marks: 10, questionType: 'Theoretical', difficulty: 'Medium',
    isVerified: true, isSampleData: false, source: 'AKTU 2023 End Sem', sourceYear: 2023
  },

  // GATE CSE - Algorithms (Sample Data ONLY)
  {
    exam: 'GATE CSE', subject: 'Algorithms',
    year: 2023, topic: 'Dynamic Programming',
    question: 'Consider the fractional knapsack problem...',
    marks: 2, questionType: 'Numerical', difficulty: 'Hard',
    isVerified: false, isSampleData: true
  },
  {
    exam: 'GATE CSE', subject: 'Algorithms',
    year: 2022, topic: 'Graph Algorithms',
    question: 'Which of the following is true about Dijkstra\'s algorithm?',
    marks: 1, questionType: 'Conceptual', difficulty: 'Medium',
    isVerified: false, isSampleData: true
  },

  // GATE CSE - Operating Systems (Sample Data ONLY)
  {
    exam: 'GATE CSE', subject: 'Operating Systems',
    year: 2023, topic: 'Process Synchronization',
    question: 'Consider three concurrent processes...',
    marks: 2, questionType: 'Numerical', difficulty: 'Hard',
    isVerified: false, isSampleData: true
  },

  // GATE CSE - Data Structures (Sample Data ONLY)
  {
    exam: 'GATE CSE', subject: 'Data Structures',
    year: 2021, topic: 'Heaps',
    question: 'The minimum number of elements in a binary min-heap of height h is...',
    marks: 1, questionType: 'Numerical', difficulty: 'Easy',
    isVerified: false, isSampleData: true
  }
];

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ Database Connected');
    
    // Clear existing PYQs
    await PYQ.deleteMany({});
    console.log('🧹 Cleared existing PYQ records.');

    // Insert new seeded data
    const inserted = await PYQ.insertMany(seedData);
    console.log(`🌱 Successfully seeded ${inserted.length} PYQ records.`);

    mongoose.disconnect();
    console.log('✅ Database Disconnected');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database Connection Error:');
    console.error(err);
    process.exit(1);
  });
