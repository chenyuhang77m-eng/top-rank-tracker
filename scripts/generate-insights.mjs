import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const insightDir = path.join(dataDir, "insights");
const llmTimeoutMs = Number(process.env.LLM_TIMEOUT_MS || 300_000);
const rowsPerCategory = 5;

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
  EDU: /学而思|新东方|猿辅导|高途|网易有道|作业帮|斑马AI|核桃编程|VIPKID|掌门一对一|学习机|网课|在线教育|教培|教辅|课外辅导|辅导班|培训班|培训机构|考研|考公|公务员考试|事业编|教师资格|雅思|托福|GRE|GMAT|MBA培训|公考|考证培训|资格证培训|执业证培训|职业资格|报考条件|早教|学步|益智|绘本|图书音像|学龄前|幼小衔接|京东|阿里巴巴|淘宝|天猫|拼多多|美团|饿了么|大众点评|滴滴|高德|携程|飞猪|同程|马蜂窝|闲鱼|转转|爱回收|多抓鱼|本地生活|外卖|二手|回收|旅游|酒店|机票|景区|跟团游|自由行|抖音电商|抖音小店|快手电商|快手小店|小红书电商/
};

const fallbackPlaybook = {
  C3: [
    { sub: "AI手机", scene: "AI 大模型换机潮", topics: ["AI手机", "iPhone", "华为", "小米", "DeepSeek"] },
    { sub: "笔电游戏本", scene: "AI PC 与效率升级", topics: ["MacBook", "游戏本", "RTX", "AI PC"] },
    { sub: "影像设备", scene: "出游记录与内容创作", topics: ["大疆", "相机", "Vlog", "影像"] },
    { sub: "穿戴 / 耳机", scene: "通勤、运动与 AI 助理", topics: ["耳机", "Apple Watch", "AI眼镜", "降噪"] },
    { sub: "智能家居设备", scene: "家庭自动化与安全看护", topics: ["智能音箱", "摄像头", "门锁", "路由器"] }
  ],
  HOME: [
    { sub: "卧室寝具", scene: "换季与助眠经济", topics: ["床垫", "枕头", "助眠", "家纺"] },
    { sub: "整装/装修", scene: "婚装、换房与局改", topics: ["装修", "全屋定制", "厨房", "新中式"] },
    { sub: "卫浴升级", scene: "卫生间局改与适老化", topics: ["智能马桶", "花洒", "卫浴", "九牧"] },
    { sub: "软装收纳", scene: "小户型治愈感升级", topics: ["收纳", "软装", "奶油风", "出租屋"] },
    { sub: "家清个护", scene: "家庭囤货与清洁效率", topics: ["纸巾", "洗衣液", "湿巾", "清洁"] }
  ],
  APPL: [
    { sub: "空冰洗大件", scene: "以旧换新与国补红利", topics: ["空调", "冰箱", "洗衣机", "美的", "海尔"] },
    { sub: "清洁家电", scene: "懒人解放与养宠家庭", topics: ["扫地机器人", "洗地机", "吸尘器", "追觅"] },
    { sub: "厨房小家电", scene: "快手早餐与健康轻食", topics: ["空气炸锅", "破壁机", "养生壶", "电饭煲"] },
    { sub: "电视影音", scene: "客厅观影与赛事直播", topics: ["电视", "投影仪", "MiniLED", "音响"] },
    { sub: "季节环境电器", scene: "降温除湿与空气管理", topics: ["风扇", "除湿机", "净化器", "加湿器"] }
  ],
  BABY: [
    { sub: "婴幼儿奶粉", scene: "科学喂养与配方信任", topics: ["奶粉", "HMO", "A2", "益生菌"] },
    { sub: "纸尿裤湿巾", scene: "夏季透气与红屁屁防护", topics: ["纸尿裤", "拉拉裤", "湿巾", "透气"] },
    { sub: "童装童鞋", scene: "亲子穿搭与换季上新", topics: ["童装", "童鞋", "亲子", "儿童节"] },
    { sub: "早教学习", scene: "幼小衔接与暑期续报", topics: ["学习机", "点读笔", "绘本", "早教"] },
    { sub: "儿童出行用品", scene: "亲子外出与安全看护", topics: ["安全座椅", "推车", "餐椅", "背带"] }
  ],
  FOOD: [
    { sub: "乳制品", scene: "高端化、健身与儿童成长", topics: ["牛奶", "酸奶", "乳制品", "低脂"] },
    { sub: "饮料茶饮", scene: "夏季解暑与 0 糖风潮", topics: ["奶茶", "咖啡", "饮料", "0糖"] },
    { sub: "零食坚果", scene: "追剧、办公室与囤货", topics: ["零食", "坚果", "薯片", "饼干"] },
    { sub: "生鲜水果", scene: "时令尝鲜与健康饮食", topics: ["水果", "榴莲", "西瓜", "车厘子"] },
    { sub: "速食预制菜", scene: "工作日晚餐与懒人厨房", topics: ["方便面", "速食", "预制菜", "火锅"] }
  ],
  BEAU: [
    { sub: "抗老精华", scene: "熬夜抗老与成分党", topics: ["精华", "抗老", "视黄醇", "烟酰胺"] },
    { sub: "敏感肌修护", scene: "换季泛红与屏障修护", topics: ["敏感肌", "修护", "薇诺娜", "理肤泉"] },
    { sub: "底妆遮瑕", scene: "通勤定妆与婚礼妆", topics: ["粉底", "气垫", "遮瑕", "定妆"] },
    { sub: "防晒美白", scene: "户外旅行与通勤防晒", topics: ["防晒", "美白", "UPF", "海岛"] },
    { sub: "彩妆香氛", scene: "妆容焕新与礼赠场景", topics: ["口红", "眼影", "香水", "美瞳"] }
  ],
  CLOT: [
    { sub: "夏季防晒衣", scene: "通勤防晒与户外徒步", topics: ["防晒衣", "冰丝", "UPF", "户外"] },
    { sub: "内衣家居服", scene: "无尺码与软支撑", topics: ["内衣", "家居服", "ubras", "蕉内"] },
    { sub: "运动鞋", scene: "跑团与城市马拉松", topics: ["跑鞋", "运动鞋", "安踏", "李宁"] },
    { sub: "国潮中式", scene: "新中式与国风穿搭", topics: ["汉服", "马面裙", "新中式", "国风"] },
    { sub: "箱包配饰", scene: "通勤收纳与穿搭点睛", topics: ["箱包", "帽子", "眼镜", "手表"] }
  ],
  EDU: [
    { sub: "K12 学科辅导", scene: "暑期续报与提分焦虑", topics: ["学而思", "猿辅导", "作业帮", "学习机"] },
    { sub: "考研考公", scene: "上岸叙事与倒计时冲刺", topics: ["考研", "考公", "新东方", "网课"] },
    { sub: "本地餐饮", scene: "探店打卡与团购转化", topics: ["美团", "大众点评", "团购", "外卖"] },
    { sub: "旅行出行", scene: "假期长线游与本地周边游", topics: ["携程", "飞猪", "酒店", "机票"] },
    { sub: "二手回收", scene: "闲置流转与低预算换新", topics: ["闲鱼", "转转", "回收", "二手"] }
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
      const hot = [];
      const shop = [];
      for (const list of latest.lists) {
        for (const item of list.items) {
          if (categoryOf(item.title) === cat.key) {
            const signal = {
              sourceName: list.sourceName,
              listType: list.category,
              title: item.title,
              metric: item.metric,
              rank: item.rank,
              metricValue: parseMetric(item.metric)
            };
            if (list.category === "hot-search") hot.push(signal);
            else if (list.category === "shopping") shop.push(signal);
          }
        }
      }
      hot.sort((a, b) => b.metricValue - a.metricValue);
      shop.sort((a, b) => b.metricValue - a.metricValue);
      return [cat.key, { hot, shop, all: [...hot, ...shop].sort((a, b) => b.metricValue - a.metricValue) }];
    })
  );
  compact.fallbackSubcategories = fallbackPlaybook;

  return compact;
}

