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
    "name": "袁丹杰",
    "birthday": "01-01",
    "calendar": "solar",
    "note": "元旦节"
  },
  {
    "name": "郭春洁",
    "birthday": "01-01",
    "calendar": "lunar",
    "note": "春节"
  },
  {
    "name": "袁骁介",
    "birthday": "01-15",
    "calendar": "lunar",
    "note": "元宵节"
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

工作流已放在 `.github/workflows/birthday-reminder.yml`，默认每天 **UTC 01:00** 执行一次（北京时间 09:00）。
如果需要修改时间，请编辑 `cron` 表达式。

## CNB 云原生构建

项目已提供 `.cnb.yml`，用于在 CNB 平台上按计划执行提醒任务。当前配置包含两种触发方式：

- 定时任务：`crontab: 0 6 * * *`（Asia/Shanghai 06:00）
- 推送触发：`push` 时执行一次

### 使用方式（fork 后配置）

1. Fork 本项目到你的 CNB 账号下。
2. 在 CNB 创建[密钥仓库](https://docs.cnb.cool/zh/repo/secret.html)并配置 `WEBHOOK_KEY`（企业微信机器人key）。
3. 按需修改 `.cnb.yml` 中的构建指令或触发规则：

```yaml
master:
  "crontab: 0 6 * * *":
    - docker:
        image: node:22
      # 引入您自己的秘钥仓库，以读取 $WEBHOOK_KEY 配置参数值
      imports:
        - https://cnb.cool/Airmole/Airmole-Secret-Repos/-/blob/main/work-wechat.yml
      env:
        WEBHOOK_KEY: $WEBHOOK_KEY
      stages:
        - npm install
        - node ./index.js
```

### 常见调整点

- 定时任务时间：修改 `crontab` 表达式（GithubActions使用UTC时间，CNB使用北京时间）。
- Node 版本：修改 `docker.image`（如 `node:22`）。
- 执行命令：修改 `stages` 中的命令顺序或脚本。

> 说明：`.cnb.yml` 里包含 `imports` 引用私有仓库配置读取企业微信消息通知KEY，fork 后请修改为自己的秘钥仓库配置文件链接。

<img width="977" alt="image.png" src="/-/imgs/m0ppeSpOdykQTIDeqyOZpM/11b983c1-c321-4358-a887-c7e1875066ee.png" class="cnb-md-image__upload" />

## 企业微信群机器人创建及KEY获取

<img width="1617" alt="image.png" src="/-/imgs/m0ppeSpOdykQTIDeqyOZpM/33ff91ff-64ee-4a6d-8a9e-b5273af856df.png" class="cnb-md-image__upload" />

`WEBHOOK_KEY` 值只需要填写Webhook地址中send?key=之后的部分。

## 说明

- 农历转换依赖 `solarlunar` 库
- 企业微信机器人文档（需自行访问）：
  - https://developer.work.weixin.qq.com/document/path/99110
