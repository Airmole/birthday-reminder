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

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const records = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const record = {};
    for (let j = 0; j < header.length; j += 1) {
      record[header[j]] = values[j];
    }
    records.push(record);
  }

  return records;
}

function mapRecord(record) {
  const lookup = (keys) => {
    for (const key of keys) {
      if (record[key]) return record[key];
    }
    return '';
  };

  const name = lookup(['name', '姓名', '朋友', '好友']).trim();
  const birthday = lookup(['birthday', '生日', 'birth', '出生日期']).trim();
  const calendar = lookup(['calendar', '类型', '日期类型', '农历/公历', 'calendartype']).trim();
  const isLeapRaw = lookup(['isleap', 'leap', '闰月', '是否闰月']).trim();
  const note = lookup(['note', '备注', 'comment']).trim();

  if (!name || !birthday) return null;

  const birthdayInfo = parseBirthdayString(birthday);
  if (!birthdayInfo) return null;

  const isLeap = ['1', 'true', 'yes', '是', '闰', 'y'].includes(
    String(isLeapRaw).toLowerCase()
  );

  return {
    name,
    birthday: birthdayInfo.normalized,
    calendar: normalizeCalendar(calendar || 'solar'),
    isLeap: isLeap || undefined,
    note: note || undefined
  };
}

const args = process.argv.slice(2);
const inputPath = args[0]
  ? path.resolve(process.cwd(), args[0])
  : findDefaultFile('.csv');

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('未找到 .csv 文件，请指定路径，例如: node script/import-csv.js ./friends.csv');
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const records = parseCsv(raw);
const friends = records.map(mapRecord).filter(Boolean);

const friendsPath = resolveProjectPath('friends.json');
const existing = readJson(friendsPath, []);
const merged = dedupeFriends([...existing, ...friends]);
writeJson(friendsPath, merged);

console.log(`已读取 ${records.length} 行数据，合并后共有 ${merged.length} 位朋友。`);
