(() => {
  const STORE_KEY = "stock-dashboard:portfolio:v1";
  const SNAPSHOT_URL = "data/market-snapshot.json";

  const SAMPLE_SNAPSHOT = {
    generatedAt: "2026-05-11T17:00:00.000Z",
    quotes: [
      quote("TWSE", "0050", "元大台灣50", "TWD", 97, 97.7, -0.7, "2026-05-08", "mock"),
      quote("TWSE", "2330", "台積電", "TWD", 1195, 1205, -10, "2026-05-08", "mock"),
      quote("TWSE", "2317", "鴻海", "TWD", 149.5, 151, -1.5, "2026-05-08", "mock"),
      quote("TPEX", "00679B", "元大美債20年", "TWD", 26.7, 26.71, -0.01, "2026-05-11", "mock"),
      quote("US", "AAPL", "APPLE INC", "USD", 291.15, 293.32, -2.17, "2026-05-11", "mock"),
      quote("US", "MSFT", "MICROSOFT CORP", "USD", 515.36, 514.86, 0.5, "2026-05-11", "mock"),
      quote("US", "NVDA", "NVIDIA CORP", "USD", 199.11, 198.2, 0.91, "2026-05-11", "mock"),
      quote("US", "SPY", "SPDR S&P 500 ETF", "USD", 682.1, 680.8, 1.3, "2026-05-11", "mock")
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
    dayChange: document.getElementById("dayChange"),
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
    importFile: document.getElementById("importFile")
  };

  let appState = loadState();
  let snapshot = SAMPLE_SNAPSHOT;
  let quoteIndex = new Map();
  let editingId = null;
  let marketFilter = "ALL";

  init();

  async function init() {
    elements.displayCurrency.value = appState.settings.displayCurrency;
    elements.sortMode.value = appState.settings.sortMode;
    document.documentElement.dataset.theme = appState.settings.theme;
    setDefaultCurrency();
    bindEvents();
    render();
    await loadSnapshot();
    render();
  }

  function bindEvents() {
    elements.form.addEventListener("submit", savePosition);
    elements.marketInput.addEventListener("change", setDefaultCurrency);
    elements.resetForm.addEventListener("click", clearForm);
    elements.cancelEdit.addEventListener("click", clearForm);
    elements.sortMode.addEventListener("change", () => {
      appState.settings.sortMode = elements.sortMode.value;
      persist();
      renderPortfolio();
    });
    elements.displayCurrency.addEventListener("change", () => {
      appState.settings.displayCurrency = elements.displayCurrency.value;
      persist();
      renderPortfolio();
      renderSummary();
    });
    elements.themeToggle.addEventListener("click", () => {
      appState.settings.theme = appState.settings.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = appState.settings.theme;
      persist();
    });
    elements.exportPortfolio.addEventListener("click", exportPortfolio);
    elements.importPortfolio.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", importPortfolio);
    elements.quoteSearch.addEventListener("input", renderQuotes);
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
        setLoadStatus("mock", "使用內建範例資料");
        snapshot = SAMPLE_SNAPSHOT;
      } else {
        const response = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        snapshot = await response.json();
        setLoadStatus(snapshotStatus(snapshot), "資料已更新");
      }
    } catch (error) {
      snapshot = SAMPLE_SNAPSHOT;
      setLoadStatus("partial", `讀取快照失敗，已改用範例資料：${error.message}`);
    }
    buildQuoteIndex();
  }

  function render() {
    buildQuoteIndex();
    renderStatus();
    renderSummary();
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
            <span class="badge ${safeClass(source.status)}">${source.status || "unknown"}</span>
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
    const totalDayChange = sum(rows.map((row) => row.dayChangeDisplay));

    elements.totalValue.textContent = money(totalValue, displayCurrency);
    elements.totalCost.textContent = money(totalCost, displayCurrency);
    elements.totalPnl.textContent = money(totalPnl, displayCurrency);
    elements.totalPnl.className = toneClass(totalPnl);
    elements.totalPnlPercent.textContent = pnlPercent === null ? "--" : `${number(pnlPercent, 2)}%`;
    elements.totalPnlPercent.className = toneClass(totalPnl);
    elements.dayChange.textContent = money(totalDayChange, displayCurrency);
    elements.dayChange.className = toneClass(totalDayChange);
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
        const id = button.dataset.id;
        if (button.dataset.action === "edit") editPosition(id);
        if (button.dataset.action === "delete") deletePosition(id);
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
      .slice(0, query ? 80 : 60);

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
    const payload = JSON.stringify(appState, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock-dashboard-portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importPortfolio(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const nextState = normalizeImportedState(JSON.parse(String(reader.result || "{}")));
        appState = nextState;
        elements.displayCurrency.value = appState.settings.displayCurrency;
        elements.sortMode.value = appState.settings.sortMode;
        document.documentElement.dataset.theme = appState.settings.theme;
        persist();
        render();
        showFormMessage("投資組合已匯入。");
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

  function convert(value, from, to) {
    if (!Number.isFinite(value)) return 0;
    if (from === to) return value;
    const rate = snapshot.fx?.USDTWD || 31;
    if (from === "USD" && to === "TWD") return value * rate;
    if (from === "TWD" && to === "USD") return value / rate;
    return value;
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return normalizeImportedState(stored);
    } catch {
      return normalizeImportedState({});
    }
  }

  function normalizeImportedState(raw) {
    const settings = {
      displayCurrency: raw.settings?.displayCurrency === "USD" ? "USD" : "TWD",
      sortMode: ["marketValue", "pnl", "dayChange", "symbol"].includes(raw.settings?.sortMode) ? raw.settings.sortMode : "marketValue",
      theme: raw.settings?.theme === "dark" ? "dark" : "light"
    };
    const positions = Array.isArray(raw.positions)
      ? raw.positions
          .map((item) => ({
            id: item.id || makeId(),
            market: normalizeMarket(item.market),
            symbol: normalizeSymbol(item.market, item.symbol),
            quantity: toNumber(item.quantity),
            averageCost: toNumber(item.averageCost),
            currency: ["TWD", "USD"].includes(item.currency) ? item.currency : defaultCurrency(item.market),
            note: String(item.note || "").slice(0, 80)
          }))
          .filter((item) => item.symbol && item.quantity > 0 && item.averageCost >= 0)
      : [];
    return { positions, settings };
  }

  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(appState));
  }

  function setDefaultCurrency() {
    elements.currencyInput.value = defaultCurrency(elements.marketInput.value);
  }

  function showFormMessage(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.className = `form-message ${isError ? "negative" : ""}`;
  }

  function setLoadStatus(status, message) {
    elements.loadStatus.className = `pill ${safeClass(status)}`;
    elements.loadStatus.textContent = message;
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

  function sum(values) {
    return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    const cleaned = String(value ?? "").replace(/,/g, "").trim();
    if (!cleaned || cleaned === "---" || cleaned === "N/D") return NaN;
    return Number(cleaned);
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

  function quote(market, symbol, name, currency, price, previousClose, change, asOf, status) {
    return {
      market,
      symbol,
      name,
      currency,
      price,
      previousClose,
      change,
      changePercent: previousClose ? (change / previousClose) * 100 : null,
      asOf,
      source: status === "mock" ? "Bundled sample data" : "snapshot",
      status
    };
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
    return `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
})();
