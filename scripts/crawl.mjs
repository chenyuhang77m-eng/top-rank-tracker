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
    selectedNodeIds: ["1", "2", "140", "38", "69"]
  },
  {
    category: "shopping",
    categoryName: "热销榜",
    url: "https://tophub.today/c/shopping",
    selectedNodeIds: ["5666", "5667", "26696", "8928", "5662"]
  }
];

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

  return items.slice(0, 20);
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
    return items.slice(0, 20);
  }

  return parseNewsItems(block);
}

async function crawlSource(source) {
  const html = await fetchHtml(source.url);
  const selected = new Set(source.selectedNodeIds);
  const blocks = getNodeBlocks(html).filter((block) => selected.has(block.nodeId));

  return blocks.map((block) => {
    const meta = parseCardMeta(block.html);
    const items =
      source.category === "shopping"
        ? parseShoppingItems(block.html)
        : parseNewsItems(block.html);

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
  const lists = (await Promise.all(sources.map(crawlSource))).flat();

  const payload = {
    date,
    capturedAt,
    sourceSite: "https://tophub.today",
    lists
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(path.join(dataDir, `${date}.json`), json, "utf8");
  await fs.writeFile(path.join(dataDir, "latest.json"), json, "utf8");

  const totalItems = lists.reduce((sum, list) => sum + list.itemCount, 0);
  console.log(`Captured ${lists.length} lists and ${totalItems} items for ${date}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
