# Ledger

A personal tool for tracking the money and learning the process.

**Money** — what you spent and earned, by month, by category.
**Learn** — the process as a checklist, each step carrying the reason it exists, plus your own notes.
**Coach** — answers worked out from your own entries.

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
