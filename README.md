# Cashflow Tracker

Tracking cashflow matters. But I hate spending time on it. So I built this desktop app for myself: dump in transactions from any bank or institution, normalize the messy formats, apply existing rules, and punch through the rest. If you feel the same way about accounting, you'll feel at home here. Open source, local-only, and completely free.

**The Workflow:** Download your CSVs/Excel files once a month, "punch through" them in the app, and export a perfectly cleaned dataset for your spreadsheets or accounting software.

![Screenshot Placeholder - The Categorization Loop](https://via.placeholder.com/800x450?text=Walkthrough+Video/Screenshot+Coming+Soon)

## Why Cashflow?

*   **Speed-First UI:** A "TikTok-style" categorization loop. One transaction at a time, keyboard-centric, zero friction.
*   **Local-Only:** Your financial data never leaves your machine. Built on Go + SQLite. No cloud, no trackers, no subscriptions.
*   **Normalization Engine:** Import messy data from multiple banks, map them once, and export a single, clean format.
*   **Rule-Based Automation:** Create powerful regex-style rules (Starts With, Ends With, Contains) to automate future imports.

## Features

- **Import Flow:** Vertical "punch-through" column mapping for CSV/XLSX.
- **Categorization Loop:** Inbox-zero approach to transactions. Automatically advances as you categorize.
- **Smart Heuristics:** Suggests rules based on text selection in descriptions.
- **Export:** Cleaned data ready for Google Sheets, Excel, or specialized accounting tools.
- **Cross-Platform:** Native performance on macOS, Windows, and Linux via Wails.

## Getting Started

### Installation
Download the latest version for your operating system from the [Releases](https://github.com/your-username/cashflow/releases) page.

### Development
If you want to build from source:
1. Install [Go](https://go.dev/) 1.25+ and [Node.js](https://nodejs.org/).
2. Install [Wails CLI](https://wails.io/docs/gettingstarted/installation).
3. Clone the repo and run:
   ```bash
   make check
   wails build
   ```

## Roadmap

- [ ] **Multi-Currency:** Native support for accounts in different currencies.
- [ ] **Sole-Proprietor Tools:** Flag business expenses and attach invoices/receipts.
- [ ] **Advanced Forecasting:** Visualize future cashflow based on historical trends.

## License

Licensed under the [Apache License 2.0](./LICENSE).
