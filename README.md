# Browser-Pet

## Little Lovebug ♡

A small, original white kitten carrying a little extra love through your day. Everything runs locally. No account, internet service, packages, build step, or API key is needed.

## Install on Windows

1. Open **Google Chrome**.
2. Type `chrome://extensions` in the address bar and press Enter.
3. Turn on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** in the upper-left corner.
5. Select **your Little Lovebug project folder** (the folder containing `manifest.json`), then click **Select Folder**.
6. Open or refresh an ordinary website, such as `https://example.com`. The kitten should appear near the bottom-right corner.
7. Click Chrome's puzzle-piece **Extensions** button and pin **Little Lovebug** for easy access to its toolbar popup.

Keep this folder in place: Chrome loads the extension from it. If you move the folder, remove the old extension and load it again from its new location.

## Meet your kitten

- **Click** the kitten to open its menu. Click outside or press Escape to close it.
- **Drag** the kitten to a comfortable spot. Its position is remembered as a fraction of the available viewport, so it adapts to other window sizes.
- **Pet** adds 5 happiness; **Feed** adds 8 and releases a little heart. Happiness starts at 80 and stops at 100. It never decays.
- **Sleep** closes its eyes and floats little Zs. Click the kitten or choose **Wake up** to wake it.
- **Rename** opens a name field. Enter up to 30 characters and click Save or press Enter.
- **Hide** hides it across open webpages. Click its toolbar icon and turn **Show my kitten** on to bring it back.
- The kitten breathes, blinks, looks around, twitches an ear, swishes its tail, sometimes stretches, naps, and occasionally walks a short distance.
- A random love note may appear after at least three minutes. Notes last seven seconds, never take focus, are suppressed while typing or using the menu, and disappear when a key is pressed. Their timing is intentionally occasional.

Settings are shared across pages through Chrome's local extension storage. Sleep is shared, while little idle gestures happen separately on each page. Closed-browser time causes no penalties.

## Test it yourself

1. On an ordinary webpage, click the kitten and try Pet and Feed; check the heart meter and reactions.
2. Rename it, refresh the page, and confirm the name and happiness remain.
3. Choose Sleep, look for closed eyes and Zs, then click the kitten to wake it.
4. Drag it to each edge; resize your window and confirm it remains accessible.
5. Open two normal website tabs. Hide in one and confirm both hide. Show again from the toolbar popup.
6. Scroll, click website links, and type in a website form. Only the kitten and visible menu should capture pointer input.
7. Leave a visible page open for several minutes to see occasional idle behavior and messages. Type in a form to check message suppression.
8. Turn on your operating system's reduced-motion setting. Continuous CSS animations and walking should stop.
9. Use Tab to reach the kitten, press Enter to open its menu, and tab through the actions. Escape closes the menu.
10. On `chrome://extensions`, look for any **Errors** button under Little Lovebug. If present, open it and record the error text.

## After editing files

1. Save your changes.
2. Open `chrome://extensions`.
3. Click the circular **Reload** arrow on the Little Lovebug card.
4. Refresh every website tab where you want the updated kitten. Existing content scripts belong to the old version until the page reloads.
5. Close and reopen the toolbar popup.

## Install on a Mac

1. Copy this entire folder to the Mac (a ZIP is convenient for transfer; unzip it first).
2. Put it somewhere permanent, such as `Documents/Little Lovebug`.
3. Open Google Chrome and visit `chrome://extensions`.
4. Enable Developer mode, click Load unpacked, and select the copied folder containing `manifest.json`.
5. Open or refresh an ordinary website and pin the extension through the puzzle-piece menu.

No Windows-specific code is used by the extension. Stored settings do not transfer to the Mac automatically.

## Make it personal

- **Name:** click the kitten → Rename. The initial fallback name is `Lovebug` in `content.js` and `popup.js`.
- **Love notes:** edit the quoted strings in `messages.js`. Keep commas between strings; escape an internal double quote with `\"`. Messages and names are displayed as text, never executable HTML.
- **Appearance:** the active character uses `pet-sprites.png`, a four-column, five-row transparent sprite atlas. `pet-sitting.png` supplies the popup illustration. The original `pet.svg` is retained as artwork backup.
- **Colors and movement:** edit `pet.css`. The sprite canvas is 192 × 192 pixels, with a visible sitting kitten about 154 pixels tall. Change the `PET_SIZE` constant and matching sprite CSS geometry together if changing its size.
- **Popup:** edit `popup.html` and `popup.css`.
- **Behavior:** `content.js` manages gestures, drag positioning, menu actions, notes, and storage. `popup.js` controls the toolbar toggle. No service worker or backend is needed.

## Privacy and permissions

The only API permission is `storage`. HTTP/HTTPS content-script matches let the kitten appear on ordinary websites; Chrome may describe this as access to site data. The extension does not read browsing history, collect page contents, send data, or contact servers. Its resource loads use its own bundled CSS and sprite PNG. The manifest exposes only the listed local artwork and CSS resources. Chrome storage contains the name, happiness, visibility, sleep preference, and relative position.

## Limitations and troubleshooting

