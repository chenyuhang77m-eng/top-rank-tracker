# GitHub Actions 每日榜单抓取工作流搭建指南

这份文档说明如何搭建一个公开 GitHub 仓库，每天自动抓取网页榜单数据，并把历史数据持续保存成 JSON 文件，供 AI、程序或数据分析工具读取。

## 目标效果

搭建完成后，系统会每天自动完成：

1. 定时访问目标榜单页面。
2. 抓取指定榜单的 Top 30。
3. 保存当天数据到 `data/YYYY-MM-DD.json`。
4. 更新最新数据文件 `data/latest.json`。
5. 更新全量历史文件 `data/all.json`。
6. 更新日期索引文件 `data/index.json`。
7. 自动提交并推送到 GitHub 仓库。

最终，别人或其他 AI 可以通过 raw 链接读取数据，例如：

```text
https://raw.githubusercontent.com/<用户名>/<仓库名>/main/data/all.json
```

## 仓库结构

推荐结构如下：

```text
top-rank-tracker/
  .github/
    workflows/
      daily-crawl.yml
  data/
    YYYY-MM-DD.json
    latest.json
    all.json
    index.json
  scripts/
    crawl.mjs
  package.json
  README.md
```

各文件作用：

- `.github/workflows/daily-crawl.yml`：GitHub Actions 自动化配置，负责定时运行。
- `scripts/crawl.mjs`：真正的抓取脚本，负责抓哪些网页、哪些榜单、怎么解析数据。
- `package.json`：定义运行命令，例如 `npm run crawl:daily`。
- `data/YYYY-MM-DD.json`：某一天的完整抓取结果。
- `data/latest.json`：最近一次抓取结果。
- `data/all.json`：所有日期数据的聚合文件。
- `data/index.json`：所有已抓取日期和每日文件链接。

## 第一步：创建公开 GitHub 仓库

在 GitHub 新建一个公开仓库，例如：

```text
top-rank-tracker
```

建议创建空仓库，不勾选 README、`.gitignore` 或 License，后续直接把本地项目推上去。

## 第二步：准备 Node.js 项目

`package.json` 示例：

```json
{
  "name": "top-rank-tracker",
  "version": "1.0.0",
  "private": false,
  "type": "module",
  "scripts": {
    "crawl": "node scripts/crawl.mjs",
    "crawl:daily": "node scripts/crawl.mjs --skip-if-exists"
  },
  "engines": {
    "node": ">=20"
  }
}
```

建议提供两个命令：

- `npm run crawl`：强制抓取当天数据，适合人工补抓。
- `npm run crawl:daily`：定时任务使用。如果当天数据已经存在，就跳过，避免重复覆盖。

## 第三步：配置抓取目标

抓取目标放在 `scripts/crawl.mjs` 中，例如：

```js
const sources = [
  {
    category: "hot-search",
    categoryName: "热搜榜",
    url: "https://tophub.today/c/news?q=%E7%83%AD%E6%90%9C",
    selectedNodeIds: ["1", "2", "140", "38", "69"]
  },
  {
    category: "shopping",
    categoryName: "热销榜",
    url: "https://tophub.today/c/shopping",
    selectedNodeIds: ["5666", "5667", "26696"]
  },
  {
    category: "shopping",
    categoryName: "热销榜",
    url: "https://tophub.today/c/shopping?q=%E4%BA%AC%E4%B8%9C",
    selectedNodeIds: ["4598"]
  },
  {
    category: "shopping",
    categoryName: "热销榜",
    url: "https://tophub.today/c/shopping?q=%E5%BF%AB%E6%89%8B",
    selectedNodeIds: ["36116"]
  }
];
```

这里有两个概念：

- `url`：要访问的榜单页面。
- `selectedNodeIds`：页面中要抓取的具体榜单节点。

GitHub Actions 不关心具体抓哪个网页，它只负责运行命令。具体抓取逻辑必须写在脚本里。

如果需要排除某类内容，可以在脚本里增加过滤规则。例如当前项目对热搜榜设置了时事、政治、经济、军事、新闻类关键词过滤：先读取榜单里的更多候选项，过滤掉命中的条目，再向后顺延补齐到 30 条。建议保留来源原始排名，方便回溯它在原榜里的真实位置。

当前项目的主抓取链路是 Codex worktree 自动化，每天北京时间 09:30 检查并补抓；GitHub Actions 保留为下午备用触发。

## 第四步：配置 GitHub Actions

创建 `.github/workflows/daily-crawl.yml`：

