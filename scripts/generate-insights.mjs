import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const insightDir = path.join(dataDir, "insights");

const categories = [
  { key: "C3", name: "3C数码" },
  { key: "HOME", name: "家居家装" },
  { key: "APPL", name: "家用电器" },
  { key: "BABY", name: "母婴亲子" },
  { key: "FOOD", name: "食品饮料" },
  { key: "BEAU", name: "美妆护肤" },
  { key: "CLOT", name: "服饰穿戴" },
  { key: "EDU", name: "平台教育" }
];

const categoryRules = {
  C3: /手机|iPhone|苹果|华为|小米|OPPO|vivo|荣耀|平板|iPad|电脑|笔记本|相机|大疆|耳机|蓝牙|充电|数码|芯片|GPU|英伟达|AI|大模型|DeepSeek|文心|GPT|算力|算法|科技|发布会|HarmonyOS|鸿蒙|麒麟|U盘|硬盘|路由器|智能设备|穿戴|手表|VR|智能家居/i,
  HOME: /家居|家纺|家具|沙发|床垫|窗帘|地毯|装修|家装|建材|涂料|墙纸|瓷砖|厨房|卫浴|马桶|花洒|洗衣|洗发|沐浴|纸巾|湿巾|凝珠|清洁|拖把|垃圾袋|抽纸|洗衣液|消毒|个护|护理|卫生巾|花|植物|收纳|插排|插座/,
  APPL: /家电|空调|冰箱|洗衣机|电视|风扇|微波|烤箱|净化器|加湿器|电饭煲|吸尘器|扫地机|料理机|电热|热水器|电磁炉|油烟机|奥克斯|美的|格力|海尔|TCL|飞利浦|戴森/,
  BABY: /母婴|宝宝|婴儿|尿不湿|尿裤|奶粉|奶瓶|奶嘴|童装|童鞋|儿童|玩具|乐器|益智|绘本|图书|文具|礼品|学习机|早教|学步|安抚|辅食|月子/,
  FOOD: /食品|零食|饼干|薯片|粽|月饼|奶茶|咖啡|牛奶|酸奶|啤酒|白酒|红酒|饮料|果汁|益生菌|坚果|巧克力|火锅|方便面|速食|生鲜|水果|蔬菜|肉|蛋|海鲜|皮皮虾|榴莲|车厘子|西瓜/,
  BEAU: /面膜|口红|粉底|精华|防晒霜|护肤|美妆|彩妆|香水|美瞳|眼影|腮红|护发|染发|脱毛|妆容|妆造|睫毛|眉笔|遮瑕|气垫|定妆|卸妆|洗面|爽肤水|乳液|身体乳|唇釉|韩束|完美日记|花西子|欧莱雅|兰蔻|雅诗兰黛/,
  CLOT: /T恤|连衣裙|裤|衬衫|外套|风衣|羽绒|羊绒|针织|毛衣|卫衣|背心|短袖|长袖|内衣|内裤|文胸|袜|鞋|靴|帽|围巾|手套|箱包|钱包|双肩包|手提包|眼镜|墨镜|手表|腕表|穿搭|服饰|时装|tutu|冰丝|防晒衣|防晒裤|冲锋衣|polo|短裙|长裙|户外|运动鞋|跑鞋/i,
  EDU: /学而思|新东方|猿辅导|高途|网易有道|作业帮|学习机|网课|在线教育|教培|培训|考研|考公|京东|阿里巴巴|淘宝|天猫|拼多多|美团|饿了么|大众点评|滴滴|高德|携程|飞猪|闲鱼|转转|本地生活|外卖|二手|回收|旅游|酒店|机票/
};

