(() => {
  const STORE_KEY = "stock-dashboard:portfolio:v2";
  const LEGACY_STORE_KEY = "stock-dashboard:portfolio:v1";
  const SNAPSHOT_URL = "data/market-snapshot.json";

  const DEFAULT_SETTINGS = {
    displayCurrency: "TWD",
    sortMode: "marketValue",
    theme: "light",
    strategyMarket: "ALL",
    strategyPreset: "momentum",
    autoScan: true,
    showQualifiedOnly: true,
    virtualCash: 1000000,
    orderBudgetPct: 10,
    maxOrders: 5,
    minTurnoverTwd: 10000000,
    stopLossPct: 6,
    takeProfitPct: 12
  };

  const SAMPLE_SNAPSHOT = {
    generatedAt: "2026-05-11T17:00:00.000Z",
    quotes: [
      sampleQuote("TWSE", "0050", "元大台灣50", "TWD", 96.2, 97.7, 97, 95.8, 97.0, 131188123, "2026-05-08"),
      sampleQuote("TWSE", "2330", "台積電", "TWD", 1185, 1205, 1198, 1175, 1195, 38240155, "2026-05-08"),
      sampleQuote("TWSE", "2317", "鴻海", "TWD", 148, 151, 152, 147, 149.5, 75601422, "2026-05-08"),
      sampleQuote("TPEX", "00679B", "元大美債20年", "TWD", 26.69, 26.71, 26.75, 26.68, 26.7, 31453075, "2026-05-11"),
      sampleQuote("US", "AAPL", "APPLE INC", "USD", 284.0, 280.0, 293.88, 283.2, 291.15, 14742245, "2026-05-11"),
      sampleQuote("US", "MSFT", "MICROSOFT CORP", "USD", 514.5, 514.86, 518.25, 511.9, 515.36, 21124000, "2026-05-11"),
      sampleQuote("US", "NVDA", "NVIDIA CORP", "USD", 197.2, 198.2, 200.4, 196.7, 199.11, 40251000, "2026-05-11"),
      sampleQuote("US", "SPY", "SPDR S&P 500 ETF", "USD", 680.8, 680.8, 683.2, 679.4, 682.1, 65000110, "2026-05-11")
    ],
    fx: { USDTWD: 31.405, asOf: "2026-05-11", source: "Bank of Taiwan flcsv", status: "mock" },
    sources: {
      TWSE: { status: "mock", count: 3, message: "Bundled sample data" },
      TPEX: { status: "mock", count: 1, message: "Bundled sample data" },
      STOOQ: { status: "mock", count: 4, message: "Bundled sample data" },
      BOT: { status: "mock", count: 1, message: "Bundled sample data" }
    }
  };

  const elements = {
    snapshotTime: document.getElementById("snapshotTime"),
    fxRate: document.getElementById("fxRate"),
    loadStatus: document.getElementById("loadStatus"),
    totalValue: document.getElementById("totalValue"),
    totalCost: document.getElementById("totalCost"),
    totalPnl: document.getElementById("totalPnl"),
    totalPnlPercent: document.getElementById("totalPnlPercent"),
    paperExposure: document.getElementById("paperExposure"),
    sourceList: document.getElementById("sourceList"),
    form: document.getElementById("positionForm"),
    formTitle: document.getElementById("formTitle"),
    formMessage: document.getElementById("formMessage"),
    marketInput: document.getElementById("marketInput"),
    symbolInput: document.getElementById("symbolInput"),
    quantityInput: document.getElementById("quantityInput"),
    averageCostInput: document.getElementById("averageCostInput"),
    currencyInput: document.getElementById("currencyInput"),
    noteInput: document.getElementById("noteInput"),
    submitPosition: document.getElementById("submitPosition"),
    cancelEdit: document.getElementById("cancelEdit"),
    resetForm: document.getElementById("resetForm"),
    portfolioRows: document.getElementById("portfolioRows"),
    emptyPortfolio: document.getElementById("emptyPortfolio"),
    quoteRows: document.getElementById("quoteRows"),
    emptyQuotes: document.getElementById("emptyQuotes"),
    quoteSearch: document.getElementById("quoteSearch"),
    sortMode: document.getElementById("sortMode"),
    displayCurrency: document.getElementById("displayCurrency"),
    themeToggle: document.getElementById("themeToggle"),
    exportPortfolio: document.getElementById("exportPortfolio"),
    importPortfolio: document.getElementById("importPortfolio"),
    importFile: document.getElementById("importFile"),
    strategyMarket: document.getElementById("strategyMarket"),
    strategyPreset: document.getElementById("strategyPreset"),
    virtualCash: document.getElementById("virtualCash"),
    orderBudgetPct: document.getElementById("orderBudgetPct"),
    maxOrders: document.getElementById("maxOrders"),
    minTurnoverTwd: document.getElementById("minTurnoverTwd"),
    stopLossPct: document.getElementById("stopLossPct"),
    takeProfitPct: document.getElementById("takeProfitPct"),
    autoScan: document.getElementById("autoScan"),
    showQualifiedOnly: document.getElementById("showQualifiedOnly"),
    scanStrategy: document.getElementById("scanStrategy"),
    autoPaperTrade: document.getElementById("autoPaperTrade"),
    clearPaperOrders: document.getElementById("clearPaperOrders"),
    scannerMessage: document.getElementById("scannerMessage"),
    scannerRows: document.getElementById("scannerRows"),
    emptyScanner: document.getElementById("emptyScanner"),
    paperOrderRows: document.getElementById("paperOrderRows"),
    emptyPaperOrders: document.getElementById("emptyPaperOrders"),
    exportPaperOrders: document.getElementById("exportPaperOrders")
  };

  let appState = loadState();
  let snapshot = SAMPLE_SNAPSHOT;
  let quoteIndex = new Map();
  let editingId = null;
  let marketFilter = "ALL";
  let scannerResults = [];

  init();

  async function init() {
    syncInputsFromState();
    bindEvents();
    render();
    await loadSnapshot();
    if (appState.settings.autoScan) runDataScan("auto", false);
    render();
  }

  function bindEvents() {
    elements.form.addEventListener("submit", savePosition);
    elements.marketInput.addEventListener("change", setDefaultCurrency);
    elements.resetForm.addEventListener("click", clearForm);
    elements.cancelEdit.addEventListener("click", clearForm);
    elements.sortMode.addEventListener("change", () => updateSetting("sortMode", elements.sortMode.value));
    elements.displayCurrency.addEventListener("change", () => updateSetting("displayCurrency", elements.displayCurrency.value));
    elements.themeToggle.addEventListener("click", toggleTheme);
    elements.exportPortfolio.addEventListener("click", exportPortfolio);
    elements.importPortfolio.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", importPortfolio);
    elements.quoteSearch.addEventListener("input", renderQuotes);
    elements.scanStrategy.addEventListener("click", scanStrategy);
    elements.autoPaperTrade.addEventListener("click", autoPaperTrade);
    elements.clearPaperOrders.addEventListener("click", clearPaperOrders);
    elements.exportPaperOrders.addEventListener("click", exportPaperOrders);

    [
      "strategyMarket",
      "strategyPreset",
      "virtualCash",
      "orderBudgetPct",
      "maxOrders",
      "minTurnoverTwd",
      "stopLossPct",
      "takeProfitPct",
      "autoScan",
      "showQualifiedOnly"
    ].forEach((id) => {
      elements[id].addEventListener("change", () => {
        readStrategyConfig();
        persist();
        if (appState.settings.autoScan || id === "showQualifiedOnly") {
          runDataScan("auto");
        }
      });
    });

    document.querySelectorAll("[data-market-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        marketFilter = button.dataset.marketFilter;
        document.querySelectorAll("[data-market-filter]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });
        renderQuotes();
      });
    });
  }

  async function loadSnapshot() {
    try {
      if (window.location.protocol === "file:") {
        snapshot = SAMPLE_SNAPSHOT;
        setLoadStatus("mock", "使用內建範例資料");
      } else {
        const response = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        snapshot = await response.json();
        setLoadStatus(snapshotStatus(snapshot), "資料已更新");
      }
    } catch (error) {
      snapshot = SAMPLE_SNAPSHOT;
      setLoadStatus("partial", `讀取快照失敗，改用範例資料：${error.message}`);
    }
    buildQuoteIndex();
  }

  function render() {
    buildQuoteIndex();
    renderStatus();
    renderSummary();
    renderScanner();
    renderPaperOrders();
    renderPortfolio();
    renderQuotes();
  }

  function buildQuoteIndex() {
    quoteIndex = new Map();
    for (const item of snapshot.quotes || []) {
      const market = normalizeMarket(item.market);
      const symbol = normalizeSymbol(market, item.symbol);
      const normalized = { ...item, market, symbol };
      quoteIndex.set(`${market}:${symbol}`, normalized);
      if (market === "US") quoteIndex.set(`${market}:${symbol}.US`, normalized);
    }
  }

  function renderStatus() {
    elements.snapshotTime.textContent = formatDateTime(snapshot.generatedAt);
    elements.fxRate.textContent = snapshot.fx?.USDTWD ? number(snapshot.fx.USDTWD, 4) : "--";
    const sources = snapshot.sources || {};
    elements.sourceList.innerHTML = ["TWSE", "TPEX", "STOOQ", "BOT"]
      .map((name) => {
        const source = sources[name] || { status: "neutral", count: 0, message: "No data" };
        return `
          <div class="source-item">
            <span class="badge ${safeClass(source.status)}">${escapeHtml(source.status || "unknown")}</span>
            <div>
              <strong>${escapeHtml(sourceLabel(name))}</strong>
              <small>${escapeHtml(source.message || "OK")}</small>
            </div>
            <small>${Number(source.count || 0).toLocaleString("zh-TW")} 筆</small>
          </div>
        `;
      })
      .join("");
  }

  function renderSummary() {
    const displayCurrency = appState.settings.displayCurrency;
    const rows = appState.positions.map(positionMetrics);
    const totalValue = sum(rows.map((row) => row.valueDisplay));
    const totalCost = sum(rows.map((row) => row.costDisplay));
    const totalPnl = totalValue - totalCost;
    const pnlPercent = totalCost ? (totalPnl / totalCost) * 100 : null;
    const exposureTwd = paperExposureTwd();
    const exposureDisplay = convert(exposureTwd, "TWD", displayCurrency);

    elements.totalValue.textContent = money(totalValue, displayCurrency);
    elements.totalCost.textContent = money(totalCost, displayCurrency);
    elements.totalPnl.textContent = money(totalPnl, displayCurrency);
    elements.totalPnl.className = toneClass(totalPnl);
    elements.totalPnlPercent.textContent = pnlPercent === null ? "--" : `${number(pnlPercent, 2)}%`;
    elements.totalPnlPercent.className = toneClass(totalPnl);
    elements.paperExposure.textContent = money(exposureDisplay, displayCurrency);
  }

  function renderScanner() {
    elements.emptyScanner.hidden = scannerResults.length > 0;
    elements.scannerRows.innerHTML = scannerResults
      .map((item, index) => `
        <tr>
          <td><strong>${number(item.score, 1)}</strong></td>
          <td class="symbol-cell">
            <strong>${escapeHtml(item.quote.symbol)}</strong>
            <small>${escapeHtml(marketLabel(item.quote.market))} · ${escapeHtml(item.quote.name || "")}</small>
          </td>
          <td>${money(item.quote.price, item.quote.currency)}</td>
          <td><span class="badge ${item.signal === "BUY" ? "ok" : "neutral"}">${escapeHtml(item.signal)}</span></td>
          <td>${money(convert(item.turnoverTwd, "TWD", appState.settings.displayCurrency), appState.settings.displayCurrency)}</td>
          <td class="reason-cell">${escapeHtml(item.reason)}</td>
          <td><button class="small-button" data-paper-index="${index}" type="button">模擬買入</button></td>
        </tr>
      `)
      .join("");

    elements.scannerRows.querySelectorAll("[data-paper-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = scannerResults[Number(button.dataset.paperIndex)];
        const result = createPaperOrder(item);
        showScannerMessage(result.message, !result.created);
        renderSummary();
        renderPaperOrders();
      });
    });
  }

  function renderPaperOrders() {
    const orders = [...appState.paperOrders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    elements.emptyPaperOrders.hidden = orders.length > 0;
    elements.paperOrderRows.innerHTML = orders
      .map((order) => {
        const current = getQuote(order.market, order.symbol);
        const pnlTwd = order.status === "open" && current?.price
          ? convert((current.price - order.price) * order.quantity, order.currency, "TWD")
          : order.pnlTwd;
        return `
          <tr>
            <td><small>${escapeHtml(formatDateTime(order.createdAt))}</small></td>
            <td class="symbol-cell">
              <strong>${escapeHtml(order.symbol)}</strong>
              <small>${escapeHtml(marketLabel(order.market))} · ${escapeHtml(order.name || "")}</small>
            </td>
            <td>${escapeHtml(strategyLabel(order.strategy))}</td>
            <td><span class="badge ok">${escapeHtml(order.side)}</span></td>
            <td>${number(order.quantity, order.market === "US" ? 4 : 0)}</td>
            <td>${money(order.price, order.currency)}</td>
            <td>
              <span class="negative">${money(order.stopPrice, order.currency)}</span>
              <span class="subtle"> / </span>
              <span class="positive">${money(order.targetPrice, order.currency)}</span>
            </td>
            <td>
              <span class="badge ${order.status === "open" ? "partial" : "neutral"}">${escapeHtml(statusLabel(order.status))}</span>
              <small class="${toneClass(pnlTwd || 0)}">${pnlTwd == null ? "" : money(convert(pnlTwd, "TWD", appState.settings.displayCurrency), appState.settings.displayCurrency)}</small>
            </td>
            <td>
              <div class="row-actions">
                <button class="small-button" data-order-action="convert" data-id="${order.id}" type="button">轉持股</button>
                <button class="small-button" data-order-action="close" data-id="${order.id}" type="button">平倉</button>
                <button class="small-button danger" data-order-action="delete" data-id="${order.id}" type="button">刪除</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    elements.paperOrderRows.querySelectorAll("[data-order-action]").forEach((button) => {
      button.addEventListener("click", () => handleOrderAction(button.dataset.orderAction, button.dataset.id));
    });
  }

  function renderPortfolio() {
    const rows = appState.positions.map(positionMetrics).sort(sortPositions);
    elements.emptyPortfolio.hidden = rows.length > 0;
    elements.portfolioRows.innerHTML = rows
      .map((row) => {
        const quoteStatus = row.quote ? row.quote.status : "missing";
        const priceText = row.quote?.price == null ? "--" : money(row.quote.price, row.quote.currency);
        const changeText = row.quote?.changePercent == null ? "--" : `${number(row.quote.changePercent, 2)}%`;
        return `
          <tr>
            <td class="symbol-cell">
              <strong>${escapeHtml(row.position.symbol)}</strong>
              <small>${escapeHtml(row.marketLabel)} · ${escapeHtml(row.quote?.name || row.position.note || "未找到快照")}</small>
            </td>
            <td>
              <strong>${priceText}</strong>
              <small class="${toneClass(row.quote?.change || 0)}">${changeText}</small>
            </td>
            <td>${number(row.position.quantity, 4)}</td>
            <td>${money(row.costDisplay, appState.settings.displayCurrency)}</td>
            <td>${money(row.valueDisplay, appState.settings.displayCurrency)}</td>
            <td>
              <strong class="${toneClass(row.pnlDisplay)}">${money(row.pnlDisplay, appState.settings.displayCurrency)}</strong>
              <small class="${toneClass(row.pnlDisplay)}">${row.pnlPercent === null ? "--" : `${number(row.pnlPercent, 2)}%`}</small>
            </td>
            <td class="${toneClass(row.dayChangeDisplay)}">${money(row.dayChangeDisplay, appState.settings.displayCurrency)}</td>
            <td>
              <div class="row-actions">
                <button class="small-button" data-action="edit" data-id="${row.position.id}" type="button">編輯</button>
                <button class="small-button danger" data-action="delete" data-id="${row.position.id}" type="button">刪除</button>
              </div>
              <small class="badge ${quoteStatus === "missing" ? "neutral" : safeClass(quoteStatus)}">${escapeHtml(quoteStatus)}</small>
            </td>
          </tr>
        `;
      })
      .join("");

    elements.portfolioRows.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "edit") editPosition(button.dataset.id);
        if (button.dataset.action === "delete") deletePosition(button.dataset.id);
      });
    });
  }

  function renderQuotes() {
    const query = elements.quoteSearch.value.trim().toUpperCase();
    const rows = (snapshot.quotes || [])
      .filter((item) => item.price != null)
      .filter((item) => marketFilter === "ALL" || normalizeMarket(item.market) === marketFilter)
      .filter((item) => {
        if (!query) return isFeatured(item) || appState.positions.some((pos) => isSameQuote(pos, item));
        return `${item.symbol} ${item.name}`.toUpperCase().includes(query);
      })
      .sort((a, b) => normalizeMarket(a.market).localeCompare(normalizeMarket(b.market)) || String(a.symbol).localeCompare(String(b.symbol)))
      .slice(0, query ? 100 : 60);

    elements.emptyQuotes.hidden = rows.length > 0;
    elements.quoteRows.innerHTML = rows
      .map((item) => `
        <tr>
          <td>${escapeHtml(marketLabel(item.market))}</td>
          <td><strong>${escapeHtml(item.symbol)}</strong></td>
          <td>${escapeHtml(item.name || "")}</td>
          <td>${money(item.price, item.currency)}</td>
          <td class="${toneClass(item.change || 0)}">
            ${signed(item.change)} <small>${item.changePercent == null ? "--" : `${number(item.changePercent, 2)}%`}</small>
          </td>
          <td>${money(convert(turnoverTwd(item), "TWD", appState.settings.displayCurrency), appState.settings.displayCurrency)}</td>
          <td><small>${escapeHtml(item.asOf || "--")}</small></td>
          <td><button class="small-button" data-add-quote="${escapeHtml(`${item.market}:${item.symbol}`)}" type="button">加入</button></td>
        </tr>
      `)
      .join("");

    elements.quoteRows.querySelectorAll("[data-add-quote]").forEach((button) => {
      button.addEventListener("click", () => {
        const [market, symbol] = button.dataset.addQuote.split(":");
        fillFormFromQuote(getQuote(market, symbol));
      });
    });
  }

  function scanStrategy() {
    runDataScan("manual");
  }

  function runDataScan(mode = "manual", shouldRender = true) {
    const config = readStrategyConfig();
    const quotes = snapshot.quotes || [];
    const allMatches = quotes
      .map((quoteItem) => scoreCandidate(quoteItem, config))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const qualified = allMatches.filter((item) => item.signal === "BUY");
    const visible = config.showQualifiedOnly ? qualified : allMatches;
    scannerResults = visible.slice(0, Math.max(50, config.maxOrders * 6));

    const prefix = mode === "auto" ? "自動掃描完成" : "掃描完成";
    const filterText = config.showQualifiedOnly ? "只顯示 BUY" : "顯示 BUY / WATCH";
    showScannerMessage(
      `${prefix}：掃描 ${quotes.length} 檔，符合篩選 ${qualified.length} 檔，顯示 ${scannerResults.length} 檔（${filterText}）。`,
      scannerResults.length === 0
    );
    if (shouldRender) renderScanner();
    return scannerResults;
  }

  function autoPaperTrade() {
    const config = readStrategyConfig();
    if (!scannerResults.length) runDataScan("auto");
    const buySignals = scannerResults.filter((item) => item.signal === "BUY").slice(0, config.maxOrders);
    let created = 0;
    let skipped = 0;
    const messages = [];

    for (const item of buySignals) {
      const result = createPaperOrder(item);
      if (result.created) created += 1;
      else skipped += 1;
      if (messages.length < 2 && !result.created) messages.push(result.message);
    }

    showScannerMessage(`自動模擬開單完成：新增 ${created} 筆，略過 ${skipped} 筆。${messages.length ? ` ${messages.join("；")}` : ""}`, created === 0);
    renderSummary();
    renderPaperOrders();
  }

  function scoreCandidate(quoteItem, config) {
    const quote = normalizeQuote(quoteItem);
    if (!quote.price || !Number.isFinite(quote.price)) return null;
    if (config.strategyMarket !== "ALL" && quote.market !== config.strategyMarket) return null;

    const valueTwd = turnoverTwd(quote);
    if (valueTwd < config.minTurnoverTwd) return null;

    const changePct = Number.isFinite(quote.changePercent) ? quote.changePercent : 0;
    const intradayPct = quote.open ? ((quote.price - quote.open) / quote.open) * 100 : 0;
    const candlePosition = candlePositionScore(quote);
    const liquidityScore = Math.min(35, Math.max(0, Math.log10(valueTwd + 1) - 6) * 10);
    let score = 0;
    let signal = "WATCH";
    let reason = "";

    if (config.strategyPreset === "reversal") {
      if (changePct < -5 || changePct > 2 || candlePosition < 0.58) return null;
      score = 35 + candlePosition * 45 + liquidityScore + Math.max(0, intradayPct) * 4 - Math.abs(changePct) * 2;
      signal = score >= 65 ? "BUY" : "WATCH";
      reason = `回檔 ${number(changePct, 2)}%，收盤位階 ${number(candlePosition * 100, 0)}%，日內轉強 ${number(intradayPct, 2)}%`;
    } else if (config.strategyPreset === "liquidity") {
      if (Math.abs(changePct) < 1) return null;
      score = liquidityScore + Math.abs(changePct) * 7 + candlePosition * 25 + Math.max(0, intradayPct) * 2;
      signal = changePct > 0 && candlePosition >= 0.5 && score >= 58 ? "BUY" : "WATCH";
      reason = `成交值 ${compactMoney(valueTwd)}，漲跌 ${number(changePct, 2)}%，收盤位階 ${number(candlePosition * 100, 0)}%`;
    } else {
      if (changePct < 1 || changePct > 12 || candlePosition < 0.55) return null;
      score = changePct * 8 + candlePosition * 35 + liquidityScore + Math.max(0, intradayPct) * 3;
      signal = score >= 62 ? "BUY" : "WATCH";
      reason = `動能 ${number(changePct, 2)}%，收盤接近高點 ${number(candlePosition * 100, 0)}%，成交值 ${compactMoney(valueTwd)}`;
    }

    if (!Number.isFinite(score) || score <= 0) return null;
    return { quote, score, signal, reason, turnoverTwd: valueTwd };
  }

  function createPaperOrder(candidate) {
    const config = readStrategyConfig();
    if (!candidate?.quote) return { created: false, message: "沒有可開單的候選。" };
    if (candidate.signal !== "BUY") return { created: false, message: `${candidate.quote.symbol} 不是 BUY 訊號。` };

    const duplicate = appState.paperOrders.some((order) => (
      order.status === "open" &&
      order.market === candidate.quote.market &&
      order.symbol === candidate.quote.symbol
    ));
    if (duplicate) return { created: false, message: `${candidate.quote.symbol} 已有未平倉模擬單。` };

    const availableTwd = Math.max(0, config.virtualCash - paperExposureTwd());
    const targetBudgetTwd = config.virtualCash * (config.orderBudgetPct / 100);
    const budgetTwd = Math.min(targetBudgetTwd, availableTwd);
    const budgetNative = convert(budgetTwd, "TWD", candidate.quote.currency);
    const quantity = orderQuantity(candidate.quote, budgetNative);
    if (!quantity || quantity <= 0) return { created: false, message: `${candidate.quote.symbol} 可用模擬資金不足。` };

    const notional = round(quantity * candidate.quote.price, 4);
    const notionalTwd = convert(notional, candidate.quote.currency, "TWD");
    const order = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      snapshotAt: snapshot.generatedAt,
      market: candidate.quote.market,
      symbol: candidate.quote.symbol,
      name: candidate.quote.name || "",
      strategy: config.strategyPreset,
      side: "BUY",
      quantity,
      price: candidate.quote.price,
      currency: candidate.quote.currency,
      notional,
      notionalTwd,
      stopPrice: round(candidate.quote.price * (1 - config.stopLossPct / 100), 4),
      targetPrice: round(candidate.quote.price * (1 + config.takeProfitPct / 100), 4),
      score: round(candidate.score, 2),
      reason: candidate.reason,
      status: "open",
      pnlTwd: null
    };

    appState.paperOrders.push(order);
    persist();
    return { created: true, message: `${order.symbol} 已建立模擬買單。` };
  }

  function handleOrderAction(action, id) {
    const order = appState.paperOrders.find((item) => item.id === id);
    if (!order) return;
    if (action === "delete") {
      appState.paperOrders = appState.paperOrders.filter((item) => item.id !== id);
    }
    if (action === "close") {
      const current = getQuote(order.market, order.symbol);
      const exitPrice = current?.price || order.price;
      order.status = "closed";
      order.closedAt = new Date().toISOString();
      order.exitPrice = exitPrice;
      order.pnlTwd = convert((exitPrice - order.price) * order.quantity, order.currency, "TWD");
    }
    if (action === "convert") {
      appState.positions.push({
        id: makeId(),
        market: order.market,
        symbol: order.symbol,
        quantity: order.quantity,
        averageCost: order.price,
        currency: order.currency,
        note: `由模擬單轉入：${strategyLabel(order.strategy)}`
      });
      order.status = "converted";
    }
    persist();
    renderSummary();
    renderPaperOrders();
    renderPortfolio();
  }

  function clearPaperOrders() {
    if (!appState.paperOrders.length) return;
    if (!window.confirm("清除所有模擬單？")) return;
    appState.paperOrders = [];
    persist();
    renderSummary();
    renderPaperOrders();
  }

  function savePosition(event) {
    event.preventDefault();
    const market = normalizeMarket(elements.marketInput.value);
    const symbol = normalizeSymbol(market, elements.symbolInput.value);
    const quantity = toNumber(elements.quantityInput.value);
    const averageCost = toNumber(elements.averageCostInput.value);
    const currency = elements.currencyInput.value;
    const note = elements.noteInput.value.trim();

    if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(averageCost) || averageCost < 0) {
      showFormMessage("請確認代號、股數與平均成本。", true);
      return;
    }

    const payload = { market, symbol, quantity, averageCost, currency, note };
    if (editingId) {
      appState.positions = appState.positions.map((position) => (position.id === editingId ? { ...position, ...payload } : position));
      showFormMessage("持股已更新。");
    } else {
      appState.positions.push({ id: makeId(), ...payload });
      showFormMessage("持股已加入。");
    }
    persist();
    clearForm(false);
    renderSummary();
    renderPortfolio();
    renderQuotes();
  }

  function editPosition(id) {
    const position = appState.positions.find((item) => item.id === id);
    if (!position) return;
    editingId = id;
    elements.formTitle.textContent = "編輯持股";
    elements.submitPosition.textContent = "儲存變更";
    elements.cancelEdit.hidden = false;
    elements.marketInput.value = position.market;
    elements.symbolInput.value = position.symbol;
    elements.quantityInput.value = position.quantity;
    elements.averageCostInput.value = position.averageCost;
    elements.currencyInput.value = position.currency;
    elements.noteInput.value = position.note || "";
    elements.symbolInput.focus();
  }

  function deletePosition(id) {
    const position = appState.positions.find((item) => item.id === id);
    if (!position) return;
    if (!window.confirm(`刪除 ${position.symbol}？`)) return;
    appState.positions = appState.positions.filter((item) => item.id !== id);
    persist();
    renderSummary();
    renderPortfolio();
    renderQuotes();
  }

  function clearForm(clearMessage = true) {
    editingId = null;
    elements.form.reset();
    elements.formTitle.textContent = "新增持股";
    elements.submitPosition.textContent = "加入持股";
    elements.cancelEdit.hidden = true;
    setDefaultCurrency();
    if (clearMessage) showFormMessage("");
  }

  function fillFormFromQuote(item) {
    if (!item) return;
    editingId = null;
    elements.formTitle.textContent = "新增持股";
    elements.submitPosition.textContent = "加入持股";
    elements.cancelEdit.hidden = true;
    elements.marketInput.value = normalizeMarket(item.market);
    elements.symbolInput.value = normalizeSymbol(item.market, item.symbol);
    elements.currencyInput.value = item.currency || defaultCurrency(item.market);
    elements.averageCostInput.value = item.price || "";
    elements.quantityInput.value = "";
    elements.noteInput.value = item.name || "";
    elements.quantityInput.focus();
  }

  function exportPortfolio() {
    downloadJson(appState, `stock-dashboard-state-${new Date().toISOString().slice(0, 10)}.json`);
  }

  function exportPaperOrders() {
    downloadJson({ generatedAt: new Date().toISOString(), paperOrders: appState.paperOrders }, `paper-orders-${new Date().toISOString().slice(0, 10)}.json`);
  }

  function importPortfolio(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        appState = normalizeImportedState(JSON.parse(String(reader.result || "{}")));
        syncInputsFromState();
        persist();
        render();
        showFormMessage("資料已匯入。");
      } catch (error) {
        showFormMessage(`匯入失敗：${error.message}`, true);
      } finally {
        elements.importFile.value = "";
      }
    };
    reader.readAsText(file);
  }

  function positionMetrics(position) {
    const quoteItem = getQuote(position.market, position.symbol);
    const quoteCurrency = quoteItem?.currency || position.currency || defaultCurrency(position.market);
    const price = quoteItem?.price ?? null;
    const valueNative = price == null ? 0 : position.quantity * price;
    const costNative = position.quantity * position.averageCost;
    const valueDisplay = convert(valueNative, quoteCurrency, appState.settings.displayCurrency);
    const costDisplay = convert(costNative, position.currency, appState.settings.displayCurrency);
    const pnlDisplay = valueDisplay - costDisplay;
    const pnlPercent = costDisplay ? (pnlDisplay / costDisplay) * 100 : null;
    const dayChangeNative = quoteItem?.change == null ? 0 : quoteItem.change * position.quantity;
    const dayChangeDisplay = convert(dayChangeNative, quoteCurrency, appState.settings.displayCurrency);
    return {
      position,
      quote: quoteItem,
      valueDisplay,
      costDisplay,
      pnlDisplay,
      pnlPercent,
      dayChangeDisplay,
      marketLabel: marketLabel(position.market)
    };
  }

  function readStrategyConfig() {
    const settings = appState.settings;
    settings.strategyMarket = elements.strategyMarket.value;
    settings.strategyPreset = elements.strategyPreset.value;
    settings.autoScan = elements.autoScan.checked;
    settings.showQualifiedOnly = elements.showQualifiedOnly.checked;
    settings.virtualCash = clamp(toNumber(elements.virtualCash.value), 10000, 1000000000, DEFAULT_SETTINGS.virtualCash);
    settings.orderBudgetPct = clamp(toNumber(elements.orderBudgetPct.value), 1, 100, DEFAULT_SETTINGS.orderBudgetPct);
    settings.maxOrders = Math.round(clamp(toNumber(elements.maxOrders.value), 1, 30, DEFAULT_SETTINGS.maxOrders));
    settings.minTurnoverTwd = clamp(toNumber(elements.minTurnoverTwd.value), 0, 100000000000, DEFAULT_SETTINGS.minTurnoverTwd);
    settings.stopLossPct = clamp(toNumber(elements.stopLossPct.value), 0.1, 30, DEFAULT_SETTINGS.stopLossPct);
    settings.takeProfitPct = clamp(toNumber(elements.takeProfitPct.value), 0.1, 80, DEFAULT_SETTINGS.takeProfitPct);
    syncStrategyInputs();
    return { ...settings };
  }

  function syncInputsFromState() {
    elements.displayCurrency.value = appState.settings.displayCurrency;
    elements.sortMode.value = appState.settings.sortMode;
    document.documentElement.dataset.theme = appState.settings.theme;
    syncStrategyInputs();
    setDefaultCurrency();
  }

  function syncStrategyInputs() {
    elements.strategyMarket.value = appState.settings.strategyMarket;
    elements.strategyPreset.value = appState.settings.strategyPreset;
    elements.autoScan.checked = Boolean(appState.settings.autoScan);
    elements.showQualifiedOnly.checked = Boolean(appState.settings.showQualifiedOnly);
    elements.virtualCash.value = appState.settings.virtualCash;
    elements.orderBudgetPct.value = appState.settings.orderBudgetPct;
    elements.maxOrders.value = appState.settings.maxOrders;
    elements.minTurnoverTwd.value = appState.settings.minTurnoverTwd;
    elements.stopLossPct.value = appState.settings.stopLossPct;
    elements.takeProfitPct.value = appState.settings.takeProfitPct;
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_STORE_KEY) || "{}";
      return normalizeImportedState(JSON.parse(stored));
    } catch {
      return normalizeImportedState({});
    }
  }

  function normalizeImportedState(raw) {
    const settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
    settings.displayCurrency = settings.displayCurrency === "USD" ? "USD" : "TWD";
    settings.sortMode = ["marketValue", "pnl", "dayChange", "symbol"].includes(settings.sortMode) ? settings.sortMode : "marketValue";
    settings.theme = settings.theme === "dark" ? "dark" : "light";
    settings.strategyMarket = ["ALL", "TWSE", "TPEX", "US"].includes(settings.strategyMarket) ? settings.strategyMarket : "ALL";
    settings.strategyPreset = ["momentum", "reversal", "liquidity"].includes(settings.strategyPreset) ? settings.strategyPreset : "momentum";
    settings.autoScan = settings.autoScan !== false;
    settings.showQualifiedOnly = settings.showQualifiedOnly !== false;

    const positions = Array.isArray(raw.positions)
      ? raw.positions
          .map((item) => ({
            id: item.id || makeId(),
            market: normalizeMarket(item.market),
            symbol: normalizeSymbol(item.market, item.symbol),
            quantity: toNumber(item.quantity),
            averageCost: toNumber(item.averageCost),
            currency: ["TWD", "USD"].includes(item.currency) ? item.currency : defaultCurrency(item.market),
            note: String(item.note || "").slice(0, 120)
          }))
          .filter((item) => item.symbol && item.quantity > 0 && item.averageCost >= 0)
      : [];

    const paperOrders = Array.isArray(raw.paperOrders)
      ? raw.paperOrders
          .map((item) => ({
            id: item.id || makeId(),
            createdAt: item.createdAt || new Date().toISOString(),
            snapshotAt: item.snapshotAt || "",
            market: normalizeMarket(item.market),
            symbol: normalizeSymbol(item.market, item.symbol),
            name: String(item.name || ""),
            strategy: ["momentum", "reversal", "liquidity"].includes(item.strategy) ? item.strategy : "momentum",
            side: item.side === "SELL" ? "SELL" : "BUY",
            quantity: toNumber(item.quantity),
            price: toNumber(item.price),
            currency: ["TWD", "USD"].includes(item.currency) ? item.currency : defaultCurrency(item.market),
            notional: toNumber(item.notional),
            notionalTwd: toNumber(item.notionalTwd),
            stopPrice: toNumber(item.stopPrice),
            targetPrice: toNumber(item.targetPrice),
            score: toNumber(item.score),
            reason: String(item.reason || ""),
            status: ["open", "closed", "converted"].includes(item.status) ? item.status : "open",
            pnlTwd: Number.isFinite(toNumber(item.pnlTwd)) ? toNumber(item.pnlTwd) : null,
            closedAt: item.closedAt || null,
            exitPrice: Number.isFinite(toNumber(item.exitPrice)) ? toNumber(item.exitPrice) : null
          }))
          .filter((item) => item.symbol && item.quantity > 0 && item.price > 0)
      : [];

    return { positions, paperOrders, settings };
  }

  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(appState));
  }

  function updateSetting(key, value) {
    appState.settings[key] = value;
    if (key === "displayCurrency") {
      renderSummary();
      renderPortfolio();
      renderQuotes();
      renderScanner();
      renderPaperOrders();
    }
    if (key === "sortMode") renderPortfolio();
    persist();
  }

  function toggleTheme() {
    appState.settings.theme = appState.settings.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = appState.settings.theme;
    persist();
  }

  function setDefaultCurrency() {
    elements.currencyInput.value = defaultCurrency(elements.marketInput.value);
  }

  function showFormMessage(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.className = `form-message ${isError ? "negative" : ""}`;
  }

  function showScannerMessage(message, isError = false) {
    elements.scannerMessage.textContent = message;
    elements.scannerMessage.className = `form-message ${isError ? "negative" : ""}`;
  }

  function setLoadStatus(status, message) {
    elements.loadStatus.className = `pill ${safeClass(status)}`;
    elements.loadStatus.textContent = message;
  }

  function sortPositions(a, b) {
    const mode = appState.settings.sortMode;
    if (mode === "symbol") return a.position.symbol.localeCompare(b.position.symbol);
    if (mode === "pnl") return b.pnlDisplay - a.pnlDisplay;
    if (mode === "dayChange") return b.dayChangeDisplay - a.dayChangeDisplay;
    return b.valueDisplay - a.valueDisplay;
  }

  function getQuote(market, symbol) {
    const normalizedMarket = normalizeMarket(market);
    const normalizedSymbol = normalizeSymbol(normalizedMarket, symbol);
    return quoteIndex.get(`${normalizedMarket}:${normalizedSymbol}`) || null;
  }

  function normalizeQuote(item) {
    return {
      ...item,
      market: normalizeMarket(item.market),
      symbol: normalizeSymbol(item.market, item.symbol),
      price: toNullableNumber(item.price),
      previousClose: toNullableNumber(item.previousClose),
      change: toNullableNumber(item.change),
      changePercent: toNullableNumber(item.changePercent),
      open: toNullableNumber(item.open),
      high: toNullableNumber(item.high),
      low: toNullableNumber(item.low),
      volume: toNullableNumber(item.volume),
      turnover: toNullableNumber(item.turnover),
      currency: item.currency || defaultCurrency(item.market)
    };
  }

  function candlePositionScore(item) {
    if (item.high && item.low && item.high > item.low) {
      return clamp((item.price - item.low) / (item.high - item.low), 0, 1, 0.5);
    }
    return item.changePercent > 0 ? 0.6 : 0.4;
  }

  function turnoverTwd(item) {
    const quote = normalizeQuote(item);
    const nativeTurnover = quote.turnover || (quote.price && quote.volume ? quote.price * quote.volume : 0);
    return convert(nativeTurnover, quote.currency, "TWD");
  }

  function paperExposureTwd() {
    return sum(appState.paperOrders.filter((order) => order.status === "open").map((order) => order.notionalTwd || convert(order.notional, order.currency, "TWD")));
  }

  function orderQuantity(quote, budgetNative) {
    if (!quote.price || budgetNative <= 0) return 0;
    if (quote.market === "US") return Math.floor((budgetNative / quote.price) * 10000) / 10000;
    return Math.floor(budgetNative / quote.price);
  }

  function convert(value, from, to) {
    if (!Number.isFinite(value)) return 0;
    if (from === to) return value;
    const rate = snapshot.fx?.USDTWD || 31;
    if (from === "USD" && to === "TWD") return value * rate;
    if (from === "TWD" && to === "USD") return value / rate;
    return value;
  }

  function snapshotStatus(data) {
    const statuses = Object.values(data.sources || {}).map((item) => item.status);
    if (statuses.some((status) => status === "error")) return "partial";
    if (statuses.some((status) => status === "mock")) return "mock";
    return "ok";
  }

  function sourceLabel(name) {
    return {
      TWSE: "上市 TWSE",
      TPEX: "上櫃 TPEx",
      STOOQ: "美股 Stooq",
      BOT: "臺銀 USD/TWD"
    }[name] || name;
  }

  function strategyLabel(name) {
    return {
      momentum: "動能突破",
      reversal: "回檔轉強",
      liquidity: "量價強勢"
    }[name] || name;
  }

  function statusLabel(status) {
    return {
      open: "未平倉",
      closed: "已平倉",
      converted: "已轉持股"
    }[status] || status;
  }

  function isFeatured(item) {
    const featured = new Set(["TWSE:0050", "TWSE:0056", "TWSE:2330", "TWSE:2317", "TWSE:2454", "TPEX:00679B", "TPEX:6488", "US:AAPL", "US:MSFT", "US:NVDA", "US:SPY"]);
    return featured.has(`${normalizeMarket(item.market)}:${normalizeSymbol(item.market, item.symbol)}`);
  }

  function isSameQuote(position, item) {
    return normalizeMarket(position.market) === normalizeMarket(item.market) && normalizeSymbol(position.market, position.symbol) === normalizeSymbol(item.market, item.symbol);
  }

  function normalizeMarket(market) {
    const value = String(market || "TWSE").toUpperCase();
    if (value === "TPEX" || value === "OTC") return "TPEX";
    if (value === "US" || value === "NYSE" || value === "NASDAQ") return "US";
    return "TWSE";
  }

  function normalizeSymbol(market, symbol) {
    const clean = String(symbol || "").trim().toUpperCase();
    if (normalizeMarket(market) === "US") return clean.replace(/\.US$/, "");
    return clean;
  }

  function marketLabel(market) {
    return { TWSE: "上市", TPEX: "上櫃", US: "美股" }[normalizeMarket(market)] || market;
  }

  function defaultCurrency(market) {
    return normalizeMarket(market) === "US" ? "USD" : "TWD";
  }

  function money(value, currency) {
    if (!Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "TWD" ? 0 : 2
    }).format(value);
  }

  function number(value, digits = 2) {
    if (!Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("zh-TW", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    }).format(value);
  }

  function signed(value) {
    if (!Number.isFinite(value)) return "--";
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${number(value, 2)}`;
  }

  function compactMoney(valueTwd) {
    if (!Number.isFinite(valueTwd)) return "--";
    if (valueTwd >= 100000000) return `${number(valueTwd / 100000000, 2)} 億 TWD`;
    if (valueTwd >= 10000) return `${number(valueTwd / 10000, 0)} 萬 TWD`;
    return `${number(valueTwd, 0)} TWD`;
  }

  function sum(values) {
    return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    const cleaned = String(value ?? "").replace(/,/g, "").trim();
    if (!cleaned || cleaned === "---" || cleaned === "N/D") return NaN;
    return Number(cleaned);
  }

  function toNullableNumber(value) {
    const parsed = toNumber(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clamp(value, min, max, fallback) {
    const next = Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, next));
  }

  function round(value, digits = 4) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function toneClass(value) {
    if (!Number.isFinite(value) || value === 0) return "neutral-text";
    return value > 0 ? "positive" : "negative";
  }

  function safeClass(status) {
    const value = String(status || "neutral").toLowerCase();
    return ["ok", "mock", "partial", "error", "neutral"].includes(value) ? value : "neutral";
  }

  function formatDateTime(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function sampleQuote(market, symbol, name, currency, open, previousClose, high, low, price, volume, asOf) {
    const change = round(price - previousClose, 4);
    return {
      market,
      symbol,
      name,
      currency,
      open,
      high,
      low,
      price,
      previousClose,
      change,
      changePercent: previousClose ? round((change / previousClose) * 100, 4) : null,
      volume,
      turnover: round(price * volume, 2),
      asOf,
      source: "Bundled sample data",
      status: "mock"
    };
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
})();
