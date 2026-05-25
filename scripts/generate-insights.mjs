import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const insightDir = path.join(dataDir, "insights");
const llmTimeoutMs = Number(process.env.LLM_TIMEOUT_MS || 900_000);
const rowsPerCategory = 5;
const listItemsPerSource = Number(process.env.LLM_LIST_ITEMS_PER_SOURCE || 8);
const categoryHotLimit = Number(process.env.LLM_CATEGORY_HOT_LIMIT || 8);
const categoryShopLimit = Number(process.env.LLM_CATEGORY_SHOP_LIMIT || 8);

function loadLocalEnv() {
  const envFiles = [
    path.resolve(rootDir, ".env"),
    path.resolve(rootDir, "..", ".env")
  ];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, name, rawValue] = match;
      if (process.env[name]) continue;
      process.env[name] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

loadLocalEnv();

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

const categoryOverrides = [
  {
    key: "FOOD",
    re: /椰子水|电解质|驼奶|羊奶|牛奶|酸奶|奶粉|乳制品|钙片|奶片|益生菌|维生素|蛋白粉|乳清|饮料|果汁|苹果汁|矿泉水|纯净水|苏打水|茶饮|咖啡|零食|食品|坚果|饼干|糖果|方便面|拌面|蔬菜|水果|榴莲|西瓜/i
  },
  {
    key: "CLOT",
    re: /聚拢|内衣|文胸|胸罩|bra|bralette|家居服|睡衣|内裤|袜|丝袜|打底裤|防晒衣|T恤|连衣裙|半身裙|裙|裤|鞋|拖鞋|凉拖|帽子|箱包|背包|穿搭|服饰|服装|女装|男装/i
  }
];

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
    { sub: "厨房卫浴", scene: "厨卫局改与清洁升级", topics: ["厨房", "卫浴", "智能马桶", "花洒", "水槽"] },
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
    { sub: "饮料茶饮", scene: "夏季解暑与 0 糖风潮", topics: ["椰子水", "电解质", "0糖", "茶饮", "咖啡"] },
    { sub: "乳制品", scene: "高端化、健身与儿童成长", topics: ["牛奶", "酸奶", "乳制品", "低脂"] },
    { sub: "零食坚果", scene: "追剧、办公室与囤货", topics: ["零食", "坚果", "薯片", "饼干"] },
    { sub: "生鲜水果", scene: "时令尝鲜与健康饮食", topics: ["水果", "榴莲", "西瓜", "车厘子"] },
    { sub: "轻食速食", scene: "工作日晚餐与控卡代餐", topics: ["方便面", "速食", "预制菜", "轻食"] }
  ],
  BEAU: [
    { sub: "敏感肌修护", scene: "换季泛红与屏障修护", topics: ["敏感肌", "修护", "薇诺娜", "理肤泉"] },
    { sub: "抗老精华", scene: "熬夜抗老与成分党", topics: ["精华", "抗老", "视黄醇", "烟酰胺"] },
    { sub: "底妆遮瑕", scene: "通勤定妆与婚礼妆", topics: ["粉底", "气垫", "遮瑕", "定妆"] },
    { sub: "防晒美白", scene: "户外旅行与通勤防晒", topics: ["防晒", "美白", "UPF", "海岛"] },
    { sub: "彩妆香氛", scene: "妆容焕新与礼赠场景", topics: ["口红", "眼影", "香水", "美瞳"] }
  ],
  CLOT: [
    { sub: "内衣家居服", scene: "舒适支撑与居家外穿", topics: ["内衣", "家居服", "ubras", "蕉内"] },
    { sub: "夏季防晒衣", scene: "通勤防晒与户外徒步", topics: ["防晒衣", "冰丝", "UPF", "户外"] },
    { sub: "运动鞋服", scene: "跑团训练与轻运动穿搭", topics: ["跑鞋", "运动鞋", "瑜伽裤", "速干"] },
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
  const forced = categoryOverrides.find((rule) => rule.re.test(title));
  if (forced) return forced.key;
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
      items: list.items.slice(0, listItemsPerSource).map((item) => ({
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
      const trimmedHot = hot.slice(0, categoryHotLimit);
      const trimmedShop = shop.slice(0, categoryShopLimit);
      return [cat.key, { hot: trimmedHot, shop: trimmedShop, all: [...trimmedHot, ...trimmedShop].sort((a, b) => b.metricValue - a.metricValue) }];
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
  if (/【重点】|【投放】/.test(trimmed)) return trimmed;
  return `【重点】${trimmed}`;
}

function isStrategyTooThin(text = "") {
  const strategy = String(text || "").trim();
  if (strategy.length < 120) return true;
  if (!strategy.includes("【重点】") || !strategy.includes("【投放】")) return true;
  const requiredSignals = ["内容创意", "预算分层", "真实体验", "选择理由更具体"];
  return !requiredSignals.some((signal) => strategy.includes(signal));
}

function cleanTopicIdea(text = "") {
  return String(text || "")
    .trim()
    .replace(/(\u5185\u5bb9\u94a9\u5b50|\u573a\u666f\u79cd\u8349|\u8bdd\u9898\u94a9\u5b50|\u8425\u9500\u94a9\u5b50)+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(text = "") {
  return String(text || "").toLowerCase().replace(/\s+/g, "");
}

function contentIdeasForRow(row) {
  const text = `${row.sub} ${row.scene}`;
  const banks = [
    [/清洁|扫地|洗地|家清/, ["不同预算清洁家电选购清单", "520送另一半减负家电指南", "养宠家庭地面清洁实测"]],
    [/空冰洗|空调|冰箱|洗衣机|以旧换新|国补/, ["国补家电焕新预算清单", "老房换新前后电费对比", "三口之家大件家电避坑指南"]],
    [/厨房小家电|早餐|轻食|晚餐/, ["10分钟早餐小家电清单", "厨房新手不翻车食谱挑战", "打工人低油晚餐设备组合"]],
    [/厨卫|卫浴|装修|整装|局改/, ["厨卫局改预算分层清单", "卫生间三天改造前后对比", "厨房动线避坑实拍"]],
    [/寝具|助眠|床垫|枕头/, ["熬夜党助眠寝具清单", "换季床品舒适度实测", "不同预算床垫避坑指南"]],
    [/饮料|茶饮|咖啡|椰子水|电解质/, ["夏季通勤补水饮料清单", "火锅后解腻饮品盲测", "低糖饮料成分避坑指南"]],
    [/乳制品|牛奶|酸奶|蛋白/, ["早餐高蛋白乳制品搭配", "健身党低脂酸奶测评", "儿童成长奶源选择清单"]],
    [/零食|坚果/, ["儿童零食安全成分避坑清单", "办公室抽屉囤货红黑榜", "追剧零食不脏手盲测"]],
    [/水果|生鲜/, ["应季水果甜度盲测", "家庭囤水果保鲜指南", "办公室分享水果清单"]],
    [/轻食|速食|预制菜|方便面/, ["10分钟晚餐速食清单", "控卡不挨饿轻食测评", "加班夜宵低负担选择"]],
    [/敏感|修护|屏障/, ["换季泛红修护日记", "敏感肌成分避坑清单", "医美后修护步骤实测"]],
    [/抗老|精华|成分/, ["熬夜党抗老精华清单", "早C晚A耐受建立计划", "空瓶成分复盘"]],
    [/底妆|遮瑕|定妆/, ["10小时通勤持妆挑战", "不同肤质底妆上脸对比", "婚礼妆遮瑕避坑清单"]],
    [/防晒|美白/, ["海岛通勤双场景防晒清单", "补涂不搓泥实测", "油皮干皮防晒肤感对比"]],
    [/彩妆|香氛|唇妆/, ["新中式妆容色号清单", "通勤约会两用口红试色", "礼赠香氛预算指南"]],
    [/内衣|家居服/, ["不同身材内衣试穿实录", "居家外穿家居服搭配", "夏季无痕舒适内衣清单"]],
    [/防晒衣|户外/, ["通勤户外两穿防晒衣清单", "防晒衣凉感实测", "亲子出行防晒单品搭配"]],
    [/运动鞋|运动鞋服|跑鞋/, ["5公里跑鞋脚感实测", "通勤运动两穿搭配", "跑团新手装备清单"]],
    [/国潮|中式|汉服|马面裙/, ["新中式日常通勤穿搭", "普通人国风改造前后", "节日国潮穿搭清单"]],
    [/箱包|配饰|腕表/, ["通勤一周包表搭配", "职场新人配饰预算清单", "大容量通勤包实测"]],
    [/K12|学习|早教|辅导/, ["暑期提分计划表", "AI错题本整理演示", "家长少盯作业工具清单"]],
    [/考研|考公/, ["上岸学长备考复盘", "考前30天冲刺日历", "崩溃期备考陪伴内容"]],
    [/餐饮|探店|团购/, ["人均50本地团购清单", "工作日午餐不踩雷地图", "周末聚餐预算攻略"]],
    [/旅行|出行|酒店|机票/, ["3天2晚轻旅行预算拆解", "亲子出行省心路线", "机酒套餐避坑清单"]],
    [/二手|回收|闲置/, ["旧机估价流程实拍", "以旧换新价格避坑", "闲置回血交易安全清单"]],
    [/母婴|奶粉|纸尿裤|童|亲子|儿童/, ["婴童安全防护清单", "夏季红屁屁护理实测", "亲子出行安全装备指南"]],
    [/AI|手机|电脑|数码|穿戴|耳机/, ["AI功能真实场景实测", "换机党预算避坑清单", "通勤效率装备组合"]]
  ];
  return banks.find(([re]) => re.test(text))?.[1] || [`${row.sub}选购避坑清单`, `${row.sub}真实体验对比`, `${row.scene}内容选题`];
}

function topicIdeasForRow(row, hotTerms) {
  const cleanedHotTerms = uniq(hotTerms.map(cleanTopicIdea).filter(Boolean), 5);
  const hotKeys = new Set(cleanedHotTerms.map(normalizeKey));
  const ideas = contentIdeasForRow(row);
  if (cleanedHotTerms.length) {
    return uniq(ideas.map(cleanTopicIdea).filter((item) => item && !hotKeys.has(normalizeKey(item))), 5);
  }
  return uniq(ideas.map(cleanTopicIdea).filter(Boolean), 5);
}

function scenesForRow(row, hotTerms) {
  const base = [
    row.scene,
    `${row.sub}\u573a\u666f\u6e05\u5355`,
    `${row.sub}\u4eba\u7fa4\u75db\u70b9`,
    `${row.sub}\u4ea7\u54c1\u4f53\u9a8c`
  ];
  if (hotTerms[0]) base.splice(1, 0, `${hotTerms[0]}\u627f\u63a5`);
  return uniq(base.map(cleanTopicIdea).filter(Boolean), 4);
}

function benefitForRow(row) {
  const text = `${row.sub} ${row.scene}`;
  const rules = [
    [/清洁|扫地|洗地|家清|纸巾|洗衣|湿巾/, "省时省力、解放双手"],
    [/空冰洗|空调|冰箱|洗衣机|以旧换新|国补/, "高性价比焕新和省电省心"],
    [/厨房|小家电|轻食|速食|早餐|晚餐/, "省时间、低门槛和稳定出品"],
    [/厨卫|卫浴|装修|整装|局改/, "提升居住效率和减少装修踩坑"],
    [/寝具|助眠|床垫|枕头/, "改善睡眠质量和换季舒适感"],
    [/饮料|茶饮|咖啡|椰子水|电解质/, "清爽解腻、补水和低负担"],
    [/乳制品|牛奶|酸奶|蛋白/, "高蛋白、低负担和日常营养补充"],
    [/零食|坚果/, "好吃不踩雷、囤货方便和场景陪伴"],
    [/水果|生鲜/, "新鲜应季、口感可视化和健康分享"],
    [/敏感|修护|屏障/, "温和修护和降低换季不适"],
    [/抗老|精华|成分/, "成分可信、长期改善和抗老效率"],
    [/底妆|遮瑕|定妆/, "持妆稳定和真实肤质适配"],
    [/防晒|美白/, "通勤防护、户外安心和肤感舒适"],
    [/彩妆|香氛|唇妆/, "妆容氛围和礼赠表达"],
    [/内衣|家居服/, "舒适支撑和居家外穿自由"],
    [/防晒衣|户外/, "防晒防闷和通勤户外两穿"],
    [/运动鞋|运动鞋服|跑鞋/, "支撑舒适和轻运动效率"],
    [/国潮|中式|汉服|马面裙/, "日常化穿搭和文化氛围感"],
    [/箱包|配饰|腕表/, "通勤收纳、造型完成度和礼赠体面"],
    [/K12|学习|早教|辅导/, "提效减负和学习进步可视化"],
    [/考研|考公/, "备考陪伴、方法拆解和上岸信心"],
    [/餐饮|探店|团购/, "省钱好吃和本地生活决策效率"],
    [/旅行|出行|酒店|机票/, "省心规划和预算可控"],
    [/二手|回收|闲置/, "估价透明、低成本换新和降低交易顾虑"],
    [/母婴|奶粉|纸尿裤|童|亲子|儿童/, "安全安心和育儿减负"],
    [/AI|手机|电脑|数码|穿戴|耳机/, "效率提升、体验升级和决策避坑"]
  ];
  return rules.find(([re]) => re.test(text))?.[1] || "解决用户痛点和提升购买决策效率";
}

function strategyForRow(row, hotTitle, rowShop, topicIdeas) {
  const benefit = benefitForRow(row);
  const sceneText = hotTitle
    ? `结合「${hotTitle}」的讨论热度和「${row.scene}」场景`
    : `结合「${row.scene}」的日常场景`;
  const ideas = uniq(contentIdeasForRow(row), 3).join("、") || uniq(topicIdeas, 3).join("、") || `${row.sub}选购清单、真实体验对比`;
  const productText = rowShop ? `，用热销 SKU 做案例露出和卖点验证` : "";
  return `【重点】主打${benefit}的卖点，${sceneText}，输出「${ideas}」等内容创意；内容重点突出场景痛点、预算分层和真实体验，让${row.sub}的选择理由更具体${productText}。【投放】抖音首发，巨量引擎小额放大，巨量星图匹配垂类达人。`;
}

function categoryFocusLabels(catKey, rows, hotSignals) {
  const text = `${rows.map((row) => `${row.sub} ${row.scene} ${(row.hotTerms || []).join(" ")}`).join(" ")} ${hotSignals.map((item) => item.title).join(" ")}`;
  const banks = {
    C3: [[/AI|DeepSeek|大模型|算力|芯片/i, "AI技术"], [/游戏|王者|电竞|RTX/i, "游戏娱乐"], [/手机|iPhone|华为|小米/i, "换机决策"], [/影像|相机|大疆|Vlog/i, "影像创作"]],
    HOME: [[/装修|整装|局改|厨卫|卫浴/i, "局部改造"], [/收纳|软装|家居/i, "居家效率"], [/清洁|纸巾|洗衣/i, "家庭清洁"], [/助眠|床垫|寝具/i, "换季舒适"]],
    APPL: [[/清洁|扫地|洗地/i, "懒人清洁"], [/空调|冰箱|洗衣|国补|以旧换新/i, "家电焕新"], [/厨房|早餐|轻食/i, "厨房效率"], [/电视|影音|投影/i, "客厅娱乐"]],
    BABY: [[/安全|座椅|推车|儿童|宝宝|婴/i, "婴童安全防护"], [/纸尿裤|湿巾/i, "夏季护理"], [/奶粉|喂养/i, "科学喂养"], [/早教|学习/i, "成长学习"]],
    FOOD: [[/零食|肉干|坚果|蚂蚁/i, "零食安全与囤货"], [/饮料|茶饮|咖啡|椰子水|电解质/i, "饮品解暑与低负担"], [/乳制品|牛奶|酸奶|蛋白/i, "营养补充"], [/水果|生鲜|榴莲/i, "时令尝鲜"]],
    BEAU: [[/敏感|修护|屏障/i, "敏感肌修护"], [/抗老|精华|成分|视黄醇/i, "成分功效"], [/底妆|遮瑕|定妆/i, "持妆表现"], [/防晒|美白/i, "户外防护"]],
    CLOT: [[/穿搭|cleanfit|裙|国风|中式/i, "穿搭风格"], [/内衣|家居服/i, "舒适支撑"], [/防晒衣|户外/i, "防晒功能"], [/运动|跑鞋|瑜伽/i, "轻运动场景"]],
    EDU: [[/京东|美团|大众点评|团购|本地/i, "平台补贴与本地生活"], [/旅行|景区|酒店|机票|携程|飞猪/i, "旅行出行决策"], [/二手|回收|闲鱼|转转/i, "低成本换新"], [/学习|考研|考公|K12/i, "学习提效"]]
  };
  const labels = (banks[catKey] || [])
    .filter(([re]) => re.test(text))
    .map(([, label]) => label);
  return uniq(labels, 3);
}

function categoryConcern(catKey) {
  return {
    C3: "技术体验、娱乐效率与换机价值",
    HOME: "居住效率、空间改造与生活舒适度",
    APPL: "省时省力、焕新补贴与真实使用效果",
    BABY: "产品安全性、护理便利与成长陪伴",
    FOOD: "食品安全、低负担饮食和场景化囤货",
    BEAU: "成分功效、肤质适配和真实使用反馈",
    CLOT: "穿搭场景、舒适功能和风格表达",
    EDU: "平台服务效率、价格权益和决策风险"
  }[catKey] || "消费决策效率";
}

function categoryLead(cat, signalSet, rows) {
  const hotSignals = signalSet.hot || [];
  const labels = categoryFocusLabels(cat.key, rows, hotSignals);
  const focus = labels.length ? labels.join("、") : rows.slice(0, 3).map((row) => row.sub).join("、");
  const concern = categoryConcern(cat.key);
  if (hotSignals.length) {
    return `今日${cat.name}类热点集中在${focus}，用户对${concern}关注度提升，可绑定热点做场景化内容种草。`;
  }
  return `今日${cat.name}类暂无强热搜信号，内容可聚焦${focus}等常青场景，用具体卖点和选购清单承接搜索需求。`;
}

function fallbackRowsForCategory(cat, compact) {
  const signalSet = compact.categorySignals[cat.key] || { hot: [], shop: [], all: [] };
  const hotSignals = signalSet.hot || [];
  const shopSignals = signalSet.shop || [];
  const templates = fallbackPlaybook[cat.key] || [];
  const orderedTemplates = [...templates].sort((a, b) => rowScore(b, hotSignals) - rowScore(a, hotSignals));

  return orderedTemplates.slice(0, rowsPerCategory).map((row, index) => {
    const rowKeys = uniq([row.sub, ...row.topics], 20);
    const rowSignals = hotSignals.filter((item) => rowKeys.some((key) => item.title.includes(key)));
    const top = rowSignals[0];
    const pickedHotSignals = rowSignals;
    const hotTerms = uniq(pickedHotSignals.map((item) => item.title), 5);
    const topicIdeas = topicIdeasForRow(row, hotTerms);
    const rowShop = shopSignals.find((item) => rowKeys.some((key) => item.title.includes(key)));

    return {
      sub: row.sub,
      scene: pickedHotSignals[0] ? `${row.scene} | \u4eca\u65e5\u70ed\u70b9:${pickedHotSignals[0].title}` : row.scene,
      scenes: scenesForRow(row, hotTerms),
      hotTerms,
      topicIdeas,
      topics: topicIdeas,
      strategy: strategyForRow(row, pickedHotSignals[0]?.title, rowShop, topicIdeas)
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
      const topicIdeas = uniq(Array.isArray(row.topicIdeas) ? row.topicIdeas : Array.isArray(row.topics) ? row.topics : [], 5)
        .map(cleanTopicIdea)
        .filter(Boolean);
      const rowKeys = uniq([sub, ...hotTerms, ...topicIdeas], 20);
      const matchedHot = hotSignals.filter((item) => rowKeys.some((key) => key && item.title.includes(key)));
      const safeHotTerms = hotTerms.length ? hotTerms : uniq(matchedHot.map((item) => item.title), 5);
      const hotKeys = new Set(safeHotTerms.map(normalizeKey));
      const fallbackTopicIdeas = topicIdeas.length
        ? uniq(topicIdeas.filter((item) => !hotKeys.has(normalizeKey(item))), 5)
        : topicIdeasForRow({ sub, scene, topics: [] }, safeHotTerms);
      const safeTopicIdeas = fallbackTopicIdeas.length ? fallbackTopicIdeas : safeHotTerms;
      let strategy = highlightStrategy(row.strategy);
      const irrelevantHot = hotSignals.some((item) => {
        if (!item.title || item.title.length < 4) return false;
        if (matchedHot.some((hit) => hit.title === item.title)) return false;
        return strategy.includes(item.title);
      });
      if (irrelevantHot || isStrategyTooThin(strategy)) {
        const top = matchedHot[0];
        const rowShop = shopSignals.find((item) => rowKeys.some((key) => key && item.title.includes(key)));
        strategy = strategyForRow({ sub, scene, topics: safeTopicIdeas }, top?.title, rowShop, safeTopicIdeas);
      }
      const rawScenes = uniq(
        Array.isArray(row.scenes) && row.scenes.length
          ? row.scenes.map((item) => String(item || "").trim())
          : [scene],
        5
      ).filter(Boolean);
      const scenes = rawScenes.length >= 2 ? rawScenes.slice(0, 4) : scenesForRow({ sub, scene, topics: [] }, safeHotTerms);
      return { sub, scene, scenes, hotTerms: safeHotTerms, topicIdeas: safeTopicIdeas, topics: safeTopicIdeas, strategy };
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

  return {
    lead:
      inputCategory?.lead ||
      categoryLead(cat, signalSet, rows),
    bullets:
      Array.isArray(inputCategory?.bullets) && inputCategory.bullets.length
        ? inputCategory.bullets.slice(0, 4)
        : hotSignals.slice(0, 4).map((item) => `${item.sourceName}:${item.title}`),
    rows: rows.length ? rows : fallbackRows.slice(0, rowsPerCategory)
  };
}

function normalizeInsights(content, latest) {
  const compact = compactLatest(latest);
  const normalizeBrief = (brief, fallbackLead) => ({
    lead: brief?.lead || fallbackLead,
    bullets: Array.isArray(brief?.bullets) ? brief.bullets.slice(0, 4) : []
  });
  return {
    briefs: {
      hot: normalizeBrief(content?.briefs?.hot, "今日热搜 Brief 已按最新榜单生成。"),
      shop: normalizeBrief(content?.briefs?.shop, "今日热销 Brief 已按最新榜单生成。"),
      trend: normalizeBrief(content?.briefs?.trend, "今日趋势 Brief 已按最新榜单生成。"),
      cloud: normalizeBrief(content?.briefs?.cloud, "今日词云 Brief 已按最新榜单生成。"),
      marketing: normalizeBrief(content?.briefs?.marketing, "今日营销 Brief 已按最新榜单生成。")
    },
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

function briefSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["lead", "bullets"],
    properties: {
      lead: { type: "string" },
      bullets: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } }
    }
  };
}

function rowSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sub", "scene", "scenes", "hotTerms", "topicIdeas", "topics", "strategy"],
    properties: {
      sub: { type: "string" },
      scene: { type: "string" },
      scenes: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
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
  required: ["briefs", "summary", "categories"],
  properties: {
    briefs: {
      type: "object",
      additionalProperties: false,
      required: ["hot", "shop", "trend", "cloud", "marketing"],
      properties: {
        hot: briefSchema(),
        shop: briefSchema(),
        trend: briefSchema(),
        cloud: briefSchema(),
        marketing: briefSchema()
      }
    },
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
    "For each row: sub is the secondary category; scene is one concise marketing scenario generated from the hotspot insight and the subcategory. It must never be empty.",
    "scenes must contain 2-4 concise Chinese marketing scenario phrases generated by you for this subcategory, such as 换机降价促销, 亲子出行安全, 夏季清洁囤货, 熬夜修护测评. Do not copy generic fallback labels only.",
    "hotTerms must contain 0-5 short terms or short phrases from real hot-search data. Only include terms relevant to this row's subcategory. If there is no relevant hot-search signal for this row, return an empty hotTerms array instead of borrowing another row's hotspot.",
    "topicIdeas must contain 3-5 concrete Chinese content ideas that this subcategory can use directly. They should look like publishable topics, not abstract templates. Examples: 不同预算清洁家电选购清单, 520送另一半减负家电指南, 儿童零食安全成分避坑清单, 换季泛红修护日记, 人均50本地团购清单.",
    "topicIdeas must not simply repeat category words like iPhone, 洗衣液, 纸巾 unless they are part of a meaningful marketing topic phrase.",
    "topicIdeas must not duplicate hotTerms. If hotTerms has 手机集体大降价, topicIdeas should be like 换机党价格避坑 or 线下新机还值不值, not 手机集体大降价 again.",
    "Do not output mechanical suffixes or templates like 内容钩子, 场景种草, 话题钩子, 营销钩子, 人群痛点实测, 场景改造前后对比, 真实体验拆解, or 一周体验挑战.",
    "topics must equal topicIdeas for frontend compatibility.",
    "Use one unified playbook style for all eight categories: C3, HOME, APPL, BABY, FOOD, BEAU, CLOT, and EDU. The strategy style must match the complete BEAU/CLOT/EDU examples: concrete benefit, scenario, content ideas, budget layering, real experience, and ByteDance placement.",
    "EDU includes platform-economy rows such as 本地餐饮, 旅行出行, and 二手回收 when ranking signals support them. Keep these rows if relevant; do not replace them with only school/course categories.",
    "strategy must analyze category, hotspots, products, and topicIdeas. Write every strategy in this shape: 【重点】主打{具体利益点}的卖点，结合「{热点或场景}」的讨论热度/日常场景，输出「{3个topicIdeas}」等内容创意；内容重点突出场景痛点、预算分层和真实体验，让{sub}的选择理由更具体。若有相关商品信号，再补一句用热销 SKU 做案例露出和卖点验证。【投放】抖音首发，巨量引擎小额放大，巨量星图匹配垂类达人。",
    "Every strategy should be about 130-190 Chinese characters. Do not write short 70-100 character summaries. Do not output different strategy depths for different categories.",
    "The \u3010\u91cd\u70b9\u3011 part must include: main selling point, linked scenario/topic, concrete content ideas, budget layering, and real user experience. Do not write meta instructions such as 围绕热点拆出3条内容线, 先用热点解释降低理解门槛, 用人群痛点+产品场景做脚本, or 做常青内容.",
    "Use Chinese markers \u3010\u91cd\u70b9\u3011 and \u3010\u6295\u653e\u3011 only. Do not include a \u3010\u590d\u7528\u3011 section. The \u3010\u6295\u653e\u3011 part should be short, usually 1 sentence.",
    "strategy placement must only use ByteDance ecosystem channels: Douyin, Douyin Search, Douyin Ecommerce, Ocean Engine, 巨量引擎, 巨量星图, 字节品牌广告, 今日头条, 西瓜视频, 懂车帝, 红果短剧. Do not literally write \u201c\u4ec5\u9650\u5b57\u8282\u751f\u6001\u201d. Do not mention 小红书, B站, 知乎, 视频号, 京东, 天猫, 快手, 微信, or other non-ByteDance channels.",
    "Every row must stay within its own subcategory. If a subcategory has no relevant hot-search signal today, say it has no strong signal and write an evergreen small-budget test; do not borrow another subcategory hotspot.",
    "Return a valid JSON object only. No Markdown. No commentary.",
    "Top-level JSON must include briefs, summary, and categories. summary.rows must be an empty array.",
    "briefs must include five module briefs: hot, shop, trend, cloud, marketing. Each brief has lead and 2-4 bullets.",
    "briefs.hot explains today's hot-search attention structure. briefs.shop explains ecommerce/hot-selling product signals in the same editorial style as category leads, for example: 今日家居家装类目电商热销品以清洁纸品、洗护囤货为主，520节点带动礼赠相关品类销量上涨. Do not only list SKU titles.",
    "All module briefs must be written by you from the input data, in concise Chinese editorial style, and must not be generic placeholders.",
    "categories must include C3, HOME, APPL, BABY, FOOD, BEAU, CLOT, EDU.",
    "Each category lead must summarize the category like: 今日数码3C类热点集中在AI技术、游戏娱乐两大方向，可绑定热点做场景化种草. Or: 今日母婴类热点集中在婴童安全防护，家长对产品安全性关注度显著提升.",
    "Each category object includes lead, bullets, rows. bullets has at most 4 items; rows has exactly 5 items."
  ].join("\n");
}

function getLlmConfig() {
  const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error("VOLCENGINE_API_KEY or ARK_API_KEY is not set.");
  }

  const baseUrl = (
    process.env.VOLCENGINE_BASE_URL ||
    "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");
  const model = process.env.VOLCENGINE_MODEL || process.env.ARK_MODEL;
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
    temperature: 0.2
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

async function postJsonRepair({ apiKey, baseUrl, model, invalidText, errorMessage }) {
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: [
          "You repair malformed JSON.",
          "Return one valid JSON object only. No Markdown. No commentary.",
          "Preserve the same fields and Chinese content where possible.",
          "If arrays are malformed, fix commas or brackets. Do not add new analysis."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          parseError: errorMessage,
          requiredTopLevelKeys: ["summary", "categories"],
          invalidJsonText: invalidText
        })
      }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  };

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

  let res = await postChatCompletion({ apiKey, baseUrl, model, input, responseFormat: process.env.LLM_RESPONSE_FORMAT || "json_object" });
  let bodyText = await res.text();

  if (process.env.LLM_RESPONSE_FORMAT !== "json_schema" && !res.ok && res.status === 400 && /json_object/i.test(bodyText)) {
    res = await postChatCompletion({ apiKey, baseUrl, model, input });
    bodyText = await res.text();
  }

  if (process.env.LLM_RESPONSE_FORMAT === "json_schema" && !res.ok && res.status === 400 && /response_format|json_schema/i.test(bodyText)) {
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

  const jsonText = extractJsonText(outputText);
  try {
    return {
      model,
      generatedAt: new Date().toISOString(),
      content: normalizeInsights(JSON.parse(jsonText), latest)
    };
  } catch (error) {
    console.warn(`Retrying after invalid LLM JSON: ${error.message}`);

    try {
      const repairRes = await postJsonRepair({
        apiKey,
        baseUrl,
        model,
        invalidText: jsonText,
        errorMessage: error.message
      });
      const repairBody = await repairRes.text();
      if (!repairRes.ok) {
        throw new Error(`JSON repair API ${repairRes.status}: ${repairBody}`);
      }
      const repairResponse = JSON.parse(repairBody);
      const repairedText = repairResponse.choices?.[0]?.message?.content || extractOutputText(repairResponse);
      if (!repairedText) throw new Error("JSON repair returned no output text");
      return {
        model,
        generatedAt: new Date().toISOString(),
        content: normalizeInsights(JSON.parse(extractJsonText(repairedText)), latest)
      };
    } catch (repairError) {
      console.warn(`Falling back after invalid LLM JSON repair: ${repairError.message}`);
      if (process.env.REQUIRE_LLM === "1") {
        throw new Error(`LLM returned invalid JSON: ${error.message}; repair failed: ${repairError.message}`);
      }
      return fallbackInsights(latest, `LLM returned invalid JSON: ${error.message}; repair failed: ${repairError.message}`);
    }
  }
}

function topModuleItems(compact, kind) {
  const items = [];
  for (const cat of categories) {
    const signalSet = compact.categorySignals[cat.key] || { hot: [], shop: [] };
    const source = kind === "shop" ? signalSet.shop || [] : signalSet.hot || [];
    for (const item of source) items.push({ ...item, catName: cat.name });
  }
  return items.sort((a, b) => b.metricValue - a.metricValue);
}

function shopNodeCue(items) {
  const text = items.map((item) => item.title).join(" ");
  if (/520|情人|礼物|送|礼赠|鲜花|情侣|另一半/.test(text)) return "520节点带动礼赠相关品类销量上涨";
  if (/618|年中|大促|补贴|券|到手价|降价/.test(text)) return "大促补贴带动价格敏感型商品转化升温";
  if (/儿童节|六一|宝宝|儿童|亲子/.test(text)) return "亲子节点带动儿童与家庭场景商品走强";
  if (/夏|防晒|清凉|冰|空调|风扇|凉感|解暑/.test(text)) return "夏季场景带动清凉、防晒与解暑相关商品走强";
  if (/国补|以旧换新|换新/.test(text)) return "以旧换新政策带动大件耐用品需求释放";
  return "节点消费与日常囤货需求共同带动热销品类放量";
}

function shopFocusForCategory(catKey, signalSet) {
  const shopItems = signalSet.shop || [];
  const rows = fallbackPlaybook[catKey] || [];
  const scored = rows.map((row) => ({
    label: row.sub,
    score: shopItems.reduce((sum, item) => {
      const keys = [row.sub, ...(row.topics || [])];
      return sum + (keys.some((key) => item.title.includes(key)) ? Math.log10((item.metricValue || 1) + 10) : 0);
    }, 0)
  })).filter((row) => row.score > 0);
  const labels = scored.sort((a, b) => b.score - a.score).map((row) => row.label);
  return uniq(labels.length ? labels : rows.slice(0, 3).map((row) => row.sub), 3);
}

function shopInsightLead(compact, catKey = "ALL") {
  if (catKey !== "ALL") {
    const cat = categories.find((item) => item.key === catKey);
    const signalSet = compact.categorySignals[catKey] || { shop: [] };
    const focus = shopFocusForCategory(catKey, signalSet).join("、");
    const cue = shopNodeCue(signalSet.shop || []);
    return `今日${cat?.name || ""}类目电商热销品以${focus}为主，${cue}。`;
  }
  const scoredCats = categories.map((cat) => {
    const signalSet = compact.categorySignals[cat.key] || { shop: [] };
    return {
      cat,
      count: (signalSet.shop || []).length,
      focus: shopFocusForCategory(cat.key, signalSet)
    };
  }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  const focus = scoredCats.slice(0, 3).map((item) => item.focus[0] || item.cat.name).filter(Boolean).join("、");
  const allShopItems = scoredCats.flatMap((item) => compact.categorySignals[item.cat.key]?.shop || []);
  return `今日全品类电商热销品以${focus || "高频刚需商品"}为主，${shopNodeCue(allShopItems)}。`;
}

function topModuleLead(compact, kind) {
  const items = topModuleItems(compact, kind);
  const top = items[0];
  if (!top) return kind === "shop" ? "今日电商侧暂无明显热销商品信号。" : "今日热搜侧暂无明显热点信号。";
  return kind === "shop"
    ? shopInsightLead(compact)
    : `今日热搜侧识别到 ${items.length} 条消费品相关热点,最高热度来自「${top.title}」。`;
}

function topModuleBullets(compact, kind) {
  return topModuleItems(compact, kind)
    .slice(0, 4)
    .map((item) => `${item.catName}:${item.sourceName}:${item.title}`);
}

function fallbackInsights(latest, reason) {
  const compact = compactLatest(latest);
  const makeCategory = (cat) => {
    const signalSet = compact.categorySignals[cat.key] || { hot: [], shop: [], all: [] };
    const hotSignals = signalSet.hot || [];
    const rows = fallbackRowsForCategory(cat, compact);
    const lead = categoryLead(cat, signalSet, rows);
    return {
      lead,
      bullets: hotSignals.slice(0, 3).map((item) => `${item.sourceName}:${item.title}`),
      rows
    };
  };

  return {
    model: "fallback",
    generatedAt: new Date().toISOString(),
    fallbackReason: reason,
    content: {
      briefs: {
        hot: {
          lead: topModuleLead(compact, "hot"),
          bullets: topModuleBullets(compact, "hot")
        },
        shop: {
          lead: topModuleLead(compact, "shop"),
          bullets: topModuleBullets(compact, "shop")
        },
        trend: {
          lead: "LLM 趋势 Brief 暂不可用,当前使用跨平台共振与历史榜单规则兜底。",
          bullets: ["观察跨平台共振词", "对比热搜与电商 SKU 密度", "结合新晋与退榜商品识别货架变化"]
        },
        cloud: {
          lead: "LLM 词云 Brief 暂不可用,当前使用话题词与商品词规则兜底。",
          bullets: ["话题词反映舆论注意力", "商品词反映可转化卖点", "两侧重合处优先做内容承接"]
        },
        marketing: {
          lead: "LLM 营销 Brief 暂不可用,当前使用规则兜底生成内容型营销 playbook。",
          bullets: ["策略以内容创意为主", "每个二级品类保留 2-4 个营销场景", "话题词与热点词去重"]
        }
      },
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
