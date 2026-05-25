# ◆ Top Rank Tracker

每日自动抓取 TopHub 热搜榜与热销榜数据，记录重点榜单 Top 30，并生成可供 AI、程序或数据分析工具读取的历史 JSON 数据。

完整搭建教程见：[GitHub Actions 每日榜单抓取工作流搭建指南](WORKFLOW_GUIDE.md)

## ▌ 当前状态

- 最新数据日期：以 `data/latest.json` 为准
- 当前已归档日期索引：`data/index.json`
- 每日抓取规模：10 个榜单，每榜 30 条，共 300 条
- 热搜榜会过滤时事、政治、经济、军事、新闻类热点，并向后顺延补齐
- 热销榜不做内容过滤，按来源榜单顺序抓取 Top 30
- 目前还会生成每日 AI 洞察，保存到 `data/insights/`

## ▌ 抓取范围

### ◇ 热搜榜

默认抓取以下 5 个榜单，每个榜单保留 30 条：

- 微博 / 热搜榜
- 百度 / 实时热点
- 夸克 / 热搜榜
- 360搜索 / 实时热点榜单
- 抖音 / 热搜榜

热搜榜过滤规则：

- 跳过时事、政治、经济、军事、新闻类热点
- 如果原榜前 30 中有内容被过滤，会继续向后顺延补齐
- 数据保留来源榜单的原始排名，不重新编号，方便追溯

### ◇ 热销榜

默认抓取以下 5 个榜单，每个榜单保留 30 条：

- 淘宝・天猫 / 热销总榜
- 淘宝・天猫 / 每日爆款清单
- 今日热卖 / 全网线报聚合
- 京东 / 热销总榜
- 快手电商 / 月销热榜

选择逻辑：

- 淘宝、京东总榜必选
- 其余榜单优先选择覆盖面广、更新稳定、公开页面可直接拿到 Top 30 的榜单
- 当当 / 畅销图书榜在 TopHub 公开页面展示条数不足，因此默认不选

## ▌ 数据文件

每日运行后会生成或更新：

- `data/YYYY-MM-DD.json`：某一天的完整抓取结果
- `data/latest.json`：最近一次抓取结果
- `data/index.json`：所有已抓取日期和每日文件链接
- `data/all.json`：所有日期数据的聚合文件，适合让 AI 一次读取历史全量
- `data/insights/YYYY-MM-DD.json`：某一天的 AI 洞察结果
- `data/insights/latest.json`：最近一次 AI 洞察结果

每条榜单数据包含：

- `category` / `categoryName`：榜单分类
- `nodeId`：TopHub 榜单节点 ID
- `sourceName`：榜单来源，例如微博、百度、淘宝、京东
- `listName`：榜单名称
- `itemCount`：实际保存条数
- `items`：榜单条目

每个 `items` 条目包含：

- `rank`：来源榜单原始排名
- `title`：标题
- `metric`：热度、销量或作者等补充信息
- `url`：原始链接

## ▌ 给 AI 读取的链接

全量历史数据：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/all.json
```

日期索引：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/index.json
```

最新抓取数据：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/latest.json
```

最新 AI 洞察：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/insights/latest.json
```

也可以按日期读取：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/YYYY-MM-DD.json
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/insights/YYYY-MM-DD.json
```

## ▌ 本地运行

强制抓取当天数据：

```bash
npm run crawl
```

定时任务使用的抓取命令：

```bash
npm run crawl:daily
```

如果当天数据已经存在，`crawl:daily` 会跳过抓取，避免重复覆盖。

只生成 AI 洞察：

```bash
npm run insights
```

完整每日流程：

```bash
npm run daily
```

`daily` 会先执行 `crawl:daily`，再执行 `insights`。

## ▌ 自动运行

主链路使用 Codex worktree 自动化，每天北京时间 09:25 检查并补抓。

GitHub Actions 也保留自动任务，配置文件在：

```text
.github/workflows/daily-crawl.yml
```

当前 GitHub Actions 执行：

```bash
npm run daily
```

也就是：

1. 检查当天数据是否存在
2. 缺失时抓取榜单数据
3. 生成 AI 洞察
4. 将 `data/*.json` 和 `data/insights/*.json` 自动提交回仓库

AI 洞察依赖火山方舟 / Ark 兼容接口，需要在 GitHub Secrets 或 Variables 中配置相关模型参数。当前工作流支持：

- `VOLCENGINE_API_KEY` 或 `ARK_API_KEY`
- `VOLCENGINE_BASE_URL` 或 `ARK_BASE_URL`
- `VOLCENGINE_MODEL` 或 `ARK_MODEL`

## ▌ 重要说明

- GitHub Actions 的 `schedule` 事件不保证准点触发，可能延迟。
- `raw.githubusercontent.com` 可能有短缓存，刚推送后如果看到旧数据，可以稍等几分钟再刷新。
- 热搜过滤使用关键词规则，适合日常自动归档，但不是严格新闻分类模型。
- 如果 TopHub 页面结构变化，可能需要维护 `scripts/crawl.mjs` 的解析逻辑。
