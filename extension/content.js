// PropGuard Tradovate P&L Scraper
// Fires window CustomEvent 'propguard:pnl' with { pnl: number }

let lastPnl = null;

function parsePnl(text) {
  if (!text) return null;
  // Remove $, commas, handle parentheses as negative (1,234.56) → negative
  const cleaned = text.replace(/[$,\s]/g, '');
  const negative = cleaned.startsWith('(') || cleaned.startsWith('-') || text.includes('-');
  const abs = parseFloat(cleaned.replace(/[()]/g, ''));
  if (isNaN(abs)) return null;
  return negative ? -abs : abs;
}

function scrapePnl() {
  // Try multiple selectors — Tradovate updates their DOM periodically
  const selectors = [
    '[class*="pnl"]',
    '[class*="Pnl"]',
    '[class*="profit"]',
    '[class*="gain"]',
    '[class*="net-gain"]',
    '[data-testid*="pnl"]',
    '[class*="daily"]',
    '.accountBalance',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent?.trim();
      if (!text) continue;
      // Must look like a dollar amount
      if (!/[\d]/.test(text)) continue;
      if (text.length > 20) continue; // skip long text
      const pnl = parsePnl(text);
      if (pnl !== null && pnl !== lastPnl) {
        lastPnl = pnl;
        window.dispatchEvent(new CustomEvent('propguard:pnl', { detail: { pnl } }));
        chrome.storage.local.set({ lastPnl: pnl, lastUpdated: Date.now() });
        return;
      }
    }
  }
}

// Poll every 2 seconds
setInterval(scrapePnl, 2000);

// Also watch for DOM mutations (React apps update DOM reactively)
const observer = new MutationObserver(() => {
  scrapePnl();
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// Initial scrape
scrapePnl();

console.log('[PropGuard] Tradovate P&L scraper active');