function rowScore(row, signals) {
  const list = Array.isArray(signals) ? signals : signals?.all || [];
  const keys = uniq([row.sub, ...(row.hotTerms || []), ...(row.topicIdeas || []), ...(row.topics || [])], 20);
  return list.reduce((score, item) => {
    const title = item.title || "";
    const matched = keys.some((key) => title.includes(key) || key.includes(title));
    return score + (matched ? Math.log10((item.metricValue || 1) + 10) : 0);
  }, 0);
}

function highlightStrategy(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  if (/【重点】|【投放】|【复用】/.test(trimmed)) return trimmed;
  return `【重点】${trimmed}`;
}

function fallbackRowsForCategory(cat, compact) {
  const signalSet = compact.categorySignals[cat.key] || { hot: [], shop: [], all: [] };
  const hotSignals = signalSet.hot || [];
  const shopSignals = signalSet.shop || [];
  const templates = fallbackPlaybook[cat.key] || [];
  const orderedTemplates = [...templates].sort((a, b) => rowScore(b, hotSignals) - rowScore(a, hotSignals));

  return orderedTemplates.slice(0, rowsPerCategory).map((row) => {
    const rowKeys = uniq([row.sub, ...row.topics], 20);
    const rowSignals = hotSignals.filter((item) => rowKeys.some((key) => item.title.includes(key)));
    const top = rowSignals[0];
    const hotTerms = uniq(rowSignals.map((item) => item.title), 5);
    const topicIdeas = uniq([
      ...hotTerms.map((term) => `${term}\u573a\u666f\u79cd\u8349`),
      ...row.topics.map((term) => `${term}\u5185\u5bb9\u94a9\u5b50`)
    ], 5);
    const rowShop = shopSignals.find((item) => rowKeys.some((key) => item.title.includes(key)));
    const productText = rowShop
      ? `\u70ed\u9500\u5546\u54c1\u53ef\u7528\u300c${rowShop.title}\u300d\u627f\u63a5\u8f6c\u5316`
      : '\u7535\u5546\u4fa7\u6682\u65e0\u5f3a\u5173\u8054 SKU,\u5148\u7528\u4e92\u52a8\u6700\u9ad8\u7684\u70ed\u70b9\u8bcd\u9a8c\u8bc1\u9700\u6c42';

    return {
      sub: row.sub,
      scene: top ? `${row.scene} | \u4eca\u65e5\u70ed\u70b9:${top.title}` : row.scene,
      hotTerms,
      topicIdeas,
      topics: topicIdeas,
      strategy: top
        ? `\u3010\u91cd\u70b9\u3011\u56f4\u7ed5\u300c${top.title}\u300d\u63d0\u70bc 3-5 \u4e2a\u5185\u5bb9\u5207\u53e3,\u7528\u300c\u70ed\u70b9\u89e3\u91ca + \u54c1\u7c7b\u75db\u70b9 + \u4ea7\u54c1\u573a\u666f\u300d\u627f\u63a5\u5174\u8da3;\u3010\u6295\u653e\u3011\u4f18\u5148\u6d4b\u8bd5${row.sub}\u4eba\u7fa4,${productText};\u3010\u590d\u7528\u3011\u6b21\u65e5\u628a\u4e92\u52a8\u6700\u9ad8\u7684\u8bdd\u9898\u8bcd\u590d\u7528\u5230\u76f4\u64ad\u95f4\u6807\u9898\u3001\u641c\u7d22\u8bcd\u548c\u5546\u54c1\u5361\u5356\u70b9\u3002`
        : `\u3010\u91cd\u70b9\u3011\u4eca\u65e5${row.sub}\u6682\u65e0\u5f3a\u70ed\u70b9\u4fe1\u53f7,\u56f4\u7ed5\u300c${row.scene}\u300d\u505a\u5e38\u9752\u5185\u5bb9\u6d4b\u8bd5;\u3010\u6295\u653e\u3011\u4fdd\u6301\u5c0f\u9884\u7b97 A/B \u7d20\u6750;\u3010\u590d\u7528\u3011\u89c2\u5bdf\u8bc4\u8bba\u533a\u9700\u6c42\u540e\u518d\u653e\u5927\u3002`
    };
  });
}

