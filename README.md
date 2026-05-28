# Top Rank Tracker

这是 `AI 热点捕手` 的数据源仓库，负责每天抓取热搜榜、热销榜，生成结构化 JSON、AI 洞察和词云数据。前端仓库 `ai-trend-hunter` 会直接读取这里的静态数据来渲染网页。

在线数据地址：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/latest.json
```

## 数据内容

当前每日数据包含三类：

- 榜单原始数据：`data/YYYY-MM-DD.json`、`data/latest.json`
- AI 洞察：`data/insights/YYYY-MM-DD.json`、`data/insights/latest.json`
- 词云：`data/wordclouds/YYYY-MM-DD.json`、`data/wordclouds/latest.json`

日期索引保存在：

```text
data/index.json
```

网页本身不会每天生成一份快照，留存的是每天的数据文件。前端可以读取历史日期数据进行回看。

## 榜单范围

热搜榜目前抓取 5 个来源：

- 抖音热搜
- 微博热搜
- 百度实时热点
- 夸克热搜
- 360 搜索实时热点

热销榜目前抓取 6 个来源：

- 淘宝天猫热销总榜
- 淘宝天猫每日爆款清单
- 今日热卖聚合榜
- 京东热销总榜
- 快手电商热销榜
- 京东图书热销榜

图书榜单来自 TopHub：

```text
https://tophub.today/n/x9ozr11oXb
```

图书、童书、绘本、教材、教辅、分级阅读等统一归入 `平台/教育` 类目下的教育侧。

## 类目体系

数据会按 8 个一级类目进行归类：

- 3C 数码
- 家居家装
- 家用电器
- 母婴亲子
- 食品饮料
- 美妆护肤
- 服饰穿戴
- 平台/教育

`平台/教育` 是一个合并展示类目，内部按两类信号理解：

- 平台侧：外卖、本地生活、团购、滴滴/打车、酒旅、二手回收、电商平台等
- 教育侧：图书、童书、绘本、教材、教辅、考试备考、学习工具等

在 AI 洞察输入中，`平台/教育` 的信号会尽量标记为：

- `platform`
- `education`

这样 LLM 在生成二级类目时，可以把平台行业和教育行业分开，不把二者混成一个二级类目。

## AI 洞察

洞察脚本：

```text
scripts/generate-insights.mjs
```

输出位置：

```text
data/insights/latest.json
data/insights/YYYY-MM-DD.json
```

洞察的核心逻辑：

- 每个一级类目由 LLM 根据当天真实数据生成 3-5 个二级类目
- 优先使用热搜信号判断当天用户关注点
- 热销榜只作为商品、卖点和转化参考，不直接把长 SKU 当作热点
- 如果 LLM 生成不足 3 个有效二级类目，则使用固定二级类目池兜底
- 策略文案只保留内容策略，不再输出固定投放尾句

## 词云

词云脚本：

```text
scripts/generate-wordclouds.mjs
```

输出位置：

```text
data/wordclouds/latest.json
data/wordclouds/YYYY-MM-DD.json
```

词云规则：

- `topic`：只来自热搜榜
- `product`：只来自热销榜
- `topicCategory`：按类目拆分的热搜词云
- `productCategory`：按类目拆分的热销词云
- 热搜词云和热销词云严格分开，不跨来源补词
- 每个词条会尽量附带来源标题，供前端悬停展示
- LLM 词条优先控制在 2-6 个中文字符，避免长 SKU 或整句标题进入词云
- 如果 LLM 不可用或返回空数组，会使用规则兜底生成非空词云

## 本地运行

强制抓取并覆盖当天数据：

```bash
npm run crawl:force
```

只生成 AI 洞察：

```bash
npm run insights
```

只生成词云：

```bash
npm run wordclouds
```

完整每日流程：

```bash
npm run daily
```

`daily` 会依次执行：

```text
crawl:force -> insights -> wordclouds
```

## GitHub Actions

自动任务配置在：

```text
.github/workflows/daily-crawl.yml
```

当前 workflow 会：

1. 抓取最新榜单
2. 生成 AI 洞察
3. 生成词云
4. 提交更新后的 `data/*.json`、`data/insights/*.json` 和 `data/wordclouds/*.json`

AI 生成依赖火山方舟 / Ark 兼容接口，需要配置：

- `VOLCENGINE_API_KEY` 或 `ARK_API_KEY`
- `VOLCENGINE_BASE_URL` 或 `ARK_BASE_URL`
- `VOLCENGINE_MODEL` 或 `ARK_MODEL`

## 给前端读取的主要入口

最新榜单：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/latest.json
```

最新洞察：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/insights/latest.json
```

最新词云：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/wordclouds/latest.json
```

日期索引：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/index.json
```

## 注意事项

- GitHub Actions 的定时任务可能会延迟触发，不保证精确到分钟
- `raw.githubusercontent.com` 有短暂缓存，刚推送后可能需要等待几分钟
- 分类规则是规则词典和 LLM 洞察结合，不是严格行业分类模型
- 如果 TopHub 页面结构变化，可能需要维护 `scripts/crawl.mjs`
