const fs = require('fs');
const path = require('path');
const {
  readJson,
  writeJson,
  normalizeCalendar,
  parseBirthdayString,
  dedupeFriends,
  resolveProjectPath
} = require('../lib/common');

function findDefaultFile(ext) {
  const cwd = process.cwd();
  const scriptDir = __dirname;

  const preferred = path.join(cwd, `friends${ext}`);
  if (fs.existsSync(preferred)) return preferred;

  const cwdMatches = fs
    .readdirSync(cwd)
    .filter((file) => file.toLowerCase().endsWith(ext));
  if (cwdMatches.length > 0) return path.join(cwd, cwdMatches[0]);

  const scriptPreferred = path.join(scriptDir, `friends${ext}`);
  if (fs.existsSync(scriptPreferred)) return scriptPreferred;

  const scriptMatches = fs
    .readdirSync(scriptDir)
    .filter((file) => file.toLowerCase().endsWith(ext));
  if (scriptMatches.length === 0) return null;
  return path.join(scriptDir, scriptMatches[0]);
}

function parseIcsDate(value) {
  if (!value) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes('T')) {
    raw = raw.split('T')[0];
  }
  raw = raw.replace(/Z$/i, '');
  return parseBirthdayString(raw);
}

function unfoldLines(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && result.length > 0) {
      result[result.length - 1] += line.slice(1);
    } else {
      result.push(line);
    }
  }
  return result;
}

function parseIcs(text) {
  const lines = unfoldLines(text);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(':');
    if (idx === -1) continue;

    const left = line.slice(0, idx);
    const value = line.slice(idx + 1).trim();
    const [prop, ...paramsParts] = left.split(';');
    const propName = prop.toUpperCase();
    const params = paramsParts.join(';').toUpperCase();

    if (propName === 'SUMMARY') {
      current.name = value;
      continue;
    }

    if (
      propName === 'BDAY' ||
      propName === 'BIRTHDAY' ||
      propName === 'X-APPLE-BIRTHDAY'
    ) {
      current.dateRaw = value;
      current.datePriority = 2;
    } else if (propName === 'DTSTART') {
      if (!current.datePriority) {
        current.dateRaw = value;
        current.datePriority = 1;
      }
    }

    if (
      params.includes('CHINESE') ||
      params.includes('LUNAR') ||
      value.includes('农历') ||
      value.toLowerCase().includes('lunar')
    ) {
      current.calendar = 'lunar';
    }
  }

  return events;
}

function toFriend(event) {
  if (!event) return null;
  const name = String(event.name || '').trim();
  if (!name) return null;
  const dateInfo = parseIcsDate(event.dateRaw);
  if (!dateInfo) return null;

  return {
    name,
    birthday: dateInfo.normalized,
    calendar: normalizeCalendar(event.calendar || 'solar')
  };
}

const args = process.argv.slice(2);
const inputPath = args[0]
  ? path.resolve(process.cwd(), args[0])
  : findDefaultFile('.ics');

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('未找到 .ics 文件，请指定路径，例如: node script/import-ics.js ./friends.ics');
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const events = parseIcs(raw);
const friends = events.map(toFriend).filter(Boolean);

const friendsPath = resolveProjectPath('friends.json');
const existing = readJson(friendsPath, []);
const merged = dedupeFriends([...existing, ...friends]);
writeJson(friendsPath, merged);

console.log(`已读取 ${events.length} 条事件，合并后共有 ${merged.length} 位朋友。`);