function normalizeCategory(cat, inputCategory, compact) {
  const fallbackRows = fallbackRowsForCategory(cat, compact);
  const rawRows = Array.isArray(inputCategory?.rows) ? inputCategory.rows : [];
  const signalSet = compact.categorySignals[cat.key] || { hot: [], shop: [], all: [] };
  const hotSignals = signalSet.hot || [];
  const allSignals = signalSet.all || [];
  const shopSignals = signalSet.shop || [];

  const cleaned = rawRows
    .filter((row) => row?.sub && row?.scene && row?.strategy)
    .map((row) => {
      const sub = String(row.sub).trim();
      const scene = String(row.scene).trim();
      const hotTerms = uniq(Array.isArray(row.hotTerms) ? row.hotTerms : [], 5).filter((term) => term.length <= 40);
      const topicIdeas = uniq(Array.isArray(row.topicIdeas) ? row.topicIdeas : Array.isArray(row.topics) ? row.topics : [], 5);
      const rowKeys = uniq([sub, ...hotTerms, ...topicIdeas], 20);
      const matchedHot = hotSignals.filter((item) => rowKeys.some((key) => key && item.title.includes(key)));
      const safeHotTerms = hotTerms.length ? hotTerms : uniq(matchedHot.map((item) => item.title), 5);
      const fallbackTopicIdeas = uniq([
        ...safeHotTerms.map((term) => `${term}\u573a\u666f\u79cd\u8349`),
        ...topicIdeas
      ], 5);
      const safeTopicIdeas = fallbackTopicIdeas.length ? fallbackTopicIdeas : safeHotTerms;
      let strategy = highlightStrategy(row.strategy);
      const irrelevantHot = hotSignals.some((item) => {
        if (!item.title || item.title.length < 4) return false;
        if (matchedHot.some((hit) => hit.title === item.title)) return false;
        return strategy.includes(item.title);
      });
      if (irrelevantHot) {
        const top = matchedHot[0];
        const rowShop = shopSignals.find((item) => rowKeys.some((key) => key && item.title.includes(key)));
        const productText = rowShop
          ? `\u70ed\u9500\u5546\u54c1\u53ef\u7528\u300c${rowShop.title}\u300d\u627f\u63a5\u8f6c\u5316`
          : '\u7535\u5546\u4fa7\u6682\u65e0\u5f3a\u5173\u8054 SKU,\u5148\u7528\u4e92\u52a8\u6700\u9ad8\u7684\u70ed\u70b9\u8bcd\u9a8c\u8bc1\u9700\u6c42';
        strategy = top
          ? `\u3010\u91cd\u70b9\u3011\u56f4\u7ed5\u300c${top.title}\u300d\u63d0\u70bc 3-5 \u4e2a\u5185\u5bb9\u5207\u53e3,\u7528\u300c\u70ed\u70b9\u89e3\u91ca + \u54c1\u7c7b\u75db\u70b9 + \u4ea7\u54c1\u573a\u666f\u300d\u627f\u63a5\u5174\u8da3;\u3010\u6295\u653e\u3011\u4f18\u5148\u6d4b\u8bd5${sub}\u4eba\u7fa4,${productText};\u3010\u590d\u7528\u3011\u6b21\u65e5\u628a\u4e92\u52a8\u6700\u9ad8\u7684\u8bdd\u9898\u8bcd\u590d\u7528\u5230\u76f4\u64ad\u95f4\u6807\u9898\u3001\u641c\u7d22\u8bcd\u548c\u5546\u54c1\u5361\u5356\u70b9\u3002`
          : `\u3010\u91cd\u70b9\u3011\u4eca\u65e5${sub}\u6682\u65e0\u5f3a\u70ed\u70b9\u4fe1\u53f7,\u56f4\u7ed5\u300c${scene}\u300d\u505a\u5e38\u9752\u5185\u5bb9\u6d4b\u8bd5;\u3010\u6295\u653e\u3011\u4fdd\u6301\u5c0f\u9884\u7b97 A/B \u7d20\u6750;\u3010\u590d\u7528\u3011\u89c2\u5bdf\u8bc4\u8bba\u533a\u9700\u6c42\u540e\u518d\u653e\u5927\u3002`;
      }
      return { sub, scene, hotTerms: safeHotTerms, topicIdeas: safeTopicIdeas, topics: safeTopicIdeas, strategy };
    });

  const hasScoredRows = cleaned.some((row) => rowScore(row, hotSignals) > 0);
  const sorted = hasScoredRows
    ? [...cleaned].sort((a, b) => rowScore(b, hotSignals) - rowScore(a, hotSignals))
    : cleaned;

  const rows = [];
  const rowPool = [...sorted, ...fallbackRows];
  for (const row of rowPool) {
    if (rows.some((existing) => existing.sub === row.sub)) continue;
    rows.push(row);
    if (rows.length >= rowsPerCategory) break;
  }

  const top = hotSignals[0] || allSignals[0];
  return {
    lead:
      inputCategory?.lead ||
      (top
        ? `\u4eca\u65e5${cat.name}\u547d\u4e2d ${hotSignals.length} \u6761\u70ed\u70b9\u4fe1\u53f7\u4e0e ${(signalSet.shop || []).length} \u6761\u5546\u54c1\u4fe1\u53f7,\u4f18\u5148\u56f4\u7ed5\u300c${top.title}\u300d\u5c55\u5f00\u8425\u9500\u7b56\u7565\u3002`
        : `\u4eca\u65e5${cat.name}\u6682\u65e0\u5f3a\u70ed\u70b9\u4fe1\u53f7,\u5c55\u793a ${rowsPerCategory} \u4e2a\u5e38\u9752\u515c\u5e95\u7c7b\u76ee\u3002`),
    bullets:
      Array.isArray(inputCategory?.bullets) && inputCategory.bullets.length
        ? inputCategory.bullets.slice(0, 4)
        : hotSignals.slice(0, 4).map((item) => `${item.sourceName}:${item.title}`),
    rows: rows.length ? rows : fallbackRows.slice(0, rowsPerCategory)
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
    required: ["sub", "scene", "hotTerms", "topicIdeas", "topics", "strategy"],
    properties: {
      sub: { type: "string" },
      scene: { type: "string" },
      hotTerms: { type: "array", maxItems: 5, items: { type: "string" } },
      topicIdeas: { type: "array", maxItems: 5, items: { type: "string" } },
      topics: { type: "array", maxItems: 5, items: { type: "string" } },
      strategy: { type: "string" }
    }
  };
}