const fallbackPlaybook = {
  C3: [
    { sub: "AI手机", scene: "AI 大模型换机潮", topics: ["AI手机", "iPhone", "华为", "小米", "DeepSeek"] },
    { sub: "笔电游戏本", scene: "AI PC 与效率升级", topics: ["MacBook", "游戏本", "RTX", "AI PC"] },
    { sub: "影像设备", scene: "出游记录与内容创作", topics: ["大疆", "相机", "Vlog", "影像"] },
    { sub: "穿戴 / 耳机", scene: "通勤、运动与 AI 助理", topics: ["耳机", "Apple Watch", "AI眼镜", "降噪"] }
  ],
  HOME: [
    { sub: "卧室寝具", scene: "换季与助眠经济", topics: ["床垫", "枕头", "助眠", "家纺"] },
    { sub: "整装/装修", scene: "婚装、换房与局改", topics: ["装修", "全屋定制", "厨房", "新中式"] },
    { sub: "卫浴升级", scene: "卫生间局改与适老化", topics: ["智能马桶", "花洒", "卫浴", "九牧"] },
    { sub: "软装收纳", scene: "小户型治愈感升级", topics: ["收纳", "软装", "奶油风", "出租屋"] }
  ],
  APPL: [
    { sub: "空冰洗大件", scene: "以旧换新与国补红利", topics: ["空调", "冰箱", "洗衣机", "美的", "海尔"] },
    { sub: "清洁家电", scene: "懒人解放与养宠家庭", topics: ["扫地机器人", "洗地机", "吸尘器", "追觅"] },
    { sub: "厨房小家电", scene: "快手早餐与健康轻食", topics: ["空气炸锅", "破壁机", "养生壶", "电饭煲"] },
    { sub: "电视影音", scene: "客厅观影与赛事直播", topics: ["电视", "投影仪", "MiniLED", "音响"] }
  ],
  BABY: [
    { sub: "婴幼儿奶粉", scene: "科学喂养与配方信任", topics: ["奶粉", "HMO", "A2", "益生菌"] },
    { sub: "纸尿裤湿巾", scene: "夏季透气与红屁屁防护", topics: ["纸尿裤", "拉拉裤", "湿巾", "透气"] },
    { sub: "童装童鞋", scene: "亲子穿搭与换季上新", topics: ["童装", "童鞋", "亲子", "儿童节"] },
    { sub: "早教学习", scene: "幼小衔接与暑期续报", topics: ["学习机", "点读笔", "绘本", "早教"] }
  ],
  FOOD: [
    { sub: "乳制品", scene: "高端化、健身与儿童成长", topics: ["牛奶", "酸奶", "乳制品", "低脂"] },
    { sub: "饮料茶饮", scene: "夏季解暑与 0 糖风潮", topics: ["奶茶", "咖啡", "饮料", "0糖"] },
    { sub: "零食坚果", scene: "追剧、办公室与囤货", topics: ["零食", "坚果", "薯片", "饼干"] },
    { sub: "生鲜水果", scene: "时令尝鲜与健康饮食", topics: ["水果", "榴莲", "西瓜", "车厘子"] }
  ],
  BEAU: [
    { sub: "抗老精华", scene: "熬夜抗老与成分党", topics: ["精华", "抗老", "视黄醇", "烟酰胺"] },
    { sub: "敏感肌修护", scene: "换季泛红与屏障修护", topics: ["敏感肌", "修护", "薇诺娜", "理肤泉"] },
    { sub: "底妆遮瑕", scene: "通勤定妆与婚礼妆", topics: ["粉底", "气垫", "遮瑕", "定妆"] },
    { sub: "防晒美白", scene: "户外旅行与通勤防晒", topics: ["防晒", "美白", "UPF", "海岛"] }
  ],
  CLOT: [
    { sub: "夏季防晒衣", scene: "通勤防晒与户外徒步", topics: ["防晒衣", "冰丝", "UPF", "户外"] },
    { sub: "内衣家居服", scene: "无尺码与软支撑", topics: ["内衣", "家居服", "ubras", "蕉内"] },
    { sub: "运动鞋", scene: "跑团与城市马拉松", topics: ["跑鞋", "运动鞋", "安踏", "李宁"] },
    { sub: "国潮中式", scene: "新中式与国风穿搭", topics: ["汉服", "马面裙", "新中式", "国风"] }
  ],
  EDU: [
    { sub: "K12 学科辅导", scene: "暑期续报与提分焦虑", topics: ["学而思", "猿辅导", "作业帮", "学习机"] },
    { sub: "考研考公", scene: "上岸叙事与倒计时冲刺", topics: ["考研", "考公", "新东方", "网课"] },
    { sub: "本地餐饮", scene: "探店打卡与团购转化", topics: ["美团", "大众点评", "团购", "外卖"] },
    { sub: "旅行出行", scene: "假期长线游与本地周边游", topics: ["携程", "飞猪", "酒店", "机票"] }
  ]
};

function parseMetric(metric = "") {
  const match = String(metric).replace(/[, ]/g, "").match(/([\d.]+)\s*(亿|万|w|W|k|K)?/);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]);
  const unit = match[2] || "";
  if (unit === "亿") return value * 1e8;
  if (unit === "万" || unit === "w" || unit === "W") return value * 1e4;
  if (unit === "k" || unit === "K") return value * 1e3;
  return value;
}

function categoryOf(title = "") {
  return categories.find((cat) => categoryRules[cat.key].test(title))?.key || null;
}

