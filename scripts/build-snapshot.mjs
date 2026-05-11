import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");

const SOURCES = {
  TWSE: "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
  TPEX: "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes?l=zh-tw",
  BOT: "https://rate.bot.com.tw/xrt/flcsv/0/day?Lang=en-US",
  STOOQ: "https://stooq.com/q/l/"
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const watchlist = await readWatchlist();
  const [twse, tpex, fx, us] = await Promise.all([
    fetchTwse(),
    fetchTpex(),
    fetchUsdTwd(),
    fetchUsQuotes(watchlist.us || [])
  ]);

  const quotes = dedupeQuotes([...twse.quotes, ...tpex.quotes, ...us.quotes]);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    quotes,
    fx: fx.fx,
    sources: {
      TWSE: twse.source,
      TPEX: tpex.source,
      STOOQ: us.source,
      BOT: fx.source
    }
  };

  validateSnapshot(snapshot);
  await buildDist(snapshot);
  console.log(`Built ${path.relative(root, distDir)} with ${quotes.length} quotes.`);
}

async function readWatchlist() {
  const file = path.join(root, "assets", "watchlist.json");
  return JSON.parse(await readFile(file, "utf8"));
}

async function fetchTwse() {
  try {
    const rows = await fetchJson(SOURCES.TWSE);
    const quotes = rows
      .map((row) => {
        const price = parseNumber(row.ClosingPrice);
        const change = parseNumber(row.Change);
        const previousClose = price != null && change != null ? round(price - change) : null;
        return {
          market: "TWSE",
          symbol: clean(row.Code),
          name: clean(row.Name),
          currency: "TWD",
          open: parseNumber(row.OpeningPrice),
          high: parseNumber(row.HighestPrice),
          low: parseNumber(row.LowestPrice),
          price,
          previousClose,
          change,
          changePercent: percent(change, previousClose),
          asOf: parseTaiwanDate(row.Date),
          source: "TWSE STOCK_DAY_ALL",
          status: price == null ? "partial" : "ok",
          volume: parseNumber(row.TradeVolume),
          turnover: parseNumber(row.TradeValue)
        };
      })
      .filter((item) => item.symbol && item.price != null);
    return ok("TWSE", quotes, SOURCES.TWSE);
  } catch (error) {
    return failed("TWSE", SOURCES.TWSE, error);
  }
}

async function fetchTpex() {
  try {
    const rows = await fetchJson(SOURCES.TPEX);
    const quotes = rows
      .filter((row) => isRegularTpexSecurity(clean(row.SecuritiesCompanyCode)))
      .map((row) => {
        const price = parseNumber(row.Close);
        const change = parseNumber(row.Change);
        const previousClose = price != null && change != null ? round(price - change) : null;
        return {
          market: "TPEX",
          symbol: clean(row.SecuritiesCompanyCode),
          name: clean(row.CompanyName),
          currency: "TWD",
          open: parseNumber(row.Open),
          high: parseNumber(row.High),
          low: parseNumber(row.Low),
          price,
          previousClose,
          change,
          changePercent: percent(change, previousClose),
          asOf: parseTaiwanDate(row.Date),
          source: "TPEx daily close",
          status: price == null ? "partial" : "ok",
          volume: parseNumber(row.TradingShares),
          turnover: parseNumber(row.TransactionAmount)
        };
      })
      .filter((item) => item.symbol && item.price != null);
    return ok("TPEX", quotes, SOURCES.TPEX);
  } catch (error) {
    return failed("TPEX", SOURCES.TPEX, error);
  }
}

async function fetchUsQuotes(symbols) {
  const quotes = [];
  const errors = [];
  const uniqueSymbols = [...new Set(symbols.map((item) => clean(item).replace(/\.US$/i, "").toUpperCase()).filter(Boolean))];

  for (const symbol of uniqueSymbols) {
    try {
      const url = `${SOURCES.STOOQ}?s=${encodeURIComponent(`${symbol.toLowerCase()}.us`)}&f=sd2t2ohlcvnp&h&e=csv`;
      const csv = await fetchText(url);
      const rows = parseCsv(csv);
      const row = rows[0];
      if (!row || row.Date === "N/D") throw new Error(`No Stooq quote for ${symbol}`);
      const price = parseNumber(row.Close);
      const previousClose = parseNumber(row.Prev);
      const change = price != null && previousClose != null ? round(price - previousClose) : null;
      quotes.push({
        market: "US",
        symbol,
        name: clean(row.Name) || symbol,
        currency: "USD",
        open: parseNumber(row.Open),
        high: parseNumber(row.High),
        low: parseNumber(row.Low),
        price,
        previousClose,
        change,
        changePercent: percent(change, previousClose),
        asOf: clean(`${row.Date || ""} ${row.Time || ""}`).trim(),
        source: "Stooq quote CSV",
        status: price == null ? "partial" : "ok",
        volume: parseNumber(row.Volume),
        turnover: price != null && parseNumber(row.Volume) != null ? round(price * parseNumber(row.Volume), 2) : null
      });
      await wait(150);
    } catch (error) {
      errors.push(`${symbol}: ${error.message}`);
    }
  }

  const status = errors.length && quotes.length ? "partial" : errors.length ? "error" : "ok";
  return {
    quotes,
    source: {
      status,
      count: quotes.length,
      url: SOURCES.STOOQ,
      message: errors.length ? errors.slice(0, 4).join("; ") : "OK"
    }
  };
}