function categorySchema(rowCount = rowsPerCategory) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["lead", "bullets", "rows"],
    properties: {
      lead: { type: "string" },
      bullets: { type: "array", maxItems: 4, items: { type: "string" } },
      rows: { type: "array", minItems: rowCount, maxItems: rowCount, items: rowSchema() }
    }
  };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "categories"],
  properties: {
    summary: categorySchema(0),
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

function extractJsonText(text = "") {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function buildSystemPrompt() {
  return [
    "You are a Chinese consumer trend and marketing strategy analyst. Write all user-facing content in Simplified Chinese.",
    "Only use real ranking data from the input JSON. Do not invent hotspots, brands, products, or platforms.",
    "Workflow: first inspect categorySignals.hot for each category and decide which subcategories deserve display today; then use categorySignals.shop only as product/conversion support. Never treat a long shopping SKU title as a hotspot.",
    "Each category must output exactly 5 rows. Prefer subcategories hit by real hot-search signals; use fallbackSubcategories only when hotspot coverage is not enough.",
    "For each row: sub is the secondary category; scene is the marketing scenario derived from hotspot insight.",
    "hotTerms must contain 3-5 short terms or short phrases from real hot-search data. Do not put full product titles in hotTerms.",
    "topicIdeas must contain 3-5 content-rich marketing topic ideas created from hotTerms, such as challenges, lists, guides, tests, scene experiments, emotion hooks, or comparison themes.",
    "topics must equal topicIdeas for frontend compatibility.",
    "strategy must analyze category, hotspots, products, and topicIdeas. Include content format, placement channel, creative angle, and next-day reuse actions. Use Chinese markers \u3010\u91cd\u70b9\u3011, \u3010\u6295\u653e\u3011, and \u3010\u590d\u7528\u3011.",
    "Every row must stay within its own subcategory. If a subcategory has no relevant hot-search signal today, say it has no strong signal and write an evergreen small-budget test; do not borrow another subcategory hotspot.",
    "Return a valid JSON object only. No Markdown. No commentary.",
    "Top-level JSON must include summary and categories. summary.rows must be an empty array.",
    "categories must include C3, HOME, APPL, BABY, FOOD, BEAU, CLOT, EDU.",
    "Each category object includes lead, bullets, rows. bullets has at most 4 items; rows has exactly 5 items."
  ].join("\n");
}

function getLlmConfig() {
  const apiKey =
    process.env.VOLCENGINE_API_KEY ||
    process.env.ARK_API_KEY ||
    process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("VOLCENGINE_API_KEY is not set");
  }

  const baseUrl = (
    process.env.VOLCENGINE_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");
  const model = process.env.VOLCENGINE_MODEL || process.env.ARK_MODEL || process.env.OPENAI_MODEL;
  if (!model || model === "gpt-5-mini") {
    throw new Error("VOLCENGINE_MODEL is not set. Use your Volcano Ark model or endpoint ID.");
  }

  return { apiKey, baseUrl, model };
}

async function postChatCompletion({ apiKey, baseUrl, model, input, responseFormat }) {
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ],
    temperature: 0.4
  };

  if (responseFormat === "json_schema") {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "rank_insights",
        strict: true,
        schema: responseSchema
      }
    };
  } else if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(llmTimeoutMs),
    body: JSON.stringify(body)
  });
}

