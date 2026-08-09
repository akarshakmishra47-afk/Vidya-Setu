/**
 * branchClassifier.js
 * Classifies a job into the appropriate B.Tech branch based on title + description.
 * Covers all major engineering branches relevant to Indian B.Tech curriculum.
 */

// Order matters: more specific patterns first
const BRANCH_RULES = [
  {
    branch: 'AI/ML',
    keywords: [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
      'nlp', 'natural language processing', 'computer vision', 'generative ai',
      'llm', 'large language model', 'reinforcement learning', 'mlops',
      'ai engineer', 'ml engineer', 'data scientist', 'model training'
    ]
  },
  {
    branch: 'Data Science',
    keywords: [
      'data scientist', 'data science', 'data analyst', 'business analyst',
      'analytics', 'data engineer', 'big data', 'data pipeline', 'etl',
      'power bi', 'tableau', 'statistics', 'statistical modelling', 'pandas', 'numpy'
    ]
  },
  {
    branch: 'CSE',
    keywords: [
      'software engineer', 'software developer', 'software development',
      'backend developer', 'backend engineer', 'frontend developer', 'frontend engineer',
      'full stack', 'fullstack', 'web developer', 'web development',
      'api developer', 'react developer', 'node developer', 'java developer',
      'python developer', 'django', 'flask', 'spring boot', 'microservices',
      'devops', 'cloud engineer', 'aws', 'azure', 'gcp', 'kubernetes',
      'docker', 'sre', 'site reliability', 'cybersecurity', 'security engineer',
      'penetration test', 'ethical hack', 'network security',
      'database administrator', 'dba', 'sql developer',
      'mobile developer', 'android developer', 'ios developer', 'flutter',
      'game developer', 'unity', 'unreal',
      'cse', 'computer science', 'software intern', 'coding intern',
      'programmer', 'automation engineer', 'qa engineer', 'test engineer'
    ]
  },
  {
    branch: 'IT',
    keywords: [
      'information technology', 'it support', 'it analyst', 'system administrator',
      'sysadmin', 'it infrastructure', 'helpdesk', 'technical support',
      'network administrator', 'network engineer', 'it operations', 'itops',
      'business intelligence', 'it consultant', 'erp', 'sap consultant'
    ]
  },
  {
    branch: 'ECE',
    keywords: [
      'electronics', 'embedded', 'iot', 'firmware', 'microcontroller',
      'fpga', 'vhdl', 'verilog', 'vlsi', 'signal processing', 'dsp',
      'rf engineer', 'antenna', 'communication engineer', 'telecom',
      'hardware engineer', 'pcb', 'circuit', 'semiconductor', 'asic',
      'ece', 'electronics and communication', 'robotics electronics'
    ]
  },
  {
    branch: 'EEE',
    keywords: [
      'eee', 'electrical and electronics', 'power electronics',
      'control systems', 'automation', 'plc', 'scada', 'drives',
      'motor drives', 'inverter', 'hmi', 'dcs'
    ]
  },
  {
    branch: 'EE',
    keywords: [
      'electrical engineer', 'power systems', 'power grid', 'high voltage',
      'transformer', 'switchgear', 'substation', 'protection engineer',
      'electrical design', 'electrical project', 'electrical maintenance',
      'ee ', 'electrical engineering'
    ]
  },
  {
    branch: 'Mechanical',
    keywords: [
      'mechanical engineer', 'mechanical design', 'cad', 'catia', 'solidworks',
      'autocad', 'pro-e', 'creo', 'ansys', 'manufacturing', 'production engineer',
      'thermal', 'fluid mechanics', 'hvac', 'maintenance engineer',
      'quality engineer', 'lean', 'six sigma', 'mech', 'machine design',
      'tool design', 'fea', 'finite element'
    ]
  },
  {
    branch: 'Civil',
    keywords: [
      'civil engineer', 'structural engineer', 'site engineer', 'construction',
      'infrastructure', 'surveying', 'geotechnical', 'concrete', 'staad',
      'etabs', 'revit', 'bim', 'urban planning', 'highway', 'bridge',
      'water resources', 'environmental civil', 'civil supervision'
    ]
  },
  {
    branch: 'Chemical',
    keywords: [
      'chemical engineer', 'process engineer', 'pharma', 'pharmaceutical',
      'refinery', 'petrochemical', 'oil and gas', 'polymer', 'catalyst',
      'reaction engineering', 'plant design', 'chemical process',
      'distillation', 'piping', 'pid', 'aspen', 'hysys'
    ]
  },
  {
    branch: 'Automobile',
    keywords: [
      'automobile', 'automotive', 'vehicle', 'auto engineer',
      'powertrain', 'chassis', 'body', 'trim', 'electric vehicle', 'ev',
      'battery management', 'adas', 'automotive embedded', 'can bus'
    ]
  },
  {
    branch: 'Aerospace',
    keywords: [
      'aerospace', 'aviation', 'aircraft', 'drone', 'uav', 'propulsion',
      'aerodynamics', 'avionics', 'flight', 'satellite', 'space',
      'isro', 'drdo', 'hal', 'missile'
    ]
  },
  {
    branch: 'Biotechnology',
    keywords: [
      'biotechnology', 'bioinformatics', 'molecular biology', 'genetics',
      'genomics', 'microbiology', 'biochemistry', 'cell biology',
      'clinical research', 'bioprocess', 'fermentation', 'biopharma'
    ]
  },
  {
    branch: 'Biomedical',
    keywords: [
      'biomedical', 'medical device', 'clinical engineer', 'healthcare technology',
      'diagnostic', 'imaging', 'mri', 'ecg', 'hospital equipment'
    ]
  },
  {
    branch: 'Mechatronics',
    keywords: [
      'mechatronics', 'robotics', 'robot', 'industrial robot', 'cobots',
      'motion control', 'servo', 'cnc', 'pick and place', 'vision systems'
    ]
  },
  {
    branch: 'Robotics',
    keywords: [
      'robotics engineer', 'ros', 'robot operating system', 'slam',
      'path planning', 'manipulation', 'humanoid', 'warehouse robot'
    ]
  },
  {
    branch: 'Instrumentation',
    keywords: [
      'instrumentation', 'control engineer', 'sensor', 'transducer',
      'calibration', 'measurement', 'metering', 'flow measurement',
      'pressure transmitter', 'dcs instrumentation'
    ]
  },
  {
    branch: 'Environmental',
    keywords: [
      'environmental engineer', 'environment', 'sustainability',
      'waste management', 'water treatment', 'etp', 'stp', 'pollution control',
      'climate', 'carbon', 'renewable energy', 'solar', 'wind energy'
    ]
  },
  {
    branch: 'Production',
    keywords: [
      'production engineer', 'production planning', 'shop floor',
      'assembly line', 'operations engineer', 'industrial engineering',
      'supply chain engineer', 'logistics engineer', 'erp production'
    ]
  },
  {
    branch: 'Metallurgy',
    keywords: [
      'metallurgy', 'materials engineer', 'material science', 'steel',
      'aluminium', 'copper', 'casting', 'forging', 'welding', 'heat treatment',
      'corrosion', 'non-destructive testing', 'ndt'
    ]
  }
];