```yaml
name: Daily Tophub Crawl

on:
  schedule:
    - cron: "7 7 * * *"
    - cron: "37 7 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  crawl:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Crawl top lists
        run: npm run crawl:daily

      - name: Commit data
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: update daily rank data"
          file_pattern: data/*.json
```

GitHub Actions 的 cron 使用 UTC 时间。北京时间是 UTC+8，所以：

- `7 7 * * *` = 北京时间 15:07
- `37 7 * * *` = 北京时间 15:37

设置多个时间点是为了兜底。GitHub 的定时任务不保证准点触发，整点或高峰期可能延迟甚至漏触发。如果有 Codex worktree 等更稳定的上午任务，可以把 GitHub Actions 放到下午作为备用触发。

`workflow_dispatch` 表示允许手动运行。可以在 GitHub 仓库的 Actions 页面点击 `Run workflow` 手动触发。

## 第五步：自动提交数据

工作流里的这一步负责自动提交数据：

```yaml
- name: Commit data
  uses: stefanzweifel/git-auto-commit-action@v5
  with:
    commit_message: "chore: update daily rank data"
    file_pattern: data/*.json
```

如果抓取后 `data/*.json` 有变化，它会自动生成一次 commit。

如果当天数据已经存在，`npm run crawl:daily` 会跳过抓取，文件不变，也就不会产生重复提交。

## 第六步：推送到 GitHub

本地初始化并推送：

```bash
git init -b main
git add .
git commit -m "Initial daily rank tracker"
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

推送后，GitHub 会自动识别 `.github/workflows/daily-crawl.yml`。

## 第七步：查看运行状态

进入仓库的 `Actions` 页面，找到工作流：

```text
Daily Tophub Crawl
```

可以查看：

- 是否触发
- 是否成功
- 日志输出
- 是否生成自动提交

如果是新仓库，第一次可能需要在 Actions 页面启用 workflow。

## 数据如何给 AI 读取

推荐给 AI 的链接：

```text
https://raw.githubusercontent.com/<用户名>/<仓库名>/main/data/all.json
```

这个文件包含所有已抓取日期的数据，适合做历史趋势分析。

也可以提供日期索引：

```text
https://raw.githubusercontent.com/<用户名>/<仓库名>/main/data/index.json
```

常见用法：

- 读取 `all.json`：分析所有日期数据。
- 读取 `latest.json`：只分析最近一次数据。
- 读取 `YYYY-MM-DD.json`：只分析某一天数据。

## 数据追溯方式

`data/all.json` 支持以下维度：

- 按日期：筛选 `snapshot.date`
- 按榜单：筛选 `sourceName + listName`
- 按类别：筛选 `categoryName`
- 按排名：筛选 `items.rank`
- 跨日期趋势：比较不同日期同一榜单里的条目变化

## 兜底机制建议

推荐至少做两层兜底：

1. 主链路使用 Codex worktree 或其他云端自动化在上午固定时间检查并补抓。
2. 脚本使用 `--skip-if-exists`，当天数据存在就跳过，避免重复覆盖。
3. GitHub Actions 放在下午作为备用触发，例如 15:07、15:37。

如果有额外的云端自动化系统，也可以再加一层检查：

1. 每天稍晚检查 `data/index.json` 是否包含当天日期。
2. 如果缺失，运行 `npm run crawl`。
3. 提交并推送数据。

## 常见问题

### 为什么 GitHub Actions 没有准点运行？

GitHub 的 schedule 不是精确闹钟。它可能延迟，也可能在高峰期漏触发。建议避开整点，并设置多个兜底触发点。

### 为什么工作流里看不到抓哪个网页？

工作流只负责运行命令。抓取网页、榜单节点、解析规则都在 `scripts/crawl.mjs` 里。

### 电脑关机还能运行吗？

GitHub Actions 跑在 GitHub 云端，不需要电脑开机。

### 公开仓库要不要付费？

公开仓库使用 GitHub 托管 runner 通常免费。这个任务每天只运行几次，每次几十秒以内，资源消耗很低。

### 如果目标网页结构变化怎么办？

需要维护 `scripts/crawl.mjs` 的解析逻辑或更新节点 ID。建议定期检查 Actions 日志和数据文件是否正常更新。

### raw 链接为什么刚推送后还是旧数据？

`raw.githubusercontent.com` 可能有短时间缓存。通常等待几分钟后刷新即可。

## 当前项目示例

本项目的全量数据链接：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/all.json
```

日期索引链接：

```text
https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/index.json
```

GitHub Actions 配置：

```text
.github/workflows/daily-crawl.yml
```

抓取脚本：

```text
scripts/crawl.mjs
```