async function callLLM(latest) {
  const { apiKey, baseUrl, model } = getLlmConfig();
  const input = compactLatest(latest);

  let res = await postChatCompletion({ apiKey, baseUrl, model, input, responseFormat: "json_schema" });
  let bodyText = await res.text();

  if (!res.ok && res.status === 400 && /response_format|json_schema/i.test(bodyText)) {
    res = await postChatCompletion({ apiKey, baseUrl, model, input, responseFormat: "json_object" });
    bodyText = await res.text();
  }

  if (!res.ok && res.status === 400 && /response_format|json_object/i.test(bodyText)) {
    res = await postChatCompletion({ apiKey, baseUrl, model, input });
    bodyText = await res.text();
  }

  if (!res.ok) {
    throw new Error(`LLM API ${res.status}: ${bodyText}`);
  }

  const response = JSON.parse(bodyText);
  const outputText = response.choices?.[0]?.message?.content || extractOutputText(response);
  if (!outputText) {
    throw new Error("LLM API returned no output text");
  }

  try {
    return {
      model,
      generatedAt: new Date().toISOString(),
      content: normalizeInsights(JSON.parse(extractJsonText(outputText)), latest)
    };
  } catch (error) {
    console.warn(`Falling back after invalid LLM JSON: ${error.message}`);
    return fallbackInsights(latest, `LLM returned invalid JSON: ${error.message}`);
  }
}

