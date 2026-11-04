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
  const data = { happiness: 80, position: { x: .1, y: .75 } }; // near left edge
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
    allowPeekaboo: true,
    random: value => random = value,
    tick(ms) {
      const end = now + ms;
      let count = 0;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        if (++count > 1000) throw Error('Timer loop');
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
    resize(w, h) { width = w; height = h; dispatchEvent(new Event('resize')); }
  };
}

async function runPeekabooScenarios() {
  const results = [];
  function check(ok, message) { if (!ok) throw Error(message); }
  function close(actual, expected, message) { check(Math.abs(actual - expected) < 2, `${message}: ${actual} vs ${expected}`); }

  async function fresh(initialPos = { x: .1, y: .75 }) {
    const iframe = document.createElement('iframe'); iframe.style.cssText = 'width:800px;height:600px';
    document.body.append(iframe);
    const w = iframe.contentWindow;
    let initError = '';
    w.addEventListener('error', e => initError = e.message);
    w.console.warn = (...args) => initError = args.join(' ');
    const script = w.document.createElement('script');
    script.textContent = `(${parent.bootstrapText})();` + parent.assets.messages + parent.assets.content;
    w.document.head.append(script);
    for (let n = 0; !w.harness.root?.querySelector('.anchor'); n++) {
      if (n > 100) throw Error('Failed to init: ' + initError);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const h = w.harness, root = h.root, anchor = root.querySelector('.anchor');
    return { h, w, root, anchor, remove: () => iframe.remove(),
      x: () => parseFloat(anchor.style.left), y: () => parseFloat(anchor.style.top),
      style: selector => w.getComputedStyle(root.querySelector(selector)),
      action: name => [...root.querySelectorAll('.actions button')].find(b => b.textContent === name).click(),
      triggerPeekaboo: () => w.__lovebugPeekaboo?.(),
      pointer(type, x = 30, y = 30) {
        root.querySelector('.kitten').dispatchEvent(new w.PointerEvent(type, { pointerId: 1, button: 0, clientX: x, clientY: y }));
      }
    };
  }

  async function scenario(name, fn) {
    const pet = await fresh();
    try { await fn(pet); results.push(`PASS ${name}`); }
    finally { pet.remove(); }
  }

  // 1. Trigger Peekaboo toward nearest (left) edge
  await scenario('kitten walks toward left edge when positioned near left', async p => {
    const initialX = p.x(); // (800 - 192) * 0.1 = 60.8px
    p.triggerPeekaboo();
    check(p.anchor.classList.contains('walking'), 'Walk did not start');
    check(p.anchor.classList.contains('facing-left'), 'Should face left toward edge');
    // Advance frames to walk to edge
    p.h.frame(2000);
    // At edge: should have stopped walking and started peeking
    check(!p.anchor.classList.contains('walking'), 'Should stop walking at edge');
    check(p.anchor.classList.contains('peeking'), 'Should have peeking class');
    check(p.anchor.classList.contains('peekaboo-left'), 'Should have peekaboo-left class');
    check(!p.anchor.classList.contains('facing-left'), 'Should face inward (right) while peeking');
    check(p.x() < 0, `Kitten should be partially hidden (negative x), actual: ${p.x()}`);
    close(p.x(), -117, 'Edge x position');
  });

  // 1b. Trigger Peekaboo toward right edge when positioned near right
  await scenario('kitten walks toward right edge when positioned near right', async p => {
    // Reposition near right edge: x = 500 (maxX = 608)
    p.anchor.style.left = '520px';
    p.h.data.position.x = 520 / 608;
    p.triggerPeekaboo();
    check(p.anchor.classList.contains('walking'), 'Walk did not start');
    check(!p.anchor.classList.contains('facing-left'), 'Should face right toward right edge');
    p.h.frame(2000);
    check(!p.anchor.classList.contains('walking'), 'Should stop walking at right edge');
    check(p.anchor.classList.contains('peeking'), 'Should have peeking class');
    check(p.anchor.classList.contains('peekaboo-right'), 'Should have peekaboo-right class');
    check(p.anchor.classList.contains('facing-left'), 'Should face inward (left) while peeking');
    check(p.x() > 800 - 192, `Kitten should be past maxX: ${p.x()}`);
    close(p.x(), 800 - 75, 'Right edge x position');
  });

  // 2. Full Peekaboo cycle: walks to edge, peeks, then returns home smoothly
  await scenario('kitten completes peek and returns smoothly to original position', async p => {
    const originalX = p.x();
    p.triggerPeekaboo();
    // Step 1: walk to edge
    p.h.frame(2000);
    check(p.anchor.classList.contains('peeking'), 'Should be peeking at edge');
    // Step 2: peek duration (advance timer)
    p.h.tick(4500);
    check(p.anchor.classList.contains('walking'), 'Return walk should start');
    // Step 3: return walk frames
    p.h.frame(2000);
    check(!p.anchor.classList.contains('walking'), 'Return walk should complete');
    check(!p.anchor.classList.contains('peeking'), 'Peeking class should be removed');
    close(p.x(), originalX, 'Returned to exact original position');
  });

  // 3. Interruption by clicking kitten cancels peekaboo, clamps to screen, and opens menu
  await scenario('clicking during peekaboo cancels and opens menu within viewport', async p => {
    p.triggerPeekaboo();
    p.h.frame(2000); // at edge
    check(p.x() < 0, 'Kitten is at edge');
    // Click kitten
    p.pointer('pointerdown');
    p.pointer('pointerup');
    p.root.querySelector('.kitten').click();
    p.h.tick(300);
    // Menu should be open and kitten should be clamped >= 0
    check(!p.root.querySelector('.panel').hidden, 'Menu should open');
    check(p.x() >= 0, `Kitten must be clamped into viewport, actual: ${p.x()}`);
    check(!p.anchor.classList.contains('peeking'), 'Peeking class removed');
  });

  // 4. Interruption by dragging during peekaboo preserves dragged position
  await scenario('dragging during peekaboo cancels and allows new position', async p => {
    p.triggerPeekaboo();
    p.h.frame(500); // midway walking
    p.pointer('pointerdown', 30, 30);
    p.pointer('pointermove', 150, 30);
    p.pointer('pointerup', 150, 30);
    check(!p.anchor.classList.contains('walking'), 'Walking removed on drag');
    check(!p.anchor.classList.contains('peeking'), 'Peeking not active');
    p.h.frame(3000);
    check(p.x() > 100, `Dragged position preserved: ${p.x()}`);
  });

  // 5. Putting to sleep during peekaboo cancels and sleeps at clamped position
  await scenario('putting to sleep during peekaboo cancels safely', async p => {
    p.triggerPeekaboo();
    p.h.frame(1000);
    p.action('Sleep');
    check(p.anchor.classList.contains('sleeping'), 'Kitten is sleeping');
    check(!p.anchor.classList.contains('walking'), 'Walking cancelled');
    check(!p.anchor.classList.contains('peeking'), 'Peeking cancelled');
    check(p.x() >= 0, `Position clamped to viewport: ${p.x()}`);
  });

  // 6. Reduced motion prevents peekaboo from starting
  await scenario('reduced motion prevents peekaboo', async p => {
    p.h.reduced(true);
    p.triggerPeekaboo();
    check(!p.anchor.classList.contains('walking'), 'Should not start walking in reduced motion');
    check(!p.anchor.classList.contains('peeking'), 'Should not start peeking in reduced motion');
  });

  return results;
}

test('Feature 3: Peekaboo Mode scenarios in Chromium', { skip: !browser }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebug-peekaboo-'));
  const assets = {
    content: read('content.js'),
    css: read('pet.css'),
    messages: read('messages.js'),
    png: 'data:image/png;base64,' + fs.readFileSync(path.join(project, 'pet-sprites.png')).toString('base64')
  };
  const html = '<!doctype html><meta charset="utf-8"><pre id="results">RUNNING</pre><script>' +
    'window.assets=' + JSON.stringify(assets) + ';window.bootstrapText=' + JSON.stringify(bootstrap.toString()) + ';' +
    '(' + runPeekabooScenarios.toString() + ')().then(results=>{document.getElementById("results").textContent=JSON.stringify({ok:true,results})}).catch(error=>{document.getElementById("results").textContent=JSON.stringify({ok:false,error:error.stack})});</script>';
  const file = path.join(temp, 'test.html');
  fs.writeFileSync(file, html);
  const run = spawnSync(browser, [
    '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--user-data-dir=' + path.join(temp, 'profile'), '--virtual-time-budget=15000',
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
