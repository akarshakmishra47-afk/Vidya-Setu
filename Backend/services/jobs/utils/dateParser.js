/**
 * dateParser.js
 * Deterministic date and deadline parser for jobs, internships, and hackathons.
 * Parses relative and absolute dates into native Date objects without fabricating data.
 */

/**
 * Parses an arbitrary date string or timestamp into a valid Date object.
 * @param {string|number|Date} val - The input date representation.
 * @returns {Date|null} Valid Date or null.
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof val !== 'string') return null;
  const str = val.trim();
  if (!str) return null;

  // Try standard Date constructor
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yr = d.getFullYear();
    if (yr >= 2020 && yr <= 2035) {
      return d;
    }
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const parsed = new Date(Date.UTC(year, month, day));
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * Parses relative posting strings into a Date object.
 * e.g., "Posted 3 hours ago", "2 days ago", "Just posted", "Yesterday"
 * @param {string} text - The relative text.
 * @param {Date} [baseDate=new Date()] - Reference date.
 * @returns {Date|null}
 */
function parseRelativeDate(text, baseDate = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase().trim();

  if (t.includes('just posted') || t.includes('just now') || t === 'today') {
    return new Date(baseDate);
  }
  if (t.includes('yesterday')) {
    return new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
  }

  const hoursMatch = t.match(/(\d+)\s*(?:hour|hr)s?\s*ago/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return new Date(baseDate.getTime() - hours * 60 * 60 * 1000);
  }

  const daysMatch = t.match(/(\d+)\s*(?:day|d)s?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return new Date(baseDate.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const weeksMatch = t.match(/(\d+)\s*(?:week|wk)s?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    return new Date(baseDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  }

  const monthsMatch = t.match(/(\d+)\s*(?:month|mo)s?\s*ago/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    return new Date(baseDate.getTime() - months * 30 * 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Parses a raw deadline string into structured information.
 * Distinguishes explicit dates from rolling or unspecified deadlines.
 * @param {string|Date} rawDeadline - The raw deadline from the source.
 * @param {Date} [baseDate=new Date()] - Reference date.
 * @returns {{ deadlineDate: Date|null, deadlineText: string|null, isRolling: boolean }}
 */
function parseDeadline(rawDeadline, baseDate = new Date()) {
  if (!rawDeadline) {
    return { deadlineDate: null, deadlineText: null, isRolling: false };
  }

  if (rawDeadline instanceof Date) {
    if (!isNaN(rawDeadline.getTime())) {
      return {
        deadlineDate: rawDeadline,
        deadlineText: rawDeadline.toISOString().split('T')[0],
        isRolling: false
      };
    }
    return { deadlineDate: null, deadlineText: null, isRolling: false };
  }

  const raw = String(rawDeadline).trim();
  const lower = raw.toLowerCase();

  // Non-date markers
  if (
    lower === 'not specified' ||
    lower === 'unknown' ||
    lower === 'none' ||
    lower === 'n/a' ||
    lower === ''
  ) {
    return { deadlineDate: null, deadlineText: null, isRolling: false };
  }

  if (
    lower.includes('rolling') ||
    lower.includes('open until filled') ||
    lower.includes('ongoing')
  ) {
    return { deadlineDate: null, deadlineText: 'Rolling', isRolling: true };
  }

  if (lower.includes('check official notification')) {
    return { deadlineDate: null, deadlineText: 'Check official notification', isRolling: false };
  }

  // Relative deadline: "apply within 14 days" or "ends in 3 days"
  const withinMatch = lower.match(/(?:within|ends? in|closes in)\s*(\d+)\s*days?/);
  if (withinMatch) {
    const days = parseInt(withinMatch[1], 10);
    const calculatedDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      deadlineDate: calculatedDate,
      deadlineText: calculatedDate.toISOString().split('T')[0],
      isRolling: false
    };
  }

  // Absolute date parsing
  const parsed = parseDate(raw);
  if (parsed) {
    return {
      deadlineDate: parsed,
      deadlineText: parsed.toISOString().split('T')[0],
      isRolling: false
    };
  }

  // Return raw string for human display if unparseable, but deadlineDate is null
  return {
    deadlineDate: null,
    deadlineText: raw.substring(0, 100),
    isRolling: false
  };
}

module.exports = {
  parseDate,
  parseRelativeDate,
  parseDeadline
};
