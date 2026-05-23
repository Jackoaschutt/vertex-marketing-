chrome.storage.local.get(['lastPnl', 'lastUpdated'], (data) => {
  const pnlEl = document.getElementById('pnl');
  const timeEl = document.getElementById('last-updated');
  const dotEl = document.getElementById('dot');
  const statusEl = document.getElementById('status-text');

  if (data.lastPnl !== undefined && data.lastPnl !== null) {
    const pnl = data.lastPnl;
    const formatted = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
    pnlEl.textContent = formatted;
    pnlEl.className = 'pnl-value ' + (pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral');
  }

  if (data.lastUpdated) {
    const secondsAgo = Math.round((Date.now() - data.lastUpdated) / 1000);
    timeEl.textContent = secondsAgo < 10 ? 'Just now' : `${secondsAgo}s ago`;

    if (secondsAgo > 30) {
      dotEl.style.background = '#f59e0b'; // amber = stale
      statusEl.textContent = 'Checking Tradovate...';
    }
  }
});