function fallbackInsights(latest, reason) {
  const compact = compactLatest(latest);
  const makeCategory = (cat) => {
    const signalSet = compact.categorySignals[cat.key] || { hot: [], shop: [], all: [] };
    const hotSignals = signalSet.hot || [];
    const shopSignals = signalSet.shop || [];
    const top = hotSignals[0] || signalSet.all?.[0];
    const lead = top
      ? `\u4eca\u65e5${cat.name}\u547d\u4e2d ${hotSignals.length} \u6761\u70ed\u70b9\u4fe1\u53f7\u4e0e ${shopSignals.length} \u6761\u5546\u54c1\u4fe1\u53f7,\u6700\u9ad8\u70ed\u70b9\u6765\u81ea\u300c${top.title}\u300d\u3002`
      : `\u4eca\u65e5${cat.name}\u6ca1\u6709\u660e\u663e\u70ed\u70b9\u4fe1\u53f7,\u5efa\u8bae\u4fdd\u6301\u8f7b\u91cf\u89c2\u5bdf\u3002`;
    return {
      lead,
      bullets: hotSignals.slice(0, 3).map((item) => `${item.sourceName}:${item.title}`),
      rows: fallbackRowsForCategory(cat, compact)
    };
  };

  return {
    model: "fallback",
    generatedAt: new Date().toISOString(),
    fallbackReason: reason,
    content: {
      summary: {
        lead: `LLM \u6d1e\u5bdf\u751f\u6210\u672a\u542f\u7528\u6216\u5931\u8d25,\u5f53\u524d\u4f7f\u7528\u89c4\u5219\u515c\u5e95\u3002\u539f\u56e0:${reason}`,
        bullets: ["\u914d\u7f6e VOLCENGINE_API_KEY \u548c VOLCENGINE_MODEL \u540e\u4f1a\u81ea\u52a8\u751f\u6210\u6a21\u578b\u6d1e\u5bdf"],
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
    payload = await callLLM(latest);
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
