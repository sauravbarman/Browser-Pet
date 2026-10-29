'use strict';
const toggle = document.getElementById('visible');
const petName = document.getElementById('name');
const status = document.getElementById('status');
function display(data) {
  petName.textContent = typeof data.name === 'string' ? data.name : 'Lovebug';
  toggle.checked = !data.hidden;
  status.textContent = data.hidden ? 'Resting here until you need a little love ♡' : 'With you on ordinary webpages ♡';
}
chrome.storage.local.get({ name: 'Lovebug', hidden: false }).then(display).catch(() => { status.textContent = 'Storage is unavailable. Try opening this again.'; });
toggle.addEventListener('change', async () => {
  try { await chrome.storage.local.set({ hidden: !toggle.checked }); display({ name: petName.textContent, hidden: !toggle.checked }); }
  catch { toggle.checked = !toggle.checked; status.textContent = 'Could not save. Please try again.'; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.name) petName.textContent = changes.name.newValue || 'Lovebug';
  if (changes.hidden) display({ name: petName.textContent, hidden: changes.hidden.newValue });
});
