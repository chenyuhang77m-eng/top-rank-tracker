# Top Rank Tracker

每天记录今日热榜两个分类页中重要榜单的 Top 20：

- 热搜榜：https://tophub.today/c/news?q=%E7%83%AD%E6%90%9C
- 热销榜：https://tophub.today/c/shopping

## 默认抓取范围

热搜榜默认选取：

- 微博 / 热搜榜
- 百度 / 实时热点
- 夸克 / 热搜榜
- 搜狗 / 实时热点
- 360搜索 / 实时热点榜单

热销榜默认选取：

- 淘宝・天猫 / 热销总榜
- 淘宝・天猫 / 每日爆款清单
- 今日热卖 / 全网线报聚合
- 防疫商品追踪 / 好价监控
- 当当 / 畅销图书榜

## 数据结构

每日运行后会生成：

- `data/YYYY-MM-DD.json`：当天完整抓取结果
- `data/latest.json`：最近一次抓取结果

每条数据包含榜单分类、榜单来源、榜单名称、排名、标题、热度/销量信息和原始链接。

## 本地运行

```bash
npm run crawl
```

## 自动运行

`.github/workflows/daily-crawl.yml` 已配置 GitHub Actions，每天北京时间 09:10 自动抓取并提交数据。
