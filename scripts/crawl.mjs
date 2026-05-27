import dns from "node:dns";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const sources = [
  {
    category: "hot-search",
    categoryName: "热搜榜",
    url: "https://tophub.today/c/news?q=%E7%83%AD%E6%90%9C",
    selectedNodeIds: ["223", "1", "2", "140", "69"]
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
  },
  {
    category: "shopping",
    categoryName: "热销榜",
    url: "https://tophub.today/n/x9ozr11oXb",
    singleNodeId: "36108",
    sourceName: "京东",
    listName: "图书 ‧ 热销榜"
  }
];

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const TOP_ITEM_LIMIT = 30;

// 黑名单策略：过滤"时政外交/军事/灾难事故/犯罪案件/疫情医疗负面"等不适合做营销话题的硬新闻，
// 但保留明星娱乐、影视综艺、品类商业等可被品牌借势的热点。
// 命中即丢弃，selectHotSearchItems 会基于过滤后的剩余条目顺延补齐到 TOP_ITEM_LIMIT 条。
const hotSearchExcludedKeywordGroups = [
  // 1. 党政机关 / 官方机构
  ["外交部", "国防部", "商务部", "白宫", "国会", "国务院", "联合国", "人民日报", "新华社", "央视", "网警", "公安", "市委", "省委", "中央", "市长", "书记", "纪委", "政府"],
  // 2. 中外关系 / 制裁博弈
  ["中方", "美方", "中美", "对华", "对台", "制裁", "关税", "大使馆", "领事馆", "外交", "外交官", "驻华", "驻美"],
  // 3. 政要职位 / 选举
  ["总统", "首相", "总理", "外长", "防长", "议员", "内阁", "大选", "选举", "执政党", "在野党"],
  // 4. 具名政要 / 情报
  ["特朗普", "拜登", "普京", "泽连斯基", "马克龙", "石破茂", "尹锡悦", "李在明", "武契奇", "金正恩", "内塔尼亚胡", "间谍", "策反", "暗杀"],
  // 5. 涉台 / 涉港 / 涉疆 / 涉藏 等敏感地缘
  ["台海", "台湾问题", "台独", "两岸", "南海", "钓鱼岛", "藏独", "疆独", "港独"],
  // 6. 军事 / 武装冲突
  ["军事", "军演", "军舰", "军机", "战机", "导弹", "航母", "核武", "防空", "空袭", "开火", "交火", "占领"],
  // 7. 战争 / 国际冲突
  ["俄乌", "乌克兰", "俄罗斯", "以色列", "伊朗", "加沙", "巴以", "哈马斯", "朝鲜", "叙利亚", "黎巴嫩", "也门"],
  // 8. 灾难 / 事故（自然灾害 + 安全事故 + 伤亡）
  ["山洪", "洪水", "暴雨", "暴雪", "台风", "地震", "海啸", "泥石流", "灾害", "防汛", "抗灾", "爆炸", "煤矿", "矿难", "塌陷", "倒塌", "火灾", "起火", "失火", "燃爆", "坠机", "空难", "沉船", "翻车", "车祸", "事故", "失联", "被困", "救援", "搜救", "遇难", "伤亡", "死亡", "罹难"],
  // 9. 犯罪 / 案件 / 司法
  ["凶案", "命案", "凶手", "杀人", "杀害", "刺死", "刺伤", "袭击", "抢劫", "盗窃", "强奸", "猥亵", "拐卖", "绑架", "诈骗", "贩毒", "吸毒", "刑拘", "逮捕", "判刑", "判决", "起诉", "庭审", "审判", "犯罪", "违法", "案件", "警方", "辱骂", "斗殴", "施暴", "家暴"],
  // 10. 疫情 / 医疗负面
  ["疫情", "确诊", "病毒", "感染", "中毒", "癌症", "罹患", "去世", "逝世", "病逝", "讣告", "猝死", "自杀", "跳楼"],
  // 11. 时政话题（原 additional）
  ["时事", "时政", "政治", "政务", "新闻联播", "时评"],
  // 12. 宏观经济 / 金融市场（原 additional）
  ["经济", "财经", "金融", "股市", "股票", "证券", "基金", "债券", "A股", "港股", "美股", "央行", "汇率", "降息", "加息", "GDP", "CPI", "楼市", "房价", "房地产"]
];

const hotSearchExcludedKeywords = hotSearchExcludedKeywordGroups.flat();
// 保留入口以便后续追加单点关键词；当前所有词已整合进 groups。
const additionalHotSearchExcludedKeywords = [];

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(value.replace(/<[^>]+>/g, ""));
}

function absoluteUrl(href) {
  if (!href) return "";
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `https://tophub.today${href}`;
  return href;
}