function uniq(values, limit = 6) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = text.toLowerCase().replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function compactLatest(latest) {
  const compact = {
    date: latest.date,
    capturedAt: latest.capturedAt,
    lists: latest.lists.map((list) => ({
      category: list.category,
      sourceName: list.sourceName,
      listName: list.listName,
      items: list.items.slice(0, 15).map((item) => ({
        rank: item.rank,
        title: item.title,
        metric: item.metric,
        categoryKey: categoryOf(item.title),
        metricValue: parseMetric(item.metric)
      }))
    }))
  };

  compact.categorySignals = Object.fromEntries(
    categories.map((cat) => {
      const items = [];
      for (const list of latest.lists) {
        for (const item of list.items) {
          if (categoryOf(item.title) === cat.key) {
            items.push({
              sourceName: list.sourceName,
              listType: list.category,
              title: item.title,
              metric: item.metric,
              rank: item.rank,
              metricValue: parseMetric(item.metric)
            });
          }
        }
      }
      items.sort((a, b) => b.metricValue - a.metricValue);
      return [cat.key, items];
    })
  );
  compact.fallbackSubcategories = fallbackPlaybook;

  return compact;
}

function rowScore(row, signals) {
  const keys = uniq([row.sub, ...(row.topics || [])], 20);
  return signals.reduce((score, item) => {
    const title = item.title || "";
    const matched = keys.some((key) => title.includes(key) || key.includes(title));
    return score + (matched ? Math.log10((item.metricValue || 1) + 10) : 0);
  }, 0);
}

function fallbackRowsForCategory(cat, compact) {
  const signals = compact.categorySignals[cat.key] || [];
  const templates = fallbackPlaybook[cat.key] || [];
  const orderedTemplates = [...templates].sort((a, b) => rowScore(b, signals) - rowScore(a, signals));
  const topSignals = signals.slice(0, 5);

  return orderedTemplates.slice(0, 4).map((row, index) => {
    const rowSignals = signals.filter((item) =>
      uniq([row.sub, ...row.topics], 20).some((key) => item.title.includes(key))
    );
    const picked = rowSignals.length ? rowSignals : topSignals.slice(index, index + 1);
    const top = picked[0] || topSignals[0];
    return {
      sub: row.sub,
      scene: top ? `${row.scene} · 今日信号:${top.title}` : row.scene,
      topics: uniq([...(picked.map((item) => item.title)), ...row.topics], 6),
      strategy: top
        ? `围绕「${top.title}」做首屏钩子,用「榜单解读 + 场景清单 + 达人实测」承接兴趣;投放时优先测试${cat.name}人群,次日把互动最高的问题复用到直播间标题、搜索词和商品卡卖点。`
        : `今日暂无强热点命中,用${row.scene}做常青内容测试;保持小预算 A/B 素材,观察评论区需求后再放大。`
    };
  });
}

function normalizeCategory(cat, inputCategory, compact) {
  const fallbackRows = fallbackRowsForCategory(cat, compact);
  const rawRows = Array.isArray(inputCategory?.rows) ? inputCategory.rows : [];
  const cleaned = rawRows
    .filter((row) => row?.sub && row?.scene && row?.strategy)
    .map((row) => ({
      sub: String(row.sub).trim(),
      scene: String(row.scene).trim(),
      topics: uniq(Array.isArray(row.topics) ? row.topics : [], 6),
      strategy: String(row.strategy).trim()
    }));

  const signals = compact.categorySignals[cat.key] || [];
  const hasScoredRows = cleaned.some((row) => rowScore(row, signals) > 0);
  const sorted = hasScoredRows
    ? [...cleaned].sort((a, b) => rowScore(b, signals) - rowScore(a, signals))
    : cleaned;

  const rows = [];
  const needsFallback = signals.length === 0 || sorted.length === 0;
  const rowPool = needsFallback ? [...sorted, ...fallbackRows] : sorted;
  for (const row of rowPool) {
    if (rows.some((existing) => existing.sub === row.sub)) continue;
    rows.push(row);
    if (needsFallback && rows.length >= 4) break;
  }

  const top = signals[0];
  return {
    lead:
      inputCategory?.lead ||
      (top
        ? `今日${cat.name}命中 ${signals.length} 条榜单信号,优先围绕「${top.title}」展开营销策略。`
        : `今日${cat.name}暂无强榜单信号,展示 4 个常青兜底类目。`),
    bullets:
      Array.isArray(inputCategory?.bullets) && inputCategory.bullets.length
        ? inputCategory.bullets.slice(0, 4)
        : signals.slice(0, 4).map((item) => `${item.sourceName}:${item.title}`),
    rows: rows.length ? rows : fallbackRows.slice(0, 4)
  };
}