- Chrome blocks extensions on internal pages (`chrome://…`), the Chrome Web Store, some built-in viewers, and other protected surfaces. File URLs are deliberately unsupported. Try an ordinary HTTP/HTTPS website.
- Already-open pages must be refreshed after installation or extension reload. Incognito is off unless you explicitly enable it in Chrome.
- This is an unpacked extension. Chrome may show a Developer mode reminder. Nothing is published to the Web Store.
- Fullscreen elements, browser top-layer dialogs, and websites that deliberately remove overlays may obscure the kitten. A lightweight ten-second check restores it after ordinary DOM replacement.
- The overlay uses a closed Shadow DOM for style isolation, but websites still control their own document and can interfere with its host.
- Viewports smaller than the kitten itself cannot fit the whole artwork. Menus adapt to available space and scroll in short windows.
- While a tab is hidden, CSS animation pauses and idle actions are skipped. Browser power-saving rules can delay messages and timers.
- If Chrome storage temporarily fails, the kitten keeps working with in-memory values; those changes might not survive refresh or reach other tabs. Retry the action when storage works again.
- Rapid simultaneous changes in different tabs can overwrite the same preference; the latest saved value wins.
- A basic extension icon is supplied by Chrome; the toolbar popup has the full miniature kitten artwork.

## Checks performed during creation

- Passed JavaScript syntax checks using `node --check` for all three JavaScript files.
- Parsed the manifest, checked Manifest V3 and the storage-only API permission, and verified referenced files exist.
- Parsed the SVG as XML.
- Passed isolated popup checks with a mocked Chrome storage API: initial state, safe text display, visibility writes, cross-tab updates, and rollback after a failed save. Verified the six initial messages load. These checks do not simulate Chrome's actual extension runtime.
- Reviewed storage-based popup/content communication, safe text handling, resource exposure, viewport handling, and local-only architecture.
- Chrome installation and real browser interactions were **not** tested. Use the manual checklist above, including Windows and Mac behavior.

### Animation debugging update

The original high-happiness expression kept the eyes closed, preventing visible blinks. Pet and Feed shared a tiny heart reaction, and breathing was too subtle. These are now separate temporary reactions: Pet nuzzles and releases three floating hearts; Feed displays a food bowl and rhythmic eating motion. Happiness no longer permanently closes the eyes. Breathing, tail motion, regular blinks, and periodic ear twitches are more visible. Walking now gets a periodic opportunity as well as random opportunities, chooses a direction away from the viewport edge, and stops during interactions or sleep.

Headless Microsoft Edge (Chromium) checks passed using the actual content script, CSS, and SVG in Shadow DOM with simulated Chrome storage. Checks covered changing SVG animation transforms, Pet/Feed happiness updates and reaction styles, Sleep/Wake visibility, and reaction cleanup at high happiness. Reduced-motion checks confirmed animations stop while hearts, food, sleeping eyes, and Z symbols still provide visible feedback. This does not replace a manual test of the installed Chrome extension, dragging, or walking on real websites.

After this update, reload the extension on `chrome://extensions`, then refresh your website tabs. Choose Wake up if the saved kitten is asleep. Watch for breathing and tail swishes immediately, blinks within about five seconds, and ear twitches within about eleven seconds. With the menu closed, occasional walking gets an opportunity about every 20–45 seconds while awake and not typing. Reduced-motion settings intentionally disable movement.

Optional syntax checks, if Node.js is already installed: run `node --check content.js`, `node --check popup.js`, and `node --check messages.js` from this folder. Node.js is not needed to install or run the extension.


## Pixel-art character update

The attached reference is preserved byte-for-byte as little-lovebug-reference.png. The extension now uses pet-sprites.png, a transparent 768 × 960 PNG atlas containing twenty individual frames, rather than displaying the reference sheet. The atlas is cropped by CSS to exactly one 192 × 192 cell at a time. Four columns hold four frames per state; rows from top to bottom are sitting, blinking, walking right, sleeping, and petting. Cell coordinates are x = column × 192, y = row × 192 (zero-based). Feet align at y = 184 within each cell. Sitting is about 154px tall, petting poses up to 170px, and curled sleep is naturally shorter. Left walking mirrors the right-facing frames.

pet-sitting.png is the first isolated sitting frame for the toolbar popup. The original pet.svg is retained as artwork backup, but is no longer used by the character renderer. Existing name, happiness, position, hide/show, messages, dragging, sleep/wake and storage behavior remain. No packages or permissions were added. Reduced-motion users receive static state-appropriate frames.

This is a generated interpretation of the supplied kitten, not a pixel-for-pixel extraction. Small frame-to-frame fur and outline differences remain. The first five animation states are provided; Feed currently reuses happy frames with a food bowl and munch movement, rather than a separately drawn eating cycle. The atlas uses a shared scale and baseline; different poses naturally occupy different visible bounds.

Verification: JavaScript syntax, Manifest V3 references, storage-only permission, reference-copy hash, atlas dimensions and all twenty transparent cell corners passed. Headless Edge/Chromium checks using the actual scripts/CSS and mocked storage passed: single-frame clipping, timed blink frame selection, walking frames and left mirroring, Pet/Feed happiness and state selection, Sleep/Wake, Rename, and Hide/Show. The atlas was visually inspected for clipped characters and background artifacts. Full installed-Chrome behavior, actual drag pointer gestures, and macOS still require manual testing.

To use this update: visit chrome://extensions, click Reload on Little Lovebug, then refresh every website tab. If asleep, click Wake up. Try Pet and Feed, then Sleep and Wake up. Close the menu to allow occasional walking. The new saved position is clamped using the larger sprite canvas.
