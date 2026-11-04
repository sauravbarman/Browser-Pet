const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
const browser = [process.env.LOVEBUG_TEST_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome'
].find(file => file && fs.existsSync(file));

function bootstrap() {
  HTMLImageElement.prototype.decode = async function () {};
  const nativeMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let now = 0, id = 0, hidden = false, width = 800, height = 600;
  const timers = new Map(), frames = new Map(), listeners = [], writes = [], echoes = [];
  let random = .93, failStorage = false, delayEchoes = false;
  const data = { happiness: 80, position: { x: .5, y: .75 } };
  const clone = value => JSON.parse(JSON.stringify(value));
  const media = { matches: nativeMotion, addEventListener: (_, fn) => media.change = fn };
  window.matchMedia = () => media;
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  Object.defineProperty(window, 'innerWidth', { get: () => width });
  Object.defineProperty(window, 'innerHeight', { get: () => height });
  performance.now = () => now;
  Date.now = () => 1800000000000 + now;
  Math.random = () => random;
  window.setTimeout = (fn, delay) => { timers.set(++id, { at: now + delay, fn }); return id; };
  window.clearTimeout = timer => timers.delete(timer);
  window.setInterval = () => ++id;
  window.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  window.cancelAnimationFrame = frame => frames.delete(frame);
  const captured = new Set();
  Element.prototype.setPointerCapture = n => captured.add(n);
  Element.prototype.hasPointerCapture = n => captured.has(n);
  Element.prototype.releasePointerCapture = n => captured.delete(n);
  const attach = Element.prototype.attachShadow;
  let shadow;
  Element.prototype.attachShadow = function (options) { return shadow = attach.call(this, options); };
  const notify = changes => listeners.forEach(fn => fn(changes, 'local'));
  function update(patch) {
    const changes = {};
    for (const [key, value] of Object.entries(patch)) {
      changes[key] = { oldValue: data[key], newValue: clone(value) };
      data[key] = clone(value);
    }
    return changes;
  }
  window.chrome = {
    runtime: { getURL: file => file === 'pet-sprites.png' ? parent.assets.png : file },
    storage: {
      local: {
        get: async defaults => ({ ...defaults, ...clone(data) }),
        set: async patch => {
          if (failStorage) throw Error('Simulated unavailable storage');
          writes.push(clone(patch));
          const changes = update(patch);
          if (delayEchoes) echoes.push(changes); else queueMicrotask(() => notify(changes));
        }
      },
      onChanged: { addListener: fn => listeners.push(fn) }
    }
  };
  window.fetch = async file => ({ ok: file === 'pet.css', text: async () => parent.assets.css });
  window.harness = {
    get root() { return shadow; }, data, writes,
    allowGift: true,
    random: value => random = value,
    tick(ms) {
      const end = now + ms;
      let count = 0;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        if (++count > 2000) throw Error('Timer loop in tick');
        now = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      now = end;
    },
    next() { this.tick(Math.min(...[...timers.values()].map(t => t.at)) - now); },
    frame(ms) {
      now += ms;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(fn => fn(now));
    },
    visibility(value) { hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
    reduced(value) { media.matches = value; media.change?.(); },
    resize(w, h) { width = w; height = h; dispatchEvent(new Event('resize')); },
    remote: patch => notify(update(patch))
  };
}

async function runSurpriseGiftScenarios() {
  const results = [];
  function check(ok, message) { if (!ok) throw Error(message); }

  async function fresh(config = {}) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:800px;height:600px';
    document.body.append(iframe);
    const w = iframe.contentWindow;
    let initError = '';
    w.addEventListener('error', e => initError = e.message);
    w.console.warn = (...args) => initError = args.join(' ');
    const script = w.document.createElement('script');
    script.textContent = `(${parent.bootstrapText})();` + parent.assets.messages + parent.assets.content;
    w.document.head.append(script);
    for (let n = 0; !w.harness.root?.querySelector('.anchor'); n++) {
      if (n > 100) throw Error('Content script failed to initialize: ' + initError);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const h = w.harness, root = h.root, anchor = root.querySelector('.anchor');
    if (config.reduced) h.reduced(true);
    return {
      h, w, root, anchor,
      remove: () => iframe.remove(),
      x: () => parseFloat(anchor.style.left),
      y: () => parseFloat(anchor.style.top),
      gift: () => root.querySelector('.surprise-gift'),
      bubble: () => root.querySelector('.bubble'),
      panel: () => root.querySelector('.panel'),
      triggerGift: kind => w.__lovebugGift(kind),
      clickGift: () => {
        const g = root.querySelector('.surprise-gift');
        if (!g) throw Error('No gift element to click');
        g.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        g.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      },
      keyGift: key => {
        const g = root.querySelector('.surprise-gift');
        if (!g) throw Error('No gift element for keyboard');
        g.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }
    };
  }

  async function scenario(name, fn) {
    const pet = await fresh();
    try { await fn(pet); results.push(`PASS ${name}`); }
    finally { pet.remove(); }
  }

  // 1. All four gift types render with proper SVGs, accessible labels, and structure
  await scenario('all four gift types render correctly', async p => {
    for (const kind of ['flower', 'heart', 'star', 'present']) {
      p.triggerGift(kind);
      p.h.tick(400); // appearance tick
      const gift = p.gift();
      check(Boolean(gift), `Gift ${kind} was not rendered`);
      check(gift.classList.contains(`gift-${kind}`), `Gift missing class gift-${kind}`);
      check(gift.getAttribute('role') === 'button', `Gift ${kind} missing role="button"`);
      check(gift.getAttribute('tabindex') === '0', `Gift ${kind} missing tabindex="0"`);
      check(Boolean(gift.getAttribute('aria-label')), `Gift ${kind} missing aria-label`);

      if (kind === 'flower') {
        check(Boolean(gift.querySelector('svg')), 'Flower missing SVG');
      } else if (kind === 'heart') {
        check(Boolean(gift.querySelector('svg')), 'Heart missing SVG');
      } else if (kind === 'star') {
        check(Boolean(gift.querySelector('svg')), 'Star missing SVG');
      } else if (kind === 'present') {
        check(Boolean(gift.querySelector('.gift-box-lid')), 'Present missing lid');
        check(Boolean(gift.querySelector('.gift-box-base')), 'Present missing base');
        check(Boolean(gift.querySelector('.gift-bow')), 'Present missing bow');
        check(Boolean(gift.querySelector('.gift-surprise-item')), 'Present missing surprise item');
      }

      // Cleanup before next gift
      p.h.tick(15000);
      check(!p.gift(), `Gift ${kind} did not expire`);
    }
  });

  // 2. Gift presentation animations and message bubble
  await scenario('gift presentation shows affectionate message bubble', async p => {
    p.triggerGift('flower');
    p.h.tick(400);
    const initialPos = { x: p.x(), y: p.y() };
    p.h.tick(800); // presentation + twitch pose + message tick
    check(!p.bubble().hidden, 'Message bubble did not appear for gift');
    check(p.bubble().textContent.length > 5, 'Message bubble empty');
    check(p.x() === initialPos.x && p.y() === initialPos.y, 'Kitten position changed during gift presentation');
    check(p.panel().hidden, 'Care menu opened unexpectedly during gift presentation');
  });

  // 3. Wrapped present opens on click without opening kitten menu
  await scenario('wrapped present opens on click and reveals surprise without opening menu', async p => {
    p.triggerGift('present');
    p.h.tick(800);
    const initialHappiness = p.h.data.happiness;
    check(!p.gift().classList.contains('opened'), 'Present opened prematurely');

    p.clickGift(); // click the gift directly
    p.h.tick(200);

    check(p.gift().classList.contains('opened'), 'Present missing opened class');
    const surprise = p.gift().querySelector('.gift-surprise-item');
    check(Boolean(surprise) && surprise.textContent.length > 0, 'No surprise revealed inside present');
    check(p.panel().hidden, 'Care menu was opened when clicking gift box');
    check(p.h.data.happiness >= initialHappiness, 'Happiness decreased when opening present');

    // Reveal message displayed
    check(!p.bubble().hidden, 'Reveal message bubble did not display');

    // Fades out naturally after reveal duration
    p.h.tick(5000);
    check(!p.gift(), 'Opened present did not fade out after display');
  });

  // 4. Wrapped present keyboard activation with Enter and Space
  await scenario('wrapped present activates with Enter and Space keys', async p => {
    p.triggerGift('present');
    p.h.tick(800);
    p.keyGift('Enter');
    p.h.tick(200);
    check(p.gift().classList.contains('opened'), 'Present did not open on Enter key');
    check(p.panel().hidden, 'Care menu opened on keyboard activation');
  });

  // 5. Flower, heart, star click acceptance
  await scenario('clicking flower, heart, or star triggers affectionate acceptance', async p => {
    for (const kind of ['flower', 'heart', 'star']) {
      p.triggerGift(kind);
      p.h.tick(800);
      p.clickGift();
      p.h.tick(200);
      check(p.gift().classList.contains('accepted'), `Gift ${kind} did not get accepted class`);
      check(p.panel().hidden, `Clicking ${kind} opened care menu`);
      p.h.tick(4000);
      check(!p.gift(), `Gift ${kind} lingered after acceptance`);
    }
  });

  // 6. Ignored gifts expire naturally without penalty
  await scenario('ignored gifts expire gently without happiness penalty', async p => {
    p.triggerGift('heart');
    p.h.tick(1200);
    const startHappy = p.h.data.happiness;
    check(Boolean(p.gift()), 'Gift not present before expiration');
    check(!p.bubble().hidden, 'Bubble not showing before expiration');

    // Advance clock past expiration
    p.h.tick(14000);
    check(!p.gift(), 'Gift element was not removed after timeout');
    check(p.bubble().hidden, 'Bubble was not hidden after gift expiration');
    check(p.h.data.happiness === startHappy, `Happiness changed from ${startHappy} to ${p.h.data.happiness}`);
  });

  // 7. Dragging kitten safely cancels gift
  await scenario('starting a drag on kitten cancels gift immediately', async p => {
    p.triggerGift('flower');
    p.h.tick(800);
    check(Boolean(p.gift()), 'Gift not present');

    // User starts dragging the kitten
    p.root.querySelector('.kitten').dispatchEvent(new p.w.PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 50, clientY: 50 }));
    check(!p.gift(), 'Gift was not cancelled by drag pointerdown');
    check(p.bubble().hidden, 'Gift bubble was not hidden on drag');
  });

  // 8. Sleep cancels gift safely
  await scenario('putting kitten to sleep cancels gift safely', async p => {
    p.triggerGift('star');
    p.h.tick(800);
    check(Boolean(p.gift()), 'Gift not present');

    p.h.remote({ sleeping: true });
    p.h.tick(100);
    check(!p.gift(), 'Gift was not cancelled by sleep');
  });

  // 9. Visibility change and window resize cancel gift safely
  await scenario('tab hidden and window resize cancel gift safely', async p => {
    p.triggerGift('present');
    p.h.tick(800);
    check(Boolean(p.gift()), 'Gift not present');

    p.h.visibility(true); // tab hidden
    check(!p.gift(), 'Gift was not cancelled when tab became hidden');

    p.h.visibility(false);
    p.triggerGift('present');
    p.h.tick(800);
    check(Boolean(p.gift()), 'Second gift not present');

    p.h.resize(500, 400); // resize window
    check(!p.gift(), 'Gift was not cancelled on window resize');
  });

  // 10. Gift messages setting toggling
  await scenario('disabling gift messages suppresses message bubble while keeping gift interactive', async p => {
    p.h.remote({ giftMessages: false });
    p.triggerGift('flower');
    p.h.tick(1200);
    check(Boolean(p.gift()), 'Gift missing when giftMessages is false');
    check(p.bubble().hidden, 'Message bubble was displayed despite giftMessages: false');
    p.clickGift();
    p.h.tick(200);
    check(p.gift().classList.contains('accepted'), 'Gift not interactive when messages disabled');
  });

  // 11. Disabling surpriseGifts suppresses gifts entirely and cancels active gifts
  await scenario('disabling surpriseGifts cancels active gift and prevents new gifts', async p => {
    p.triggerGift('star');
    p.h.tick(800);
    check(Boolean(p.gift()), 'Gift did not start');

    p.h.remote({ surpriseGifts: false });
    check(!p.gift(), 'Active gift not cancelled when surpriseGifts disabled');

    p.triggerGift();
    p.h.tick(800);
    check(!p.gift(), 'New gift triggered when surpriseGifts is disabled');
  });

  // 12. Reduced motion presents gifts in static accessible form
  const pReduced = await fresh({ reduced: true });
  try {
    pReduced.triggerGift('present');
    pReduced.h.tick(200);
    const g = pReduced.gift();
    check(Boolean(g), 'Gift present rendered in reduced motion');
    check(g.getAttribute('role') === 'button', 'Gift accessible in reduced motion');
    pReduced.clickGift();
    pReduced.h.tick(200);
    check(g.classList.contains('opened'), 'Present opened in reduced motion');
    results.push('PASS reduced motion presents gifts statically and remains interactive');
  } finally {
    pReduced.remove();
  }

  return results;
}