function normalizeInsights(content, latest) {
  const compact = compactLatest(latest);
  return {
    summary: {
      lead: content?.summary?.lead || "今日营销策略已按最新榜单生成。",
      bullets: Array.isArray(content?.summary?.bullets) ? content.summary.bullets.slice(0, 4) : [],
      rows: []
    },
    categories: Object.fromEntries(
      categories.map((cat) => [cat.key, normalizeCategory(cat, content?.categories?.[cat.key], compact)])
    )
  };
}

function rowSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sub", "scene", "topics", "strategy"],
    properties: {
      sub: { type: "string" },
      scene: { type: "string" },
      topics: { type: "array", items: { type: "string" } },
      strategy: { type: "string" }
    }
  };
}

function categorySchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["lead", "bullets", "rows"],
    properties: {
      lead: { type: "string" },
      bullets: { type: "array", items: { type: "string" } },
      rows: { type: "array", items: rowSchema() }
    }
  };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "categories"],
  properties: {
    summary: categorySchema(),
    categories: {
      type: "object",
      additionalProperties: false,
      required: categories.map((cat) => cat.key),
      properties: Object.fromEntries(categories.map((cat) => [cat.key, categorySchema()]))
    }
  }
};

function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("");
}

async function callOpenAI(latest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const input = compactLatest(latest);

  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "你是中文消费品趋势与营销策略分析师。只基于输入 JSON 中的真实榜单数据写洞察,不要编造未出现的热点、品牌或平台。输出必须是中文 JSON。每个 categories.<key>.rows 不设上限:凡是当日榜单信号涉及到的二级类目都应优先输出;只有该大类没有任何相关热点/热销信号时,才从 fallbackSubcategories 中生成至少 4 条保底。策略要具体到内容形式、投放阵地、创意角度和次日复用动作。"
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "daily_marketing_insights",
          strict: true,
          schema: responseSchema
        }
      }
    })
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status}: ${bodyText}`);
  }

  const response = JSON.parse(bodyText);
  const outputText = extractOutputText(response);
  if (!outputText) {
    throw new Error("OpenAI API returned no output text");
  }

  return {
    model,
    generatedAt: new Date().toISOString(),
    content: normalizeInsights(JSON.parse(outputText), latest)
  };
}

function fallbackInsights(latest, reason) {
  const compact = compactLatest(latest);
  const makeCategory = (cat) => {
    const signals = compact.categorySignals[cat.key] || [];
    const top = signals[0];
    const lead = top
      ? `今日${cat.name}命中 ${signals.length} 条榜单信号,最高热度来自「${top.title}」。`
      : `今日${cat.name}没有明显榜单信号,建议保持轻量观察。`;
    return {
      lead,
      bullets: signals.slice(0, 3).map((item) => `${item.sourceName}:${item.title}`),
      rows: fallbackRowsForCategory(cat, compact)
    };
  };

  return {
    model: "fallback",
    generatedAt: new Date().toISOString(),
    fallbackReason: reason,
    content: {
      summary: {
        lead: `LLM 洞察生成未启用或失败,当前使用规则兜底。原因:${reason}`,
        bullets: ["配置 OPENAI_API_KEY 后会自动生成模型洞察"],
        rows: []
      },
      categories: Object.fromEntries(categories.map((cat) => [cat.key, makeCategory(cat)]))
    }
  };
}

async function main() {
  const latestPath = path.join(dataDir, "latest.json");
  if (!existsSync(latestPath)) {
    throw new Error("data/latest.json does not exist. Run npm run crawl first.");
  }

  await fs.mkdir(insightDir, { recursive: true });
  const latest = JSON.parse(await fs.readFile(latestPath, "utf8"));

  let payload;
  try {
    payload = await callOpenAI(latest);
  } catch (error) {
    if (process.env.REQUIRE_LLM === "1") throw error;
    console.warn(`Falling back without LLM: ${error.message}`);
    payload = fallbackInsights(latest, error.message);
  }

  const output = {
    date: latest.date,
    capturedAt: latest.capturedAt,
    sourceData: "data/latest.json",
    ...payload
  };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await fs.writeFile(path.join(insightDir, `${latest.date}.json`), json, "utf8");
  await fs.writeFile(path.join(insightDir, "latest.json"), json, "utf8");
  console.log(`Wrote insights for ${latest.date} with ${output.model}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
