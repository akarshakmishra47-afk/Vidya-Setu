/**
 * domainEvaluator.js
 * Evaluates job and hackathon titles, descriptions, and tags to classify them
 * into standardized engineering and technology domains.
 */

const DOMAINS = [
  'Software Development',
  'Web Development',
  'App Development',
  'AI/ML',
  'Data Science',
  'Cyber Security',
  'Cloud Computing',
  'DevOps',
  'Database',
  'Electronics',
  'Embedded Systems',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'UI/UX Design',
  'Competitive Programming',
  'General Engineering',
  'Other'
];

const DOMAIN_RULES = [
  {
    domain: 'Embedded Systems',
    keywords: [
      'embedded software', 'embedded systems', 'embedded c', 'firmware',
      'microcontroller', 'iot engineer', 'embedded', 'arduino', 'raspberry pi'
    ]
  },
  {
    domain: 'Software Development',
    keywords: [
      'software engineer', 'sde', 'software developer', 'programmer', 'c++', 'c#',
      'java developer', 'python developer', '.net developer', 'net developer',
      'backend', 'frontend', 'full stack', 'fullstack', 'application developer',
      'api developer', 'qa', 'quality assurance', 'automation testing',
      'test automation', 'sdet', 'software testing', 'django', 'flask',
      '.net', 'node.js', 'product engineer', 'system engineer', 'java architect',
      'solutions engineer', 'cs subject expert', 'it support', 'product support',
      'sailpoint developer', 'salesforce', 'golang developer', 'system support associate',
      'technical engineering manager', 'information technology engineer',
      'service desk engineer', 'technical support engineer', 'support engineer',
      'software intern', 'coding intern', 'sde intern', 'developer intern',
      'python intern', 'java intern', 'software engineering', 'golang', 'rust'
    ]
  },
  {
    domain: 'Web Development',
    keywords: [
      'web developer', 'react', 'angular', 'vue', 'nodejs', 'frontend developer',
      'front-end', 'front end', 'backend developer', 'back-end', 'php', 'laravel',
      'web engineer', 'website developer', 'shopify expert', 'framer developer',
      'web development', 'web development intern', 'html', 'css', 'javascript',
      'typescript', 'nextjs', 'mern', 'mean', 'full stack developer'
    ]
  },
  {
    domain: 'App Development',
    keywords: [
      'android', 'ios', 'mobile app', 'flutter', 'react native', 'swift',
      'kotlin', 'app developer', 'mobile developer', 'app development',
      'android developer', 'ios developer', 'mobile app developer', 'app development intern'
    ]
  },
  {
    domain: 'AI/ML',
    keywords: [
      'machine learning', 'ml engineer', 'ai engineer', 'artificial intelligence',
      'deep learning', 'nlp', 'computer vision', 'generative ai', 'llm',
      'ai', 'ai/ml', 'aiml', 'gen ai', 'genai', 'agentic ai', 'agentic',
      'large language model', 'rag', 'retrieval augmented generation', 'ai architect',
      'ai intern', 'ml intern', 'machine learning intern'
    ]
  },
  {
    domain: 'Data Science',
    keywords: [
      'data scientist', 'data analyst', 'data engineer', 'big data', 'pandas',
      'hadoop', 'spark', 'analytics', 'data visualization', 'data science',
      'data analytics', 'pyspark', 'bigquery', 'databricks', 'data engineering',
      'etl', 'data platform', 'data modeler', 'data science intern'
    ]
  },
  {
    domain: 'Cyber Security',
    keywords: [
      'cyber security', 'cybersecurity', 'security engineer', 'penetration testing',
      'ethical hacker', 'soc analyst', 'infosec', 'information security',
      'vulnerability', 'sase analyst'
    ]
  },
  {
    domain: 'DevOps',
    keywords: [
      'devops', 'devsecops', 'site reliability', 'sre', 'ci/cd', 'kubernetes',
      'docker', 'terraform', 'jenkins', 'mlops', 'observability',
      'copado engineer', 'agentops', 'monitoring engineer', 'system admin'
    ]
  },
  {
    domain: 'Cloud Computing',
    keywords: [
      'cloud engineer', 'cloud architect', 'cloud infrastructure',
      'cloud infrastructure engineer', 'cloud infrastructure associate',
      'cloud computing', 'cloud platform', 'cloud platform engineer',
      'cloud solutions architect', 'aws engineer', 'azure engineer',
      'microsoft azure', 'google cloud', 'google cloud platform', 'cloud services',
      'cloud operations', 'cloud administrator', 'cloud migration', 'cloud solutions',
      'cloud architecture', 'aws', 'azure', 'gcp', 'server specialist', 'platform engineer cloud'
    ]
  },
  {
    domain: 'Database',
    keywords: [
      'database administrator', 'dba', 'sql developer', 'postgresql',
      'oracle db', 'mysql', 'mongodb admin', 'database', 'oracle',
      'netezza', 'neo4j', 'sql server', 'snowflake', 'data migration'
    ]
  },
  {
    domain: 'Electronics',
    keywords: [
      'electronics engineer', 'vlsi', 'circuit design', 'fpga',
      'hardware engineer', 'analog design', 'digital design', 'pcb design', 'semiconductor'
    ]
  },
  {
    domain: 'Mechanical Engineering',
    keywords: [
      'mechanical engineer', 'mechanical design', 'cad engineer',
      'solidworks', 'hvac', 'thermal engineer', 'manufacturing engineer', 'autocad'
    ]
  },
  {
    domain: 'Civil Engineering',
    keywords: [
      'civil engineer', 'structural engineer', 'construction engineer',
      'site engineer', 'autocad civil', 'architectural engineer'
    ]
  },
  {
    domain: 'Electrical Engineering',
    keywords: [
      'electrical engineer', 'power systems', 'electrical design',
      'control systems', 'high voltage'
    ]
  },
  {
    domain: 'UI/UX Design',
    keywords: [
      'ui/ux', 'ux designer', 'ui designer', 'user experience',
      'user interface', 'figma', 'product designer'
    ]
  }
];

