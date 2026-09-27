function parseGateFilename(filename) {
  let baseName = filename.split('/').pop().replace(/\.[^/.]+$/, "").toUpperCase();
  
  const yearMatch = baseName.match(/(199\d|20[0-2]\d)/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  
  let remainder = baseName.replace(yearMatch[0], ' ').replace(/GATE/g, ' ');
  
  let set = '';
  let paperCode = '';
  
  const knownCodes = ['CS','ME','CE','EE','EC','IN','CH','BT','BM','AE','AG','AR','CY','GG','MA','MN','MT','PE','PH','PI','ST','TF','XE','XH','XL', 'DA'];
  
  let foundCode = null;
  // First pass: bounded
  for (const code of knownCodes) {
    const regex = new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`);
    if (regex.test(remainder)) {
      foundCode = code;
      remainder = remainder.replace(new RegExp(`(?:^|[^A-Z])(${code})(?:[^A-Z]|$)`), ' ');
      break;
    }
  }
  
  // Second pass: unbounded
  if (!foundCode) {
    for (const code of knownCodes) {
      if (remainder.includes(code)) {
        foundCode = code;
        remainder = remainder.replace(code, ' ');
        break;
      }
    }
  }
  
  if (!foundCode) return null;
  paperCode = foundCode;
  
  const setMatch = remainder.match(/(?:SET\s*|S\s*|[-_])(\d)/) || remainder.match(/\b(\d)\b/);
  if (setMatch) {
    set = `Set-${setMatch[1]}`;
  }
  
  return { year, paperCode, set };
}

const tests = [
  "GATE 2021 CS Set-1",
  "GATE2024_CS2",
  "GATE 2022 ME",
  "2023_EE_SET_2",
  "CE 2020",
  "GATE_2019_IN_S1",
  "GATE-2024-DA",
  "2021 GATE CS Set 2",
  "ECE_2022", // Should fail or map to EC? ECE is not in knownCodes
  "EC_2022",
  "GATE 2024 CS"
];

tests.forEach(t => console.log(t, "=>", parseGateFilename(t)));