async function fetchHtml(url, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(
          url,
          {
            headers: {
              "User-Agent": userAgent,
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            timeout: 30000
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`));
              res.resume();
              return;
            }

            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              body += chunk;
            });
            res.on("end", () => resolve(body));
          }
        );

        req.on("timeout", () => req.destroy(new Error(`Timeout fetching ${url}`)));
        req.on("error", reject);
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }

  throw lastError;
}

function getNodeBlocks(html) {
  const blocks = [];
  const marker = /<div class="cc-cd" id="node-(\d+)">/g;
  const matches = [...html.matchAll(marker)];

  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    blocks.push({
      nodeId: matches[i][1],
      html: html.slice(start, end)
    });
  }

  return blocks;
}

function parseCardMeta(block) {
  const sourceMatch = block.match(/<div class="cc-cd-lb">[\s\S]*?>\s*([\s\S]*?)<\/div>/);
  const listMatch = block.match(/<span class="cc-cd-sb-st">\s*([\s\S]*?)\s*<\/span>/);

  return {
    sourceName: stripTags(sourceMatch?.[1] ?? ""),
    listName: stripTags(listMatch?.[1] ?? "")
  };
}

function parseNewsItems(block) {
  const items = [];
  const itemPattern =
    /<a\s+href="([^"]+)"[\s\S]*?<div class="cc-cd-cb-ll">([\s\S]*?)<\/div>\s*<\/a>/g;

  for (const match of block.matchAll(itemPattern)) {
    const row = match[2];
    const rank = Number(stripTags(row.match(/<span class="s[^"]*">([\s\S]*?)<\/span>/)?.[1]));
    const title = stripTags(row.match(/<span class="t">([\s\S]*?)<\/span>/)?.[1]);
    const metric = stripTags(row.match(/<span class="e">([\s\S]*?)<\/span>/)?.[1]);

    if (rank && title) {
      items.push({
        rank,
        title,
        metric,
        url: absoluteUrl(decodeHtml(match[1]))
      });
    }
  }

  return items;
}

function isExcludedHotSearchItem(item) {
  const text = `${item.title} ${item.metric}`.toLowerCase();
  return [...hotSearchExcludedKeywords, ...additionalHotSearchExcludedKeywords].some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}

function selectHotSearchItems(items) {
  return items.filter((item) => !isExcludedHotSearchItem(item)).slice(0, TOP_ITEM_LIMIT);
}

function parseShoppingItems(block) {
  const items = [];
  const itemPattern =
    /<div class="sp">[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div class="rank[^"]*">([\s\S]*?)<\/div>[\s\S]*?<div class="tt">([\s\S]*?)<\/div>[\s\S]*?<div class="ss">([\s\S]*?)<\/div>[\s\S]*?<\/a>\s*<\/div>/g;

  for (const match of block.matchAll(itemPattern)) {
    const rank = Number(stripTags(match[2]));
    const title = stripTags(match[3]);
    const metric = stripTags(match[4]);

    if (rank && title) {
      items.push({
        rank,
        title,
        metric,
        url: absoluteUrl(decodeHtml(match[1]))
      });
    }
  }

  if (items.length > 0) {
    return items.slice(0, TOP_ITEM_LIMIT);
  }

  return parseNewsItems(block).slice(0, TOP_ITEM_LIMIT);
}

function parseSingleRankItems(html) {
  const items = [];
  const rowPattern = /<tr>[\s\S]*?<td[^>]*>\s*(\d+)\.\s*<\/td>[\s\S]*?<td class="al"[\s\S]*?<div><a\s+href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a><\/div>[\s\S]*?<\/tr>/g;

  for (const match of html.matchAll(rowPattern)) {
    const rank = Number(stripTags(match[1]));
    const title = stripTags(match[3]);
    if (rank && title) {
      items.push({
        rank,
        title,
        metric: "",
        url: absoluteUrl(decodeHtml(match[2]))
      });
    }
  }

  return items.slice(0, TOP_ITEM_LIMIT);
}

async function crawlSource(source) {
  const html = await fetchHtml(source.url);
  if (source.singleNodeId) {
    const items = source.category === "shopping"
      ? parseSingleRankItems(html)
      : selectHotSearchItems(parseNewsItems(html));

    return [{
      category: source.category,
      categoryName: source.categoryName,
      nodeId: source.singleNodeId,
      sourceName: source.sourceName,
      listName: source.listName,
      itemCount: items.length,
      items
    }];
  }

  const selected = new Set(source.selectedNodeIds);
  const order = new Map(source.selectedNodeIds.map((nodeId, index) => [nodeId, index]));
  const blocks = getNodeBlocks(html)
    .filter((block) => selected.has(block.nodeId))
    .sort((a, b) => order.get(a.nodeId) - order.get(b.nodeId));

  return blocks.map((block) => {
    const meta = parseCardMeta(block.html);
    const items =
      source.category === "shopping"
        ? parseShoppingItems(block.html)
        : selectHotSearchItems(parseNewsItems(block.html));

    return {
      category: source.category,
      categoryName: source.categoryName,
      nodeId: block.nodeId,
      sourceName: meta.sourceName,
      listName: meta.listName,
      itemCount: items.length,
      items
    };
  });
}

function getShanghaiDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    capturedAt: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`
  };
}

async function main() {
  if (!existsSync(dataDir)) {
    await fs.mkdir(dataDir, { recursive: true });
  }

  const { date, capturedAt } = getShanghaiDateParts();
  const dailyFile = path.join(dataDir, `${date}.json`);

  if (process.argv.includes("--skip-if-exists") && existsSync(dailyFile)) {
    console.log(`Data for ${date} already exists. Skipping crawl.`);
    return;
  }

  const lists = (await Promise.all(sources.map(crawlSource))).flat();

  const payload = {
    date,
    capturedAt,
    sourceSite: "https://tophub.today",
    lists
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(dailyFile, json, "utf8");
  await fs.writeFile(path.join(dataDir, "latest.json"), json, "utf8");
  await writeArchiveFiles(capturedAt);

  const totalItems = lists.reduce((sum, list) => sum + list.itemCount, 0);
  console.log(`Captured ${lists.length} lists and ${totalItems} items for ${date}.`);
}

async function writeArchiveFiles(updatedAt) {
  const files = await fs.readdir(dataDir);
  const dailyFiles = files
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort();

  const dates = dailyFiles.map((file) => file.replace(".json", ""));
  const index = {
    updatedAt,
    totalDays: dates.length,
    dates,
    files: dailyFiles.map((file) => ({
      date: file.replace(".json", ""),
      path: `data/${file}`,
      rawUrl: `https://raw.githubusercontent.com/chenyuhang77m-eng/top-rank-tracker/main/data/${file}`
    }))
  };

  await fs.writeFile(path.join(dataDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
