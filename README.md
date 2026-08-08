# Tanbuild

A sales, stock, expenses, payroll, ledger and financial-health tracker for the shop, built with React + FIFO inventory costing. Runs fully offline in the browser (localStorage), with an optional Firebase sync hook you can enable later.

## Project structure

```
Tanbuild/
├── src/
│   ├── index.jsx              React entry point
│   ├── App.jsx                Main app shell / tab router
│   ├── styles.css             All app styling
│   ├── seedData.js            Opening stock, batches, agents (from Tanbuild_Operating_Book.xlsx)
│   ├── fifo.js                FIFO inventory costing engine + initial state
│   ├── storage.js             localStorage persistence (Firebase optional, see below)
│   ├── utils.js                Shared helpers (dates, money formatting, totals)
│   ├── health-calcs.js        P&L / balance sheet / cash flow calculations
│   └── components/
│       ├── Shared.jsx         TopBar, Field, AutocompleteInput, PillSelect, Toast, TabBar, ReportRow
│       ├── SalesTab.jsx
│       ├── HistoryTab.jsx
│       ├── StockTab.jsx
│       ├── NewstockTab.jsx
│       ├── ExpensesTab.jsx
│       ├── DamageLossTab.jsx
│       ├── LedgerTab.jsx
│       ├── HRTab.jsx
│       ├── HealthTab.jsx      + PLPanel, BalanceSheetPanel, CashFlowPanel, TopItemsPanel
│       └── BackupPanel.jsx
├── dist/
│   └── index.html             Minimal shell that loads the built bundle.js
├── webpack.config.js
├── babel.config.js
├── package.json
└── .gitignore
```

## Getting it onto GitHub

1. Create a new repository on GitHub (e.g. `tanbuild`) — don't initialize it with a README, since you already have one.
2. From inside this `Tanbuild` folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: modular Tanbuild build setup"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/tanbuild.git
   git push -u origin main
   ```

## Building the app

```bash
npm install
npm run build
```

This installs webpack, babel, and React, then bundles everything into `dist/bundle.js`. The `dist/index.html` file already references it, so `dist/` is a complete, deployable folder on its own.

To preview locally after building:
```bash
npm start
```
This serves the `dist/` folder at `http://localhost:8080` (or similar).

For active development with auto-rebuild on save:
```bash
npm run dev
```

## Deploying to GitHub Pages

1. Push your code (including a built `dist/` — see note below on `.gitignore`).
2. In your repo, go to **Settings → Pages**.
3. Set the source branch to `main` and the folder to `/dist`.
4. Save — GitHub will publish at `https://YOUR-USERNAME.github.io/tanbuild/`.

**Note on `.gitignore`:** by default this project ignores `dist/bundle.js` (build output shouldn't normally be committed). For GitHub Pages to work straight from `main`, you have two options:
- **Simplest:** remove `dist/bundle.js` from `.gitignore`, run `npm run build`, and commit the built file along with everything else.
- **Cleaner (optional):** set up the GitHub Actions workflow described below so GitHub builds it for you on every push, and you never commit `dist/bundle.js` yourself.

### Optional: auto-build on every push (GitHub Actions)

Create `.github/workflows/build.yml`:
```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```
With this in place, you can keep `dist/bundle.js` in `.gitignore` — GitHub builds and publishes it automatically on every push to `main`.

## About Firebase sync

Your original file had Firebase wired in directly with live project keys. To keep things simple and match what you asked for, this build **only uses localStorage** — data stays on the device it's entered on.

`src/storage.js` still gracefully checks for a `window.__firebase` object and will use it automatically if present, but nothing sets that object up in this build. If you want cross-device sync back, the cleanest way is to reintroduce the Firebase `<script type="module">` block (the one from your original HTML file) as a small script loaded before `bundle.js` in `dist/index.html` — happy to wire that back in whenever you're ready.

One flag for later: your original file had real Firebase API keys committed directly in the HTML. If you do turn Firebase back on, it's worth moving that config to an environment variable or a `.env` file that's git-ignored, rather than committing it to a public repo.