async function fetchUsdTwd() {
  try {
    const csv = await fetchText(SOURCES.BOT);
    const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
    const usd = rows.find((row) => row.Currency === "USD");
    if (!usd) throw new Error("USD row missing");
    const buy = parseNumber(usd.Spot);
    const sell = parseNumber(usd.SellingSpot || usd.Spot_2 || usd["Spot.1"]);
    const rate = buy != null && sell != null ? round((buy + sell) / 2, 4) : buy;
    if (rate == null) throw new Error("USD spot rate missing");
    return {
      fx: {
        USDTWD: rate,
        asOf: new Date().toISOString(),
        source: "Bank of Taiwan flcsv",
        status: "ok"
      },
      source: {
        status: "ok",
        count: 1,
        url: SOURCES.BOT,
        message: "OK"
      }
    };
  } catch (error) {
    return {
      fx: {
        USDTWD: 31,
        asOf: new Date().toISOString(),
        source: "Fallback",
        status: "error"
      },
      source: {
        status: "error",
        count: 0,
        url: SOURCES.BOT,
        message: error.message
      }
    };
  }
}

async function buildDist(snapshot) {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "data"), { recursive: true });
  await cp(path.join(root, "index.html"), path.join(distDir, "index.html"));
  await cp(path.join(root, "assets"), path.join(distDir, "assets"), { recursive: true });
  await writeFile(path.join(distDir, ".nojekyll"), "");
  await writeFile(path.join(distDir, "data", "market-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "stock-market-dashboard/1.0 (+https://github.com/)"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      const key = uniqueHeader(header, row);
      row[key] = values[index] ?? "";
    });
    mapBotDuplicateHeaders(row);
    return row;
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function uniqueHeader(header, row) {
  if (!(header in row)) return header;
  let suffix = 2;
  while (`${header}_${suffix}` in row) suffix += 1;
  return `${header}_${suffix}`;
}

function mapBotDuplicateHeaders(row) {
  if (row.Rate_2 === "Selling") {
    row.SellingCash = row.Cash_2;
    row.SellingSpot = row.Spot_2;
  }
}

function ok(name, quotes, url) {
  return {
    quotes,
    source: {
      status: "ok",
      count: quotes.length,
      url,
      message: "OK"
    }
  };
}

function failed(name, url, error) {
  return {
    quotes: [],
    source: {
      status: "error",
      count: 0,
      url,
      message: error.message
    }
  };
}

function dedupeQuotes(quotes) {
  const map = new Map();
  for (const item of quotes) {
    if (!item.symbol || item.price == null) continue;
    map.set(`${item.market}:${item.symbol}`, item);
  }
  return [...map.values()].sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
}

function validateSnapshot(snapshot) {
  if (!snapshot.generatedAt) throw new Error("generatedAt is required");
  if (!Array.isArray(snapshot.quotes)) throw new Error("quotes must be an array");
  if (!snapshot.fx?.USDTWD) throw new Error("fx.USDTWD is required");
  for (const item of snapshot.quotes) {
    for (const key of ["market", "symbol", "name", "currency", "price", "source", "status"]) {
      if (item[key] == null || item[key] === "") throw new Error(`quote ${item.market}:${item.symbol} missing ${key}`);
    }
  }
}

function isRegularTpexSecurity(symbol) {
  if (!symbol) return false;
  if (/^7\d{5}$/.test(symbol)) return false;
  if (/^[0-9]{4}$/.test(symbol)) return true;
  if (/^[0-9]{5,6}[A-Z]$/.test(symbol)) return true;
  return /^[0-9]{5}$/.test(symbol);
}

function parseTaiwanDate(value) {
  const raw = clean(value);
  if (/^\d{7}$/.test(raw)) {
    const year = Number(raw.slice(0, 3)) + 1911;
    return `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`;
  }
  const slash = raw.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const year = Number(slash[1]) + 1911;
    return `${year}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  }
  return raw;
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = clean(value).replace(/,/g, "");
  if (!cleaned || cleaned === "---" || cleaned === "N/D") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function percent(change, previousClose) {
  if (change == null || !previousClose) return null;
  return round((change / previousClose) * 100, 4);
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clean(value) {
  return String(value ?? "").trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
