# Stock Market Dashboard

Pure frontend portfolio dashboard for Taiwan and US stocks, designed for GitHub Pages.

## What it does

- Shows TWSE, TPEx, and US quote snapshots from static JSON.
- Automatically scans symbols with built-in paper-trading strategies and filters qualified stocks.
- Creates simulated buy orders with sizing, stop loss, and take profit levels.
- Tracks a local portfolio in the browser with `localStorage`.
- Calculates market value, cost, unrealized P/L, day change, and USD/TWD conversion.
- Imports and exports portfolio JSON.
- Builds a fresh `data/market-snapshot.json` with GitHub Actions, without API keys.

The dashboard is delayed/EOD monitoring only. It does not provide real-time quotes, trading, or investment advice.

## Local use

Open `index.html` directly in a browser. When opened through `file://`, the app uses the bundled mock snapshot so the UI and portfolio features work without a local server.

To generate a deployable `dist/` folder:

```bash
node scripts/build-snapshot.mjs
```

The script uses public no-key sources:

- TWSE OpenAPI for listed Taiwan securities
- TPEx OpenAPI for OTC securities
- Stooq CSV quote snapshots for configured US symbols
- Bank of Taiwan CSV exchange rates for USD/TWD

## Configure US symbols

Edit `assets/watchlist.json`. TWSE and TPEx snapshots include regular Taiwan securities broadly, while US quotes are fetched only for symbols listed under `us`.

## GitHub Pages deployment

1. Create a public GitHub repository named `stock-market-dashboard`.
2. Push these files to the `main` branch.
3. In repository settings, set Pages source to **GitHub Actions**.
4. Run the `Build and deploy GitHub Pages` workflow manually, or wait for the scheduled run.

Portfolio and paper-order data remain private to each browser because they are stored only in `localStorage`.

## Strategy scanner

The scanner runs automatically after snapshot data loads and whenever strategy filters change. By default it shows only qualified BUY signals; you can turn off that filter to inspect WATCH candidates. It is a paper-trading workflow only and does not send real orders.

Built-in presets:

- Momentum breakout: looks for positive daily momentum, close near the high, and enough turnover.
- Reversal: looks for pullback names closing in the upper part of the daily range.
- Liquidity movers: ranks high-turnover symbols with meaningful daily movement.

The current strategy engine uses delayed/EOD snapshot fields only: price, previous close, open, high, low, volume, turnover, and USD/TWD. It is useful for workflow testing and screening, not for investment advice or real-time execution.
