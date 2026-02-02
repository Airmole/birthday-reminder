const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, json, 'utf8');
}

function normalizeCalendar(value) {
  if (!value) return 'solar';
  const v = String(value).trim().toLowerCase();
  if (
    v === 'lunar' ||
    v === 'chinese' ||
    v === 'yin' ||
    v === '农历' ||
    v === '阴历'
  ) {
    return 'lunar';
  }
  if (
    v === 'solar' ||
    v === 'gregorian' ||
    v === 'yang' ||
    v === '公历' ||
    v === '阳历'
  ) {
    return 'solar';
  }
  return 'solar';
}

function parseBirthdayString(input) {
  if (!input) return null;
  let value = String(input).trim();
  if (!value) return null;

  value = value.replace(/^--/, '');
  value = value.replace(/\./g, '-');

  const digitOnly = value.replace(/[^0-9]/g, '');

  let year;
  let month;
  let day;

  if (/\d{4}[-/]/.test(value)) {
    const parts = value.split(/[-/]/).filter(Boolean);
    if (parts.length >= 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
  } else if (/\d{1,2}[-/]/.test(value)) {
    const parts = value.split(/[-/]/).filter(Boolean);
    if (parts.length >= 2) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    }
  } else if (digitOnly.length === 8) {
    year = parseInt(digitOnly.slice(0, 4), 10);
    month = parseInt(digitOnly.slice(4, 6), 10);
    day = parseInt(digitOnly.slice(6, 8), 10);
  } else if (digitOnly.length === 4) {
    month = parseInt(digitOnly.slice(0, 2), 10);
    day = parseInt(digitOnly.slice(2, 4), 10);
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const hasYear = Boolean(year);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const normalized = hasYear ? `${year}-${mm}-${dd}` : `${mm}-${dd}`;

  return {
    year: year || null,
    month,
    day,
    hasYear,
    normalized
  };
}

function dedupeFriends(list) {
  const seen = new Set();
  const result = [];

  for (const item of Array.isArray(list) ? list : []) {
    const name = String(item.name || '').trim();
    if (!name) continue;

    const calendar = normalizeCalendar(item.calendar);
    const birthdayInfo = parseBirthdayString(item.birthday);
    if (!birthdayInfo) continue;

    const isLeap = Boolean(item.isLeap);
    const key = `${name}|${calendar}|${birthdayInfo.normalized}|${isLeap ? '1' : '0'}`;
    if (seen.has(key)) continue;

    const next = {
      name,
      birthday: birthdayInfo.normalized,
      calendar
    };

    if (isLeap) next.isLeap = true;
    if (item.note) next.note = String(item.note);

    result.push(next);
    seen.add(key);
  }

  return result;
}

function resolveProjectPath(...parts) {
  return path.resolve(__dirname, '..', ...parts);
}

module.exports = {
  readJson,
  writeJson,
  normalizeCalendar,
  parseBirthdayString,
  dedupeFriends,
  resolveProjectPath
};