/**
 * Classifies a job into a B.Tech branch.
 * @param {string} title
 * @param {string} description
 * @returns {string} branch name
 */
function classifyBranch(title = '', description = '') {
  const combined = (title + ' ' + description).toLowerCase();

  for (const rule of BRANCH_RULES) {
    if (rule.keywords.some(k => combined.includes(k))) {
      return rule.branch;
    }
  }

  return 'General Engineering';
}

/**
 * Returns experience level from title/description.
 * @param {string} title
 * @param {string} description
 * @returns {string}
 */
function classifyExperienceLevel(title = '', description = '') {
  const combined = (title + ' ' + description).toLowerCase();

  if (/fresher|freshers|fresh graduate|new graduate|0\s*year|no experience/.test(combined)) return 'Fresher';
  if (/entry.level|entry level|0-1\s*year|junior|associate|graduate trainee|trainee|apprentice/.test(combined)) return 'Entry-Level';
  if (/\bjunior\b|jr\.?\s/.test(combined)) return 'Junior';
  if (/\bsenior\b|\bsr\.?\s|\blead\b|\bprincipal\b|\bstaff\b|\barchitect\b|\bdirector\b|\bmanager\b/.test(combined)) return 'Experienced';
  if (/intern|internship/.test(combined)) return 'Fresher'; // internships are fresher-level

  return 'Unknown';
}

/**
 * Returns job category for filtering purposes.
 * @param {string} title
 * @param {string} description
 * @param {string} primaryType - 'Job' | 'Internship' | 'Hackathon'
 * @param {boolean} isGovt
 * @returns {string} category
 */
function classifyCategory(title = '', description = '', primaryType = 'Job', isGovt = false) {
  if (primaryType === 'Hackathon') return 'Hackathon';
  if (primaryType === 'Internship') return 'Internship';

  if (isGovt) return 'Government';

  const combined = (title + ' ' + description).toLowerCase();
  const branch = classifyBranch(title, description);
  const expLevel = classifyExperienceLevel(title, description);

  if (expLevel === 'Fresher' || expLevel === 'Entry-Level') return 'Fresher';
  if (['CSE', 'IT', 'AI/ML', 'Data Science'].includes(branch)) return 'IT';
  if (branch !== 'General Engineering') return 'Engineering';

  return 'Private';
}

module.exports = { classifyBranch, classifyExperienceLevel, classifyCategory };
