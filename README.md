# Browser-Pet: Little Lovebug ♡

<div align="center">

<img src="pet-sitting.png" width="140" alt="Little Lovebug sitting pixel-art kitten" />

### *A tiny, original pixel-art kitten carrying a little extra love through your day.*

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](manifest.json)
[![Version](https://img.shields.io/badge/Version-1.2.0-F472B6?style=flat-square)](CHANGELOG.md)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-34D399?style=flat-square)]()
[![100% Offline](https://img.shields.io/badge/Network-100%25_Offline-A78BFA?style=flat-square)]()
[![Privacy First](https://img.shields.io/badge/Privacy-100%25_Local-FBBF24?style=flat-square)]()
[![Platform](https://img.shields.io/badge/Platform-macOS_%7C_Windows-64748B?style=flat-square)]()

</div>

---

## 🌸 About Little Lovebug

**Little Lovebug** is a romantic, lightweight **Manifest V3 Chrome extension** featuring a gentle, cream-and-taupe pixel-art kitten companion that walks, naps, plays, and shares thoughtful love notes on ordinary webpages.

Everything runs completely locally within your browser. There are **zero tracking services, no external requests, no build tools, no packages, and no API keys required**.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎁 **Surprise Gifts** | Occasionally brings the user tiny presents (flower 🌸, heart 💗, star ⭐, or interactive wrapped present 🎁) with sweet romantic messages. |
| 🐾 **Interactive Idle Toys** | Plays with a rolling yarn ball, watches a fluttering butterfly, or pops a floating heart balloon with sparkling particles. |
| 🙈 **Edge Peekaboo Mode** | When stationed near viewport edges, playfully ducks behind the browser border and peeks back out to surprise you! |
| 💖 **Double-Click Quick-Pet** | Double-click or rapid-tap the kitten anywhere for an instant nuzzle reaction and rising hearts without opening menus. |
| ⏰ **Time-of-Day Care Notes** | Delivers caring, time-sensitive reminders: warm breakfast (morning), hydration & jaw relaxation (afternoon), dinner cheer (evening), and cozy bed reminders (night). |
| 💌 **Non-Repeating Love Notes** | Speech bubbles appear occasionally with sweet personal messages, never repeating consecutively. Automatically hides while typing in forms. |
| 💤 **Smart Sleep / Wake Toggle** | Menu button dynamically toggles between **Sleep** (closed eyes, floating `"z Z"`) and **Wake up** (sparkle burst). |
| 🎀 **Care & Happiness System** | **Pet** (+5) and **Feed** (+8 munching bowl) increase happiness up to 100. **Happiness never decays** and there are no starvation penalties. |
| 🎯 **Normalized Viewport Drag** | Drag the kitten anywhere. Position is remembered as a screen percentage so it adapts seamlessly across window resizes and multi-monitor setups. |
| 🔄 **Cross-Tab Synchronization** | Name, happiness, sleep state, and visibility stay synchronized across all open Chrome tabs via Chrome's local extension storage. |
| ♿ **Accessibility & Motion** | Respects operating system reduced-motion settings, uses isolated closed Shadow DOM, and supports full keyboard navigation (`Tab`, `Enter`, `Escape`). |

---

## 📥 Installation Guide

### 🍏 Install on macOS
1. Download or clone this repository to your Mac (e.g., in `Documents/Browser-Pet`).
2. Open **Google Chrome**.
3. In the address bar, type `chrome://extensions` and press **Enter**.
4. Turn on **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** in the top-left corner.
6. Select the **Browser-Pet** folder (the one containing `manifest.json`), then click **Select**.
7. Click Chrome's puzzle-piece **Extensions** icon in your toolbar and pin **Little Lovebug**.
8. Refresh any ordinary webpage (like [example.com](https://example.com)) to meet your kitten!

---

### 🪟 Install on Windows
1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the **Browser Pet** project folder containing `manifest.json`.
5. Pin **Little Lovebug** from Chrome's extension menu.
6. Refresh any open website to see your kitten appear near the bottom-right corner.

---

## 🎮 How to Interact With Your Kitten

* **Double-Click**: Instantly pet your kitten for floating hearts and nuzzles!
* **Single Click**: Opens the kitten's care menu. Click outside or press `Escape` to close.
* **Drag**: Pick up and move your kitten to any spot on your screen.
* **Pet**: Adds 5 happiness and releases hearts.
* **Feed**: Adds 8 happiness and brings out a pink food bowl with a happy eating animation.
* **Sleep / Wake up**: Toggles nap mode with floating dream bubbles. Click the kitten or choose Wake up to rouse her.
* **Rename**: Give your companion a custom name (up to 30 characters; defaults to *Lovebug*).
* **Hide / Show**: Hide the kitten across open tabs from the menu. Click the toolbar popup and toggle **Show my kitten** to bring her back.

---

## 🎨 Personalizing Notes & Appearance

* **Love Notes**: Open [`messages.js`](messages.js) and edit the text strings. You can add your own personal notes and customize the time-of-day greetings.
* **Character Atlas**: Artwork lives in [`pet-sprites.png`](pet-sprites.png) (a 768 × 960 transparent PNG containing 20 animation cells of 192 × 192 px).
* **Toolbar Art**: The sitting kitten icon is located at [`pet-sitting.png`](pet-sitting.png).
* **Styles & Animations**: Custom CSS animations and theme styling can be modified in [`pet.css`](pet.css).

---

## 🔒 Privacy & Permissions

* **Permission**: The only requested permission is `"storage"` (Chrome's local browser storage).
* **Zero Tracking**: Does not read browsing history, webpage content, keystrokes, or network activity.
* **Offline-Only**: Runs 100% locally with no analytics, backend servers, or third-party connections.

---

## 🧪 Automated Testing

If you have Node.js installed, you can run the built-in test suites without any dependencies:

```bash
# Run core animation and interaction tests
node --test tests/animation.test.cjs

# Run edge peekaboo regression tests
node --test tests/peekaboo.test.cjs
```

The tests verify:
- Manifest V3 permissions and resource paths.
- Frame and gesture independence in isolated Shadow DOM fixtures.
- Interrupted walking and dragged position persistence.
- Time-of-day message pool structures and anti-repeat logic.
- Reduced-motion accessibility compliance.

---

## 📄 License & Credits

Created with love. Feel free to customize and share it with your favorite person ♡.
