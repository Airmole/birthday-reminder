# birthday-reminder

一个基于 Node.js 的生日提醒工具，支持公历/农历生日转换、按时间排序，并通过企业微信群机器人推送消息。

## 功能

- 维护 `friends.json` 的生日信息
- 从 `.ics` 或 `.csv` 批量导入生日
- 农历生日自动转换为最近的公历日期
- 按“距离今天最近”排序，筛选未来 N 天需要提醒的生日
- 通过企业微信群机器人 Webhook 发送提醒

## 目录结构

```
.
├── config.json
├── friends.json
├── index.js
├── lib
│   └── common.js
├── script
│   ├── import-csv.js
│   ├── import-ics.js
│   └── friends.template.csv
├── .env.example
└── README.md
```

## 环境变量

优先级：系统环境变量 `WEBHOOK_KEY` > `.env` > `config.json`。

- 本地开发：复制 `.env.example` 为 `.env`，设置 `WEBHOOK_KEY`。
- GitHub 仓库：在仓库 Secrets/Variables 中设置 `WEBHOOK_KEY`。

`WEBHOOK_KEY` 可填写 **key** 或完整 **webhook URL**。

## 配置

`config.json` 示例：

```json
{
  "webhookKey": "",
  "notifyDays": 7,
  "messageType": "text"
}
```

字段说明：

- `webhookKey`：Webhook key（环境变量优先）
- `notifyDays`：提前提醒天数
- `messageType`：`text` 或 `markdown`

## 朋友生日数据格式

`friends.json` 示例：

```json
[
  {
    "name": "张三",
    "birthday": "1990-05-12",
    "calendar": "solar"
  },
  {
    "name": "李四",
    "birthday": "06-18",
    "calendar": "solar"
  },
  {
    "name": "王五",
    "birthday": "03-05",
    "calendar": "lunar"
  }
]
```

字段说明：

- `name`：姓名
- `birthday`：`YYYY-MM-DD` 或 `MM-DD`
- `calendar`：`solar`(公历) 或 `lunar`(农历)
- `isLeap`：可选，农历闰月为 `true`
- `note`：可选备注

## CSV 模板与导入

模板路径：`script/friends.template.csv`

```csv
name,birthday,calendar,isLeap,note
Alice,1990-05-12,solar,,
Bob,05-12,lunar,false,
"Carol, Chen",1988-11-03,solar,,带逗号名字需加引号
```

导入命令：

```bash
node script/import-csv.js ./friends.csv
node script/import-ics.js ./friends.ics
```

默认规则：

- 优先读取当前目录的 `friends.csv`/`friends.ics`
- 若未找到，会尝试读取 `script/` 目录下的同名文件或第一个 `.csv`/`.ics`

## 运行

```bash
npm install
node index.js
```

## GitHub Actions 定时任务

创建仓库 Secret：`WEBHOOK_KEY`，值为机器人 key 或完整 webhook URL。

工作流已放在 `.github/workflows/birthday-reminder.yml`，默认每天 **UTC 01:00** 执行一次（北京时间 09:00）。\n如果需要修改时间，请编辑 `cron` 表达式。

## 说明

- 农历转换依赖 `solarlunar` 库
- 企业微信机器人文档（需自行访问）：
  - https://developer.work.weixin.qq.com/document/path/99110
