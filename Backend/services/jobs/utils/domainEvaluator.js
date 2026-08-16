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
  'Finance',
  'Marketing',
  'Human Resources',
  'UI/UX Design',
  'Graphic Design',
  'Product Management',
  'Business Analytics'
];

const DOMAIN_RULES = [
  { domain: 'Embedded Systems', keywords: ['embedded software', 'embedded systems', 'embedded c', 'firmware', 'microcontroller', 'iot engineer', 'embedded'] },
  { domain: 'Software Development', keywords: ['software engineer', 'sde', 'software developer', 'programmer', 'c++', 'java developer', 'python developer', '.net developer', 'net developer', 'backend', 'frontend', 'full stack', 'fullstack', 'application developer', 'api developer', 'qa', 'quality assurance', 'automation testing', 'test automation', 'sdet', 'software testing', 'django', 'flask', '.net', 'node.js', 'product engineer', 'system engineer', 'java architect', 'solutions engineer', 'cs subject expert', 'it support', 'product support', 'sailpoint developer', 'salesforce', 'golang developer', 'system support associate', 'technical engineering manager', 'information technology engineer', 'service desk engineer', 'technical support engineer', 'support engineer'] },
  { domain: 'Web Development', keywords: ['web developer', 'react', 'angular', 'vue', 'nodejs', 'frontend developer', 'front-end', 'front end', 'backend developer', 'back-end', 'php', 'laravel', 'web engineer', 'website developer', 'shopify expert', 'framer developer'] },
  { domain: 'App Development', keywords: ['android', 'ios', 'mobile app', 'flutter', 'react native', 'swift', 'kotlin', 'app developer', 'mobile developer'] },
  { domain: 'AI/ML', keywords: ['machine learning', 'ml engineer', 'ai engineer', 'artificial intelligence', 'deep learning', 'nlp', 'computer vision', 'generative ai', 'llm', 'ai', 'ai/ml', 'aiml', 'gen ai', 'genai', 'agentic ai', 'agentic', 'large language model', 'rag', 'retrieval augmented generation', 'ai architect'] },
  { domain: 'Data Science', keywords: ['data scientist', 'data analyst', 'data engineer', 'big data', 'pandas', 'hadoop', 'spark', 'analytics', 'data visualization', 'data science', 'data analytics', 'pyspark', 'bigquery', 'databricks', 'data engineering', 'etl', 'data platform', 'data modeler'] },
  { domain: 'Cyber Security', keywords: ['cyber security', 'cybersecurity', 'security engineer', 'penetration testing', 'ethical hacker', 'soc analyst', 'infosec', 'information security', 'vulnerability', 'sase analyst'] },
  { domain: 'DevOps', keywords: ['devops', 'devsecops', 'site reliability', 'sre', 'ci/cd', 'kubernetes', 'docker', 'terraform', 'jenkins', 'mlops', 'observability', 'copado engineer', 'agentops', 'monitoring engineer', 'system admin'] },
  { domain: 'Cloud Computing', keywords: ['cloud engineer', 'cloud architect', 'cloud infrastructure', 'cloud infrastructure engineer', 'cloud infrastructure associate', 'cloud computing', 'cloud platform', 'cloud platform engineer', 'cloud solutions architect', 'aws engineer', 'azure engineer', 'microsoft azure', 'google cloud', 'google cloud platform', 'cloud services', 'cloud operations', 'cloud administrator', 'cloud migration', 'cloud solutions', 'cloud architecture', 'aws', 'azure', 'gcp', 'server specialist', 'platform engineer cloud'] },
  { domain: 'Database', keywords: ['database administrator', 'dba', 'sql developer', 'postgresql', 'oracle db', 'mysql', 'mongodb admin', 'database', 'oracle', 'netezza', 'neo4j', 'sql server', 'snowflake', 'data migration'] },
  { domain: 'Electronics', keywords: ['electronics engineer', 'vlsi', 'circuit design', 'fpga', 'hardware engineer', 'analog design', 'digital design', 'pcb design'] },
  { domain: 'Mechanical Engineering', keywords: ['mechanical engineer', 'mechanical design', 'cad engineer', 'solidworks', 'hvac', 'thermal engineer', 'manufacturing engineer', 'autocad'] },
  { domain: 'Civil Engineering', keywords: ['civil engineer', 'structural engineer', 'construction engineer', 'site engineer', 'autocad civil', 'architectural engineer'] },
  { domain: 'Electrical Engineering', keywords: ['electrical engineer', 'power systems', 'electrical design', 'control systems', 'high voltage'] },
  { domain: 'Finance', keywords: ['finance', 'financial analyst', 'investment banking', 'accounting', 'auditor', 'chartered accountant', 'tax consultant', 'wealth management'] },
  { domain: 'Marketing', keywords: ['marketing', 'digital marketing', 'seo', 'social media', 'content writer', 'copywriter', 'brand manager', 'campaign manager', 'sales', 'business development'] },
  { domain: 'Human Resources', keywords: ['human resources', 'hr generalist', 'talent acquisition', 'recruiter', 'hr manager', 'employee relations'] },
  { domain: 'UI/UX Design', keywords: ['ui/ux', 'ux designer', 'ui designer', 'user experience', 'user interface', 'figma', 'product designer'] },
  { domain: 'Graphic Design', keywords: ['graphic designer', 'illustrator', 'photoshop', 'motion graphics', 'video editor', 'visual designer', 'animator'] },
  { domain: 'Product Management', keywords: ['product manager', 'product owner', 'scrum master', 'agile coach', 'associate product manager', 'apm', 'delivery manager', 'project manager'] },
  { domain: 'Business Analytics', keywords: ['business analyst', 'business intelligence', 'power bi', 'tableau', 'business analytics', 'reporting analyst', 'reporting', 'decision science', 'supply chain analytics', 'analytics consultant'] }
];

/**
 * Evaluates a job to assign one of the 21 predefined domains.
 * @param {string} title 
 * @param {string} description 
 * @param {string[]} tags 
 * @returns {string|null} The exact domain name or null if no confident match.
 */
function evaluateDomain(title = '', description = '', tags = []) {
  const t = (title || '').toLowerCase();
  const d = (description || '').toLowerCase();
  const tagsString = (tags || []).join(' ').toLowerCase();
  
  const fullText = `${t} ${d} ${tagsString}`;
  
  // High confidence match: Title matching
  for (const rule of DOMAIN_RULES) {
    for (const kw of rule.keywords) {
      // Regex with word boundaries to prevent partial matches like "data" in "database" matching Data Science
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(t)) {
        return rule.domain;
      }
    }
  }

  // Medium confidence match: Tags matching
  for (const rule of DOMAIN_RULES) {
    for (const kw of rule.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(tagsString)) {
        return rule.domain;
      }
    }
  }

  // Lower confidence match: Description matching (requires multiple hits or specific keywords to avoid false positives, but for now we'll do simple check)
  for (const rule of DOMAIN_RULES) {
    for (const kw of rule.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(d)) {
        return rule.domain;
      }
    }
  }

  return null;
}

module.exports = {
  DOMAINS,
  evaluateDomain
};
