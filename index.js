const dotenv = require('dotenv');
const solarlunar = require('solarlunar');
const {
  readJson,
  normalizeCalendar,
  parseBirthdayString,
  resolveProjectPath
} = require('./lib/common');

dotenv.config({ path: resolveProjectPath('.env') });

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nextSolarDate(month, day, today) {
  const year = today.getFullYear();
  let candidate = new Date(year, month - 1, day);
  if (candidate < today) {
    candidate = new Date(year + 1, month - 1, day);
  }
  return candidate;
}

function lunarToSolar(lunarYear, month, day, isLeap) {
  try {
    const res = solarlunar.lunar2solar(lunarYear, month, day, isLeap ? 1 : 0);
    if (!res || !res.cYear || !res.cMonth || !res.cDay) return null;
    return new Date(res.cYear, res.cMonth - 1, res.cDay);
  } catch (err) {
    return null;
  }
}

function nextLunarDate(month, day, isLeap, today) {
  const lunarToday = solarlunar.solar2lunar(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );

  const lunarYear = lunarToday && lunarToday.lYear ? lunarToday.lYear : today.getFullYear();
  let candidate = lunarToSolar(lunarYear, month, day, isLeap);

  if (!candidate || candidate < today) {
    candidate = lunarToSolar(lunarYear + 1, month, day, isLeap);
  }

  return candidate;
}

function buildWebhookUrl(key) {
  if (!key) return null;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
}

async function sendWecomMessage(config, content) {
  const envKey = String(process.env.WEBHOOK_KEY || '').trim();
  const configKey = String(config.webhookKey || '').trim();
  const webhookKey = envKey || configKey;
  const webhookUrl = buildWebhookUrl(webhookKey);
  if (!webhookUrl) {
    console.warn('未配置 webhookKey，已跳过消息推送。');
    return;
  }

  const messageType = String(config.messageType || 'text').toLowerCase();
  const payload =
    messageType === 'markdown'
      ? { msgtype: 'markdown', markdown: { content } }
      : { msgtype: 'text', text: { content } };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.errcode !== 0) {
    console.error('推送失败：', body.errmsg || response.statusText);
    return;
  }

  console.log('推送成功。');
}

(async () => {
  const configPath = resolveProjectPath('config.json');
  const friendsPath = resolveProjectPath('friends.json');

  const config = readJson(configPath, {});
  const friends = readJson(friendsPath, []);

  const notifyDays = Number.isFinite(Number(config.notifyDays))
    ? Number(config.notifyDays)
    : 7;

  const today = startOfDay(new Date());

  const upcoming = [];

  for (const friend of friends) {
    const name = String(friend.name || '').trim();
    if (!name) continue;

    const calendar = normalizeCalendar(friend.calendar || 'solar');
    const birthdayInfo = parseBirthdayString(friend.birthday);
    if (!birthdayInfo) continue;

    const { month, day } = birthdayInfo;
    const isLeap = Boolean(friend.isLeap);

    const nextDate =
      calendar === 'lunar'
        ? nextLunarDate(month, day, isLeap, today)
        : nextSolarDate(month, day, today);

    if (!nextDate) continue;

    const nextStart = startOfDay(nextDate);
    const daysUntil = Math.round((nextStart - today) / MS_PER_DAY);

    upcoming.push({
      name,
      calendar,
      sourceDate: birthdayInfo.normalized,
      nextDate: nextStart,
      daysUntil
    });
  }

  upcoming.sort((a, b) => a.nextDate - b.nextDate || a.name.localeCompare(b.name));

  const withinWindow = upcoming.filter(
    (item) => item.daysUntil >= 0 && item.daysUntil <= notifyDays
  );

  if (withinWindow.length === 0) {
    console.log('未来通知范围内没有生日。');
    return;
  }

  const header = `生日提醒（未来 ${notifyDays} 天）`;
  const lines = withinWindow.map((item) => {
    const typeLabel = item.calendar === 'lunar' ? '农历' : '公历';
    return `${item.name}：${formatDate(item.nextDate)}（${typeLabel} ${item.sourceDate}，剩余${item.daysUntil}天）`;
  });

  const content = [header, ...lines].join('\n');

  console.log(content);

  await sendWecomMessage(config, content);
})();
