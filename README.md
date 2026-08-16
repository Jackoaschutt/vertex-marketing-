# Ledger

A personal tool for tracking the money and learning the process.

**Money** — what you spent and earned, by month, by category.
**Ads** — campaigns judged on profit rather than ROAS, because Ads Manager does not know what your goods cost.
**Suppliers** — compared on landed cost, with the questions worth answering before you commit.
**Learn** — the process as a checklist, each step carrying the reason it exists, plus your own notes.
**Coach** — answers worked out from your own entries.

## What it cannot do, and why

It cannot search Google or call the Meta API. A browser page has nowhere to hide
an API key — anything in the page is readable by anyone who opens developer
tools — and browsers block pages from calling most other sites' APIs anyway.

What it does instead is build the searches for you: type a product in Ads or
Suppliers and it opens the Meta Ad Library, AliExpress, Alibaba, CJ, Amazon,
Google Shopping and Google Trends with the right query already filled in, each
one saying what you are looking for when you get there.

## It runs on nothing

No database, no accounts, no API keys, no environment variables. Everything is
saved in your browser on your device, and nothing is ever uploaded. Open it and
it works.

```bash
npm install
npm run dev
```

Three dependencies: Next, React, React DOM.

## The trade

Browser storage is why there is no setup, and it is also the risk: clearing
your browsing data erases your records, and your phone and laptop hold separate
copies.

The home page has **Export backup** and **Restore** for exactly that reason.
Take a backup occasionally — the app will nag you once there is enough in here
to be worth losing.

## The one rule

Nothing is invented. The coach answers only from what you entered and says when
there isn't enough to answer, rates show `—` rather than a misleading `0%`, and
income is never labelled profit. A made-up number about your own money is worse
than no number, because you might act on it.