/**
 * Evaluates a job or internship to assign one of the predefined domains.
 * @param {string} title 
 * @param {string} description 
 * @param {string[]} tags 
 * @returns {string|null} The exact domain name or null if no confident match.
 */
function evaluateDomain(title = '', description = '', tags = []) {
  const t = (title || '').toLowerCase();
  const d = (description || '').toLowerCase();
  const tagsString = (tags || []).join(' ').toLowerCase();
  
  let bestDomain = null;
  let highestScore = 0;

  for (const rule of DOMAIN_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${escapedKw}(?:[^a-zA-Z0-9_]|$)`, 'ig');
      
      const titleMatches = (t.match(regex) || []).length;
      const tagMatches = (tagsString.match(regex) || []).length;
      const descMatches = (d.match(regex) || []).length;
      
      score += (titleMatches * 5) + (tagMatches * 3) + (descMatches * 1);
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestDomain = rule.domain;
    }
  }

  // Require a minimum confidence score (1 title match = 5 points)
  if (highestScore >= 2) {
    return bestDomain;
  }

  return null;
}

/**
 * Evaluates whether an opportunity is a legitimate Hackathon or Coding Challenge.
 * Hackathons are evaluated flexibly so that innovation challenges and coding arenas
 * are not falsely rejected for lacking narrow language keywords.
 *
 * @param {string} title
 * @param {string} description
 * @param {string[]} tags
 * @returns {{ valid: boolean, domain: string }}
 */
function evaluateHackathon(title = '', description = '', tags = []) {
  const combined = (title + ' ' + description.substring(0, 400) + ' ' + (tags || []).join(' ')).toLowerCase();

  // Exclude non-technical contests (e.g. singing, essay writing, sports)
  const nonTechFilter = /\b(singing|dance|drawing|painting|essay writing|debate|sports tournament|quiz contest|photography)\b/;
  if (nonTechFilter.test(combined) && !/\b(code|coding|hackathon|tech|software|developer)\b/.test(combined)) {
    return { valid: false, domain: 'Other' };
  }

  // Core hackathon indicators
  const hackathonRegex = /\b(hackathon|challenge|coding|arena|codefest|datathon|ideathon|hiring challenge|developer challenge|programming|algo|competitive programming|innovation challenge|buildathon|open innovation|solve)\b/;
  const isHackathon = hackathonRegex.test(combined);

  if (!isHackathon) {
    return { valid: false, domain: 'Other' };
  }

  // First try specific domain evaluation (e.g. AI hackathon -> AI/ML)
  const specificDomain = evaluateDomain(title, description, tags);
  if (specificDomain) {
    return { valid: true, domain: specificDomain };
  }

  // Fallback domain classification for broad hackathons
  if (/\b(data|analyst|analytics|ai|ml|model)\b/.test(combined)) {
    return { valid: true, domain: 'Data Science' };
  }
  if (/\b(web|frontend|react|app|fullstack)\b/.test(combined)) {
    return { valid: true, domain: 'Web Development' };
  }
  if (/\b(algo|competitive|contest|challenge|arena)\b/.test(combined)) {
    return { valid: true, domain: 'Competitive Programming' };
  }

  return { valid: true, domain: 'Software Development' };
}

module.exports = {
  DOMAINS,
  DOMAIN_RULES,
  evaluateDomain,
  evaluateHackathon
};
