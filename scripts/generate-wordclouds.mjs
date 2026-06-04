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

const eduEducationRe = /图书|书籍|童书|绘本|纸板书|分级读物|读物|教材|教辅|课本|练习册|习题|试卷|字帖|作文书|课外书|课外阅读|阅读书|名著|小说|文学|漫画|百科|词典|字典|考研书|公考书|真题|四六级|雅思|托福|幼小衔接|识字书|学习方法|小学|初中|高中|一年级|二年级|三年级|四年级|五年级|六年级|学习机|网课|在线教育|培训|考试|资格证/i;
const eduPlatformRe = /京东|阿里巴巴|淘宝|天猫|拼多多|多多买菜|美团|饿了么|大众点评|滴滴|高德|携程|去哪儿|飞猪|同程|马蜂窝|Boss直聘|贝壳找房|链家|闲鱼|转转|爱回收|多抓鱼|本地生活|外卖|打车|出行|二手|回收|旅游|酒店|机票|景区门票|跟团游|自由行|团购|租房|长租公寓|平台经济|平台抽佣|平台补贴|抖音电商|抖音小店|快手电商|快手小店|小红书电商/i;

const categoryRules = [
  { key: "EDU", re: new RegExp(`${eduEducationRe.source}|${eduPlatformRe.source}`, "i") },
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
  if (/图书|书籍|教材|教辅|教育|学习|考试|培训|阅读/i.test(listName) && eduEducationRe.test(text)) return "EDU";
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
    "输出结构: {\"wordClouds\":{\"topic\":[],\"product\":[],\"topicCategory\":{\"C3\":[],\"HOME\":[],\"APPL\":[],\"BABY\":[],\"FOOD\":[],\"BEAU\":[],\"CLOT\":[],\"EDU\":[]},\"productCategory\":{\"C3\":[],\"HOME\":[],\"APPL\":[],\"BABY\":[],\"FOOD\":[],\"BEAU\":[],\"CLOT\":[],\"EDU\":[]}}}",
    "每个词条格式: {\"word\":\"词\",\"weight\":1-100,\"type\":\"topic/product/brand/selling/category\"}。",
    "word 必须短，中文词优先 2-6 个字；英文品牌名可略长。不要输出整句标题、长 SKU、长卖点句或超过 8 个中文字符的短语。",
    "topic 从 hot-search 榜单提炼 30-50 个词；product 从 shopping 榜单提炼 30-50 个词。",
    "topicCategory 只能从 hot-search 中对应 categoryKey 的标题提炼；productCategory 只能从 shopping 中对应 categoryKey 的标题提炼。",
    "每个 topicCategory/productCategory 数组有对应标题时输出 8-20 个词；没有对应标题时返回空数组，不要跨来源或跨类目补词。",
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

function shortenWord(value) {
  const raw = String(value || "")
    .replace(/[【】\[\]（）()《》"'“”‘’]/g, "")
    .replace(/(?:原价|券后|到手价|售价|补贴价)?\s*[¥￥]?\d+(?:\.\d+)?\s*(?:元|块|折)?/gi, "")
    .replace(/\d+(?:\.\d+)?\s*(?:g|kg|ml|l|L|斤|克|片|粒|包|盒|瓶|袋|本|册|只|件|双|条|台|支|罐|抽|卷|对)(?:\s*[x×*]\s*\d+)?/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!raw) return "";
  const cjkChars = raw.match(/[\u4e00-\u9fa5]/g) || [];
  if (cjkChars.length >= 2 && cjkChars.length <= 8 && raw.length <= 18) return raw;
  const parts = raw.split(/[，,、/｜|·:：\-_\s]+/).filter(Boolean);
  const candidate = parts.find((part) => {
    const count = (part.match(/[\u4e00-\u9fa5]/g) || []).length;
    return count >= 2 && count <= 8 && part.length <= 18;
  });
  if (candidate) return candidate;
  return "";
}

function normalizeItem(item, fallbackType) {
  const word = cleanCandidateTerm(item?.word || item?.name);
  const weight = Math.max(1, Math.min(100, Number(item?.weight || item?.value || 10)));
  if (!word) return null;
  return { word, weight, type: String(item?.type || fallbackType) };
}

function normalizeClouds(content) {
  const source = content?.wordClouds || content;
  const topicCategory = {};
  const productCategory = {};
  for (const key of categoryKeys) {
    topicCategory[key] = (Array.isArray(source?.topicCategory?.[key]) ? source.topicCategory[key] : Array.isArray(source?.category?.[key]) ? source.category[key] : [])
      .map((item) => normalizeItem(item, "topic"))
      .filter(Boolean)
      .slice(0, 60);
    productCategory[key] = (Array.isArray(source?.productCategory?.[key]) ? source.productCategory[key] : Array.isArray(source?.category?.[key]) ? source.category[key] : [])
      .map((item) => normalizeItem(item, "category"))
      .filter(Boolean)
      .slice(0, 60);
  }
  return {
    topic: (Array.isArray(source?.topic) ? source.topic : []).map((item) => normalizeItem(item, "topic")).filter(Boolean).slice(0, 80),
    product: (Array.isArray(source?.product) ? source.product : []).map((item) => normalizeItem(item, "product")).filter(Boolean).slice(0, 80),
    topicCategory,
    productCategory
  };
}

function validateClouds(clouds, input) {
  if (!clouds.topic.length || !clouds.product.length) return false;
  return categoryKeys.every((key) => {
    const hasTopicRows = rowsForScope(input, "hot-search", key).length > 0;
    const hasProductRows = rowsForScope(input, "shopping", key).length > 0;
    return (!hasTopicRows || (Array.isArray(clouds.topicCategory[key]) && clouds.topicCategory[key].length > 0)) &&
      (!hasProductRows || (Array.isArray(clouds.productCategory[key]) && clouds.productCategory[key].length > 0));
  });
}

function rowsForScope(input, listCategory, categoryKey = null) {
  const rows = [];
  for (const list of input.lists) {
    if (list.category !== listCategory) continue;
    for (const item of list.items) {
      if (categoryKey && item.categoryKey !== categoryKey) continue;
      rows.push({
        sourceName: list.sourceName,
        listName: list.listName,
        title: item.title,
        weight: Math.max(metricValue(item.metric), 10_000)
      });
    }
  }
  return rows;
}

function attachSources(items, rows) {
  return items.map((item) => {
    const word = item.word || "";
    const matched = rows
      .filter((row) => word && row.title?.includes(word))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map(({ sourceName, listName, title }) => ({ sourceName, listName, title }));
    return { ...item, sources: matched };
  }).filter((item) => item.sources.length);
}

function attachCloudSources(clouds, input) {
  const topicRows = rowsForScope(input, "hot-search");
  const productRows = rowsForScope(input, "shopping");
  const topicCategory = {};
  const productCategory = {};
  for (const key of categoryKeys) {
    topicCategory[key] = attachSources(clouds.topicCategory[key] || [], rowsForScope(input, "hot-search", key));
    productCategory[key] = attachSources(clouds.productCategory[key] || [], rowsForScope(input, "shopping", key));
  }
  return {
    topic: attachSources(clouds.topic || [], topicRows),
    product: attachSources(clouds.product || [], productRows),
    topicCategory,
    productCategory
  };
}

const stopWords = new Set([
  "热搜", "热销", "榜", "京东", "抖音", "微博", "百度", "夸克", "搜索", "官方", "旗舰店", "自营", "正品",
  "包邮", "活动", "优惠", "新款", "原价", "券后", "到手", "规格", "无规格", "预订", "赠品", "福利",
  "商城", "物流", "直发", "次日达", "全套", "单册", "新版", "现货", "拍下", "领取", "立即"
]);
const curatedTerms = [
  "外卖", "订书钉", "美团", "饿了么", "大众点评", "团购", "滴滴", "打车", "出行", "高德",
  "携程", "飞猪", "酒店", "机票", "闲鱼", "转转", "回收", "二手", "图书", "童书",
  "绘本", "分级阅读", "教材", "教辅", "练习册", "阅读", "学习机", "网课", "考试", "备考",
  "世界杯", "C罗", "夏日穿搭", "英伟达", "电池容量", "高压氧舱", "育儿补贴", "宝宝近视", "火锅", "骑手外卖", "租房", "空调", "租房空调", "儿童防晒", "防晒霜", "修复面膜",
  "爽肤水", "洗地机", "除螨仪", "纯牛奶", "酸奶", "蛋白棒", "蒟蒻果冻", "牛肉馅饼",
  "祛湿足贴", "精制井盐", "黄芪", "枸杞", "香皂", "驱蚊", "作业本", "洗衣液",
  "厨房湿巾", "养生壶", "唇釉", "奶粉", "益生菌", "沙发盖布", "应急启动电源"
];
const badCloudFragmentRe = /什么|时候|可以|怎么|为何|是否|如何|多少|几个|女子|男子|网友|见这|天塌|塌了|遇见这|调天塌/;
const meaningfulTermRe =
  /[\u4e00-\u9fa5A-Za-z0-9]*(?:世界杯|穿搭|妆|股价|管网|天气|动漫|运动|火锅|茅台|近视|补贴|婚礼|队|电动车|租房|空调|防晒|面膜|爽肤水|洗地机|除螨仪|牛奶|酸奶|蛋白棒|果冻|馅饼|足贴|井盐|黄芪|枸杞|香皂|作业本|湿巾|养生壶|唇釉|奶粉|益生菌|沙发盖布|电源|饼干|风扇|清洁剂|童书|绘本|教材|教辅|机票|酒店|外卖|团购|回收|二手)[\u4e00-\u9fa5A-Za-z0-9]*/g;

function cleanCandidateTerm(value = "") {
  const original = String(value || "").trim();
  if (original === "C罗") return original;
  let word = shortenWord(value)
    .replace(/[0-9A-Za-z亓]+/g, "")
    .replace(/^(?:这|这个|这种|那|那个|那些|见这|遇见这|遇见|见)/g, "")
    .replace(/^(?:个?月|个月|个|只|件|本|册|袋|盒|瓶|包|片|粒|对|抽|卷|台|支|罐)+/g, "")
    .replace(/^(?:后|前)/g, "")
    .replace(/袋.*$/g, "")
    .replace(/(?:下达|曝光|回应|官宣|开播|开启|大涨|走红|抵杭|被查|获刑|超|欲写|嫌|(?<!防)晒|任意).*$/g, "")
    .replace(/[克斤元度支抽卷袋盒瓶包片粒对台罐千]+$/g, "")
    .trim();
  if (!word || stopWords.has(word) || badCloudFragmentRe.test(word) || /^[A-Za-z0-9]+$/.test(word)) return "";
  const cjkCount = (word.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (cjkCount < 2 || cjkCount > 8 || word.length > 18) return "";
  return word;
}

function candidateTermsFromTitle(title = "") {
  const text = String(title || "");
  const hits = [];
  for (const term of curatedTerms) {
    if (text.includes(term)) hits.push(term);
  }
  for (const match of text.matchAll(meaningfulTermRe)) {
    const cleaned = cleanCandidateTerm(match[0]);
    if (cleaned) hits.push(cleaned);
  }
  return [...new Set(hits)];
}

function fallbackTerms(titles, type, limit) {
  const scores = new Map();
  const sources = new Map();
  for (const { title, sourceName, listName, weight = 1 } of titles) {
    const candidates = candidateTermsFromTitle(title);
    for (const term of candidates) {
      scores.set(term, (scores.get(term) || 0) + weight * (curatedTerms.includes(term) ? 2 : 1));
      const list = sources.get(term) || [];
      if (!list.some((item) => item.title === title)) {
        list.push({ sourceName, listName, title });
        sources.set(term, list.slice(0, 4));
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word], index) => ({ word, weight: Math.max(10, 100 - index * 3), type, sources: sources.get(word) || [] }));
}

function fallbackClouds(input) {
  const hotTitles = [];
  const shopTitles = [];
  const hotByCategory = Object.fromEntries(categoryKeys.map((key) => [key, []]));
  const shopByCategory = Object.fromEntries(categoryKeys.map((key) => [key, []]));

  for (const list of input.lists) {
    for (const item of list.items) {
      const row = {
        title: item.title,
        sourceName: list.sourceName,
        listName: list.listName,
        weight: Math.max(metricValue(item.metric), 10_000)
      };
      if (list.category === "hot-search") hotTitles.push(row);
      if (list.category === "shopping") shopTitles.push(row);
      if (list.category === "hot-search" && item.categoryKey && hotByCategory[item.categoryKey]) hotByCategory[item.categoryKey].push(row);
      if (list.category === "shopping" && item.categoryKey && shopByCategory[item.categoryKey]) shopByCategory[item.categoryKey].push(row);
    }
  }

  const topicCategory = {};
  const productCategory = {};
  for (const key of categoryKeys) {
    topicCategory[key] = fallbackTerms(hotByCategory[key], "topic", 20);
    productCategory[key] = fallbackTerms(shopByCategory[key], "category", 20);
  }
  return {
    topic: fallbackTerms(hotTitles, "topic", 50),
    product: fallbackTerms(shopTitles, "product", 50),
    topicCategory,
    productCategory
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
    if (!validateClouds(normalized, input)) throw new Error("LLM returned empty word cloud arrays for available source data.");
    model = llm.model;
    wordCloudSource = "llm";
    wordClouds = attachCloudSources(normalized, input);
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
