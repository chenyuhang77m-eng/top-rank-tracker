import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const wordcloudDir = path.join(dataDir, "wordclouds");
const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 900_000);
const itemsPerList = Number(process.env.WORDCLOUD_ITEMS_PER_LIST || 20);
const categoryKeys = ["C3", "HOME", "APPL", "BABY", "FOOD", "BEAU", "CLOT", "EDU"];

function loadLocalEnv() {
  for (const file of [path.resolve(rootDir, ".env"), path.resolve(rootDir, "..", ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

loadLocalEnv();

const categoryRules = [
  { key: "EDU", re: /图书|书籍|童书|绘本|纸板书|分级读物|读物|教材|教辅|课本|练习册|习题|试卷|字帖|作文书|课外书|课外阅读|阅读书|名著|小说|文学|漫画|百科|词典|字典|考研书|公考书|真题|四六级|雅思|托福|幼小衔接|识字书|学习方法|小学|初中|高中|一年级|二年级|三年级|四年级|五年级|六年级|学习机|网课|在线教育|培训|考试|资格证/i },
  { key: "FOOD", re: /即食|可食用|冲泡|冲调|饮用|烹饪|佐餐|下饭|代餐|调味|滋补|养生食材|食品|零食|饮料|茶饮|奶茶|咖啡|啤酒|白酒|红酒|葡萄酒|牛奶|酸奶|乳制品|椰子水|果汁|矿泉水|纯净水|苏打水|糕点|点心|饼干|薯片|糖果|巧克力|坚果|肉干|卤味|粮油|方便面|拌面|速食|轻食|熟食|预制菜|火锅底料|生鲜|水果|蔬菜|菌菇|肉|蛋|海鲜|水产|花胶|燕窝|参茸|汤料|粽|粽子|月饼|年货|腊味|食品礼盒|伴手礼|钙片|奶片|益生菌|维生素|蛋白粉|乳清/i },
  { key: "C3", re: /手机|iPhone|苹果|华为|小米|OPPO|vivo|荣耀|平板|iPad|电脑|笔记本|相机|大疆|耳机|蓝牙|充电|数码|芯片|GPU|AI|大模型|DeepSeek|GPT|算力|科技|鸿蒙|硬盘|路由器|智能设备|穿戴|手表|VR/i },
  { key: "HOME", re: /家居|家纺|家具|沙发|床垫|窗帘|地毯|装修|家装|建材|厨房|卫浴|马桶|花洒|洗衣|沐浴|纸巾|湿巾|清洁|拖把|垃圾袋|抽纸|洗衣液|消毒|个护|护理|卫生巾|植物|收纳|插排|插座/i },
  { key: "APPL", re: /家电|空调|冰箱|洗衣机|电视|风扇|微波|烤箱|净化器|加湿器|电饭煲|吸尘器|扫地机|料理机|热水器|电磁炉|油烟机|美的|格力|海尔|TCL|飞利浦|戴森/i },
  { key: "BABY", re: /母婴|宝宝|婴儿|尿不湿|纸尿裤|奶粉|奶瓶|奶嘴|童装|童鞋|儿童|玩具|乐器|益智|文具|早教|学步|安抚|辅食|月子/i },
  { key: "BEAU", re: /面膜|口红|粉底|精华|防晒霜|护肤|美妆|彩妆|香水|美甲|眼影|腮红|护发|染发|脱毛|妆容|睫毛|眉笔|遮瑕|气垫|定妆|卸妆|洗面|爽肤水|乳液|身体乳|唇釉/i },
  { key: "CLOT", re: /内衣|文胸|bra|家居服|睡衣|内裤|袜|T恤|连衣裙|衬衫|外套|风衣|羽绒|针织|短袖|长袖|鞋|帽子|箱包|背包|穿搭|服饰|服装|女装|男装|防晒衣|运动鞋/i }
];

function categoryOf(title = "", listName = "") {
  const text = `${listName} ${title}`;
  return categoryRules.find((rule) => rule.re.test(text))?.key || null;
}

function metricValue(metric = "") {
  const match = String(metric).replace(/[, ]/g, "").match(/([\d.]+)\s*(亿|万|w|W|k|K)?/);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]);
  if (match[2] === "亿") return value * 1e8;
  if (match[2] === "万" || match[2] === "w" || match[2] === "W") return value * 1e4;
  if (match[2] === "k" || match[2] === "K") return value * 1e3;
  return value;
}

function compactLatest(latest) {
  return {
    date: latest.date,
    lists: (latest.lists || []).map((list) => ({
      category: list.category,
      sourceName: list.sourceName,
      listName: list.listName,
      items: (list.items || []).slice(0, itemsPerList).map((item) => ({
        rank: item.rank,
        title: item.title,
        metric: item.metric,
        categoryKey: categoryOf(item.title, list.listName)
      }))
    }))
  };
}

function prompt() {
  return [
    "你是中文消费趋势词云分析师。只根据输入榜单标题生成 JSON，不要 Markdown。",
    "输出结构: {\"wordClouds\":{\"topic\":[],\"product\":[],\"category\":{\"C3\":[],\"HOME\":[],\"APPL\":[],\"BABY\":[],\"FOOD\":[],\"BEAU\":[],\"CLOT\":[],\"EDU\":[]}}}",
    "每个词条格式: {\"word\":\"词\",\"weight\":1-100,\"type\":\"topic/product/brand/selling/category\"}。",
    "topic 从 hot-search 榜单提炼 30-50 个词；product 从 shopping 榜单提炼 30-50 个词。",
    "每个 category 数组输出 8-20 个词。没有强信号时也要根据对应 categoryKey 和标题提炼，不允许空数组。",
    "优先中文短语、品牌名、品类词、卖点词，合并近义重复；不要输出价格、单位、排名、平台通用词。",
    "图书、童书、绘本、教材、教辅、小说、百科、分级阅读、幼小衔接等全部归 EDU，即使标题含儿童、宝宝。"
  ].join("\n");
}

function getLlmConfig() {
  const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
  const model = process.env.VOLCENGINE_MODEL || process.env.ARK_MODEL;
  if (!apiKey || !model) throw new Error("VOLCENGINE_API_KEY/ARK_API_KEY or VOLCENGINE_MODEL/ARK_MODEL is not set.");
  const baseUrl = (process.env.VOLCENGINE_BASE_URL || process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");
  return { apiKey, baseUrl, model };
}

function httpsPostJson(url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (error) { return reject(error); }
    const payload = JSON.stringify(body);
    const client = u.protocol === "http:" ? http : https;
    const req = client.request({
      method: "POST",
      hostname: u.hostname,
      port: u.port || (u.protocol === "http:" ? 80 : 443),
      path: `${u.pathname}${u.search}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Connection: "close",
        ...headers
      },
      timeout: timeoutMs
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        text: async () => Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.on("timeout", () => req.destroy(new Error(`Request timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function extractJsonText(text = "") {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed;
}

async function callLLM(input) {
  const { apiKey, baseUrl, model } = getLlmConfig();
  const res = await httpsPostJson(`${baseUrl}/chat/completions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      model,
      messages: [
        { role: "system", content: prompt() },
        { role: "user", content: JSON.stringify(input) }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }
  });
  const bodyText = await res.text();
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${bodyText}`);
  const response = JSON.parse(bodyText);
  const outputText = response.choices?.[0]?.message?.content || "";
  if (!outputText) throw new Error("LLM API returned no output text");
  return { model, content: JSON.parse(extractJsonText(outputText)) };
}

function normalizeItem(item, fallbackType) {
  const word = String(item?.word || item?.name || "").trim();
  const weight = Math.max(1, Math.min(100, Number(item?.weight || item?.value || 10)));
  if (!word) return null;
  return { word, weight, type: String(item?.type || fallbackType) };
}

function normalizeClouds(content) {
  const source = content?.wordClouds || content;
  const category = {};
  for (const key of categoryKeys) {
    category[key] = (Array.isArray(source?.category?.[key]) ? source.category[key] : [])
      .map((item) => normalizeItem(item, "category"))
      .filter(Boolean)
      .slice(0, 60);
  }
  return {
    topic: (Array.isArray(source?.topic) ? source.topic : []).map((item) => normalizeItem(item, "topic")).filter(Boolean).slice(0, 80),
    product: (Array.isArray(source?.product) ? source.product : []).map((item) => normalizeItem(item, "product")).filter(Boolean).slice(0, 80),
    category
  };
}

function validateClouds(clouds) {
  if (!clouds.topic.length || !clouds.product.length) return false;
  return categoryKeys.every((key) => Array.isArray(clouds.category[key]) && clouds.category[key].length > 0);
}

const stopWords = new Set([
  "热搜", "热销", "榜", "京东", "抖音", "微博", "百度", "夸克", "搜索", "官方", "旗舰店", "自营", "正品",
  "包邮", "活动", "优惠", "新款", "原价", "券后", "到手", "规格", "无规格", "预订", "赠品", "福利",
  "商城", "物流", "直发", "次日达", "全套", "单册", "新版", "现货", "拍下", "领取", "立即"
]);

function fallbackTerms(titles, type, limit) {
  const scores = new Map();
  for (const { title, weight = 1 } of titles) {
    const chunks = String(title || "").match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) || [];
    for (const chunk of chunks) {
      const clean = chunk.replace(/\d+(?:g|kg|ml|L|元|只|件|本|册)?/gi, "");
      for (let size of [4, 3, 2]) {
        for (let i = 0; i <= clean.length - size; i += 1) {
          const word = clean.slice(i, i + size);
          if (stopWords.has(word) || /^[A-Za-z0-9]+$/.test(word)) continue;
          scores.set(word, (scores.get(word) || 0) + weight);
        }
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word], index) => ({ word, weight: Math.max(10, 100 - index * 3), type }));
}

function fallbackClouds(input) {
  const hotTitles = [];
  const shopTitles = [];
  const byCategory = Object.fromEntries(categoryKeys.map((key) => [key, []]));

  for (const list of input.lists) {
    for (const item of list.items) {
      const row = { title: item.title, weight: Math.max(metricValue(item.metric), 10_000) };
      if (list.category === "hot-search") hotTitles.push(row);
      if (list.category === "shopping") shopTitles.push(row);
      if (item.categoryKey && byCategory[item.categoryKey]) byCategory[item.categoryKey].push(row);
    }
  }

  const category = {};
  for (const key of categoryKeys) {
    category[key] = fallbackTerms(byCategory[key], "category", 20);
    if (!category[key].length) category[key] = [{ word: key, weight: 10, type: "category" }];
  }
  return {
    topic: fallbackTerms(hotTitles, "topic", 50),
    product: fallbackTerms(shopTitles, "product", 50),
    category
  };
}

async function main() {
  const latestPath = path.join(dataDir, "latest.json");
  if (!existsSync(latestPath)) throw new Error("data/latest.json does not exist. Run npm run crawl first.");
  await fs.mkdir(wordcloudDir, { recursive: true });

  const latest = JSON.parse(await fs.readFile(latestPath, "utf8"));
  const input = compactLatest(latest);
  let model = "fallback";
  let wordCloudSource = "fallback";
  let fallbackReason = "";
  let wordClouds;

  try {
    const llm = await callLLM(input);
    const normalized = normalizeClouds(llm.content);
    if (!validateClouds(normalized)) throw new Error("LLM returned empty word cloud arrays.");
    model = llm.model;
    wordCloudSource = "llm";
    wordClouds = normalized;
  } catch (error) {
    fallbackReason = error.message;
    wordClouds = fallbackClouds(input);
  }

  const output = {
    date: latest.date,
    capturedAt: latest.capturedAt,
    sourceData: "data/latest.json",
    model,
    generatedAt: new Date().toISOString(),
    wordCloudSource,
    ...(fallbackReason ? { fallbackReason } : {}),
    wordClouds
  };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await fs.writeFile(path.join(wordcloudDir, `${latest.date}.json`), json, "utf8");
  await fs.writeFile(path.join(wordcloudDir, "latest.json"), json, "utf8");
  console.log(`Wrote word clouds for ${latest.date} with ${wordCloudSource}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