test('Feature 6: Surprise Gifts scenarios in Chromium', { skip: !browser }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebug-gifts-'));
  const assets = {
    content: read('content.js'),
    css: read('pet.css'),
    messages: read('messages.js'),
    png: 'data:image/png;base64,' + fs.readFileSync(path.join(project, 'pet-sprites.png')).toString('base64')
  };
  const html = '<!doctype html><meta charset="utf-8"><pre id="results">RUNNING</pre><script>' +
    'window.assets=' + JSON.stringify(assets) + ';window.bootstrapText=' + JSON.stringify(bootstrap.toString()) + ';' +
    '(' + runSurpriseGiftScenarios.toString() + ')().then(results=>{document.getElementById("results").textContent=JSON.stringify({ok:true,results})}).catch(error=>{document.getElementById("results").textContent=JSON.stringify({ok:false,error:error.stack})});</script>';
  const file = path.join(temp, 'test.html');
  fs.writeFileSync(file, html);
  const run = spawnSync(browser, [
    '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--user-data-dir=' + path.join(temp, 'profile'), '--virtual-time-budget=20000',
    '--dump-dom', new URL('file:///' + file.replaceAll('\\', '/')).href
  ], { encoding: 'utf8', timeout: 45000, maxBuffer: 5000000 });
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stderr?.slice(-1000));
  const result = run.stdout.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
  assert.ok(result && result !== 'RUNNING', 'Browser test did not finish');
  const parsed = JSON.parse(result.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&'));
  assert.equal(parsed.ok, true, parsed.error);
  for (const line of parsed.results) console.log(line);
});
