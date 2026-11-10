const hostEl = document.getElementById('host');
const statusEl = document.getElementById('status');
const button = document.getElementById('toggle');

async function render(host) {
  const { excluded = [] } = await chrome.storage.sync.get('excluded');
  const off = excluded.includes(host);
  statusEl.textContent = off ? 'Disabled on this site.' : 'Active on this site.';
  button.textContent = off ? 'Enable on this site' : 'Disable on this site';
  button.className = off ? 'enable' : '';
  button.hidden = false;
  button.onclick = async () => {
    const next = off ? excluded.filter((h) => h !== host) : [...excluded, host];
    await chrome.storage.sync.set({ excluded: next });
    render(host);
  };
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ? new URL(tab.url) : null;
  if (!url || !/^https?:$/.test(url.protocol)) {
    statusEl.textContent = "Chrome doesn't let extensions run on this page.";
    return;
  }
  hostEl.textContent = url.hostname;
  render(url.hostname);
})();
