'use strict';
const toggle = document.getElementById('visible');
const petName = document.getElementById('name');
const status = document.getElementById('status');
const giftsToggle = document.getElementById('surpriseGifts');
const giftOptions = document.getElementById('giftOptions');
const frequencySelect = document.getElementById('giftFrequency');
const messagesToggle = document.getElementById('giftMessages');

function display(data) {
  petName.textContent = typeof data.name === 'string' ? data.name : 'Lovebug';
  toggle.checked = !data.hidden;
  status.textContent = data.hidden ? 'Resting here until you need a little love ♡' : 'With you on ordinary webpages ♡';
  if (giftsToggle) {
    giftsToggle.checked = data.surpriseGifts !== false;
    if (giftOptions) giftOptions.hidden = !giftsToggle.checked;
  }
  if (frequencySelect && data.giftFrequency) {
    frequencySelect.value = data.giftFrequency;
  }
  if (messagesToggle) {
    messagesToggle.checked = data.giftMessages !== false;
  }
}

chrome.storage.local.get({
  name: 'Lovebug',
  hidden: false,
  surpriseGifts: true,
  giftFrequency: 'normal',
  giftMessages: true
}).then(display).catch(() => { status.textContent = 'Storage is unavailable. Try opening this again.'; });

toggle.addEventListener('change', async () => {
  try {
    await chrome.storage.local.set({ hidden: !toggle.checked });
    display({
      name: petName.textContent,
      hidden: !toggle.checked,
      surpriseGifts: giftsToggle ? giftsToggle.checked : true,
      giftFrequency: frequencySelect ? frequencySelect.value : 'normal',
      giftMessages: messagesToggle ? messagesToggle.checked : true
    });
  } catch {
    toggle.checked = !toggle.checked;
    status.textContent = 'Could not save. Please try again.';
  }
});

if (giftsToggle) {
  giftsToggle.addEventListener('change', async () => {
    try {
      if (giftOptions) giftOptions.hidden = !giftsToggle.checked;
      await chrome.storage.local.set({ surpriseGifts: giftsToggle.checked });
    } catch {
      giftsToggle.checked = !giftsToggle.checked;
      if (giftOptions) giftOptions.hidden = !giftsToggle.checked;
    }
  });
}

if (frequencySelect) {
  frequencySelect.addEventListener('change', async () => {
    try {
      await chrome.storage.local.set({ giftFrequency: frequencySelect.value });
    } catch {
      // keep current
    }
  });
}

if (messagesToggle) {
  messagesToggle.addEventListener('change', async () => {
    try {
      await chrome.storage.local.set({ giftMessages: messagesToggle.checked });
    } catch {
      messagesToggle.checked = !messagesToggle.checked;
    }
  });
}

const btnGiftNow = document.getElementById('btnGiftNow');
const btnToyNow = document.getElementById('btnToyNow');

if (btnGiftNow) {
  btnGiftNow.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({ triggerGiftNow: Date.now() });
      status.textContent = 'Gift sent to your kitten! 🎁';
    } catch {
      status.textContent = 'Could not deliver gift. Try again.';
    }
  });
}

if (btnToyNow) {
  btnToyNow.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({ triggerToyNow: Date.now() });
      status.textContent = 'Playtime started with kitten! 🐾';
    } catch {
      status.textContent = 'Could not start toy. Try again.';
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.name) petName.textContent = changes.name.newValue || 'Lovebug';
  if (changes.hidden) toggle.checked = !changes.hidden.newValue;
  if (changes.surpriseGifts && giftsToggle) {
    giftsToggle.checked = changes.surpriseGifts.newValue !== false;
    if (giftOptions) giftOptions.hidden = !giftsToggle.checked;
  }
  if (changes.giftFrequency && frequencySelect) {
    frequencySelect.value = changes.giftFrequency.newValue || 'normal';
  }
  if (changes.giftMessages && messagesToggle) {
    messagesToggle.checked = changes.giftMessages.newValue !== false;
  }
});
