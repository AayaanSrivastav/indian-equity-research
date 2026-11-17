# Indian Equity Research Engine

**Live site:** https://aayaansrivastav.github.io/indian-equity-research/

Academic case studies of listed Indian companies. Each page turns a company's public filings into checked, sourced numbers, then asks one question: **what does today's share price imply?**

> **Educational project. Not investment advice.** Nothing here is a recommendation to buy, sell or hold anything. There is no target price, no rating and no "fair value". The author is not a SEBI-registered investment adviser or research analyst. Figures can be wrong or out of date; check the filings yourself.

## What it does

- **Reads the filings.** Quarterly and annual results become a table of facts. Every figure carries its source file, period, unit and date.
- **Checks the arithmetic.** Hundreds of reconciliation checks per company: lines against totals, quarters against the year, the exchange's data file against the printed statement. Filer errors are listed, not hidden.
- **Values by rule, not by opinion.** A discounted cash flow model (DCF) is run backwards: it solves for the growth rate the current price already assumes. Every input is set by a written rule, the same for every company.
- **Refuses when the model does not fit.** A company whose cash flows or tax line make the model meaningless gets its reasons, not a number.
- **Measures results-day reactions.** The share's move after each of the last five results is compared with what the market's move alone would explain. A large move is reported as large, never as proof of a cause.

## What is covered

| Outcome | Companies |
|---|---|
| Template A (steady cash generators) | TCS, Infosys, HCLTech, Wipro, Tech Mahindra, Persistent Systems, Dabur, Britannia, Eicher Motors, Hero MotoCorp, Sun Pharma, Divi's Laboratories, Asian Paints |
| Template B (reinvesting at high returns) | Titan, Trent, Mahindra & Mahindra, Dr Reddy's, Havells, Mphasis |
| Neither applies (reasons shown) | Tata Consumer, Tata Steel, Tata Power |

Prices are the latest NSE close loaded; each page shows its date.

## Limitations

- Twenty-two large companies. Banks and other financials need a different model and are not included. Mahindra & Mahindra consolidates a lending business, which distorts its figure; its page says so.
- The model's price-implied growth is far above history for several companies. That is a statement about the model's assumptions, not a view on the shares.
- A DCF is a set of assumptions. The implied growth rate moves with the discount rate and margin rules; the site shows how much.
- Apart from TCS, the figures are machine-read and reconciled but not yet checked line by line by a person.
- The site is a snapshot. It updates when new exchange files are loaded and the engine is re-run.
- Charts load two open-source libraries from a public CDN.

## This repository

It holds the built website only: static HTML, CSS, JavaScript and the JSON the engine wrote. The browser computes nothing. The Python engine that produces the JSON is in a separate, private repository for now. The Method page on the site explains the model, with every threshold read from the engine's code.

Raw exchange files and company documents are not redistributed here.
