// No packages or production test hooks. Run: node --test tests/animation.test.cjs
// Uses an installed Chromium browser, the real script/CSS/artwork, controlled
// clocks, synthetic pointer events, and an in-memory Chrome storage API.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
const browser = [process.env.LOVEBUG_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome'
].find(file => file && fs.existsSync(file));

// Executed in a fresh iframe for every scenario. No credentials or GitHub calls.
function bootstrap() {
  // The parent loads the atlas once before installing controlled iframe clocks.
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
  window.setInterval = () => ++id; // Root-replacement health check is outside this suite.
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
    random: value => random = value,
    unavailable: () => failStorage = true,
    delay: () => delayEchoes = true,
    flush: () => { while (echoes.length) notify(echoes.shift()); },
    remote: patch => notify(update(patch)),
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

async function scenarios(reducedOnly) {
  const results = [];
  const artwork = new Image();
  await new Promise((resolve, reject) => { artwork.onload = resolve; artwork.onerror = () => reject(Error('Atlas did not load')); artwork.src = assets.png; });
  if (artwork.naturalWidth !== 768 || artwork.naturalHeight !== 960) throw Error('Wrong atlas geometry');
  function check(ok, message) { if (!ok) throw Error(message); }
  function close(actual, expected, message) { check(Math.abs(actual - expected) < .01, `${message}: ${actual} vs ${expected}`); }
  async function fresh() {
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
      if (n > 100) throw Error('Content script failed to initialize: ' + initError);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const h = w.harness, root = h.root, anchor = root.querySelector('.anchor');
    return { h, w, root, anchor, remove: () => iframe.remove(),
      x: () => parseFloat(anchor.style.left), y: () => parseFloat(anchor.style.top),
      style: selector => w.getComputedStyle(root.querySelector(selector)),
      action: name => [...root.querySelectorAll('.actions button')].find(b => b.textContent === name).click(),
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
  function startWalk(pet) {
    pet.h.next(); check(pet.anchor.classList.contains('walking'), 'Walk did not start');
    pet.h.frame(850); close(pet.x(), 336.5, 'Halfway walk position');
  }
  async function settled() { await Promise.resolve(); await Promise.resolve(); }
  if (reducedOnly) {
    await scenario('reduced-motion static sitting, petting, feeding and sleeping frames', async p => {
      check(p.style('.sprite').animationName === 'none', 'Idle animation enabled');
      p.h.tick(50000); check(!p.anchor.classList.contains('walking'), 'Reduced motion started walk');
      for (const name of ['Pet', 'Feed']) {
        p.action(name); check(p.style('.sprite').backgroundPositionY === '-768px', 'Wrong happy static row');
        check(p.style('.gesture').animationName === 'none', 'Wrapper still animated');
        check(p.style('.particle').opacity === '1', 'Feedback invisible');
      }
      p.action('Sleep'); check(p.style('.sprite').backgroundPositionY === '-576px', 'Wrong sleeping static row');
      check(p.style('.sprite-z').display === 'block', 'Missing sleep Z');
      p.action('Wake up'); check(p.style('.sprite').backgroundPositionY === '0px', 'Wake did not restore sitting');
    });
    return results;
  }
  for (const [name, random, animation] of [['stretch', .85, 'sprite-stretch'], ['twitch', .7, 'sprite-twitch']]) {
    await scenario(`${name} keeps the sitting/blink animation on the sprite`, p => {
      const sprite = p.root.querySelector('.sprite'), original = sprite.getAnimations()[0];
      p.h.random(random); p.h.next();
      check(p.anchor.classList.contains(name), 'Pose did not start');
      check(p.style('.gesture').animationName === animation, 'Wrapper gesture absent');
      check(sprite.getAnimations()[0] === original, 'Frame animation restarted or replaced');
      check(p.style('.sprite').animationName === 'sprite-idle', 'Sprite frame sequence changed');
      original.pause(); original.currentTime = 4400;
      check(p.style('.sprite').backgroundPositionY === '-192px', 'Blink frames no longer advance');
      p.pointer('pointerdown'); check(!p.anchor.classList.contains(name), 'Interaction did not cancel pose');
    });
  }
  await scenario('sixth idle tick selects a walk without also starting a pose', p => {
    p.h.random(.85);
    for (let n = 0; n < 5; n++) { p.h.next(); p.h.tick(2000); }
    p.h.next(); check(p.anchor.classList.contains('walking'), 'Periodic walk absent');
    check(!p.anchor.classList.contains('stretch'), 'Periodic walk overlaps stretch');
  });
  const interrupts = {
    'pointer down': p => p.pointer('pointerdown'),
    'keyboard menu open': p => p.root.querySelector('.kitten').click(),
    'Pet': p => p.action('Pet'), 'Feed': p => p.action('Feed'),
    'Sleep': p => p.action('Sleep'), 'Hide': p => p.action('Hide'),
    'external hide': p => p.h.remote({ hidden: true }),
    'external sleep': p => p.h.remote({ sleeping: true }),
    'tab visibility': p => p.h.visibility(true),
    'reduced-motion change': p => p.h.reduced(true),
    'resize': p => p.h.resize(700, 600)
  };
  for (const [name, interrupt] of Object.entries(interrupts)) {
    await scenario(`interrupted walk persists last visible position: ${name}`, async p => {
      startWalk(p); const visible = p.x(); interrupt(p); await settled();
      close(p.x(), visible, 'Interrupt snapped back');
      check(!p.anchor.classList.contains('walking'), 'Walk class remains');
      close(p.h.data.position.x * (p.w.innerWidth - 192), visible, 'Persisted position incorrect');
      p.h.frame(3000); close(p.x(), visible, 'Stale RAF moved stopped kitten');
      p.h.remote({ happiness: 94 }); close(p.x(), visible, 'Unrelated render moved stopped kitten');
    });
  }
  await scenario('viewport shrink clamps interrupted walk to the edge', async p => {
    startWalk(p); p.h.resize(400, 300); await settled();
    close(p.x(), 208, 'Horizontal clamp'); close(p.y(), 108, 'Vertical clamp');
    close(p.h.data.position.x, 1, 'Normalized horizontal edge'); close(p.h.data.position.y, 1, 'Normalized vertical edge');
  });
  await scenario('a viewport smaller than the sprite never stores NaN or infinity', p => {
    startWalk(p); p.h.resize(100, 100);
    close(p.x(), 0, 'Small viewport x'); close(p.y(), 0, 'Small viewport y');
    close(p.h.data.position.x, 0, 'Small normalized x'); close(p.h.data.position.y, 0, 'Small normalized y');
  });
  await scenario('drag continues from the interrupted walk; delayed own echoes cannot rewind it', p => {
    p.h.delay(); startWalk(p); p.pointer('pointerdown'); p.pointer('pointermove', 70, 30); p.pointer('pointerup', 70, 30);
    close(p.x(), 376.5, 'Drag origin was stale');
    p.h.flush(); close(p.x(), 376.5, 'Delayed storage echo rewound drag');
    p.h.frame(3000); close(p.x(), 376.5, 'Cancelled walk overwrote drag');
    close(p.h.data.position.x * 608, 376.5, 'Drag not saved');
  });
  await scenario('unrelated storage render during a walk uses its live position', p => {
    startWalk(p); p.h.remote({ name: 'Mochi', happiness: 95 }); close(p.x(), 336.5, 'Render used pre-walk save');
    p.h.frame(850); close(p.x(), 369, 'Walk did not finish at target');
    close(p.h.data.position.x * 608, 369, 'Completed walk not persisted');
  });
  await scenario('another tab position cancels stale walk callbacks and synchronizes', p => {
    startWalk(p); p.h.remote({ position: { x: .2, y: .4, writer: 'another-tab' } });
    close(p.x(), 121.6, 'Remote position not applied'); p.h.frame(3000); close(p.x(), 121.6, 'Old walk overwrote remote position');
  });
  await scenario('storage failures preserve the interrupted position in memory', async p => {
    startWalk(p); p.h.unavailable(); p.action('Pet'); await settled();
    p.h.remote({ name: 'Still here' }); close(p.x(), 336.5, 'Storage failure lost live position');
    check(p.anchor.classList.contains('petting'), 'Storage failure prevented reaction');
  });
  for (const blocked of ['reaction', 'menu', 'typing']) {
    await scenario(`idle actions cannot overlap ${blocked}`, p => {
      p.h.tick(7000);
      if (blocked === 'reaction') p.action('Pet');
      else if (blocked === 'menu') p.root.querySelector('.kitten').click();
      else { const input = p.w.document.createElement('input'); p.w.document.body.append(input); input.focus(); }
      p.h.tick(220); check(!p.anchor.classList.contains('walking'), 'Walk started while interacting');
      for (const cls of ['stretch', 'twitch', 'blink', 'look', 'look-left']) check(!p.anchor.classList.contains(cls), 'Pose started while interacting');
    });
  }
  await scenario('hide during a drag releases it and Show permits later walks', async p => {
    p.pointer('pointerdown'); p.pointer('pointermove', 70, 30); p.h.remote({ hidden: true });
    check(p.w.document.querySelector('little-lovebug').style.display === 'none', 'Hide did not apply');
    p.h.remote({ hidden: false }); p.h.next();
    check(p.anchor.classList.contains('walking'), 'Hidden drag remained stuck');
    await settled();
  });
  await scenario('care, rename and visibility remain usable', async p => {
    const sleepBtn = [...p.root.querySelectorAll('.actions button')].find(b => b.textContent === 'Sleep');
    const wakeBtn = [...p.root.querySelectorAll('.actions button')].find(b => b.textContent === 'Wake up');
    check(sleepBtn.style.display !== 'none' && wakeBtn.style.display === 'none', 'Initial Sleep button visibility wrong');
    p.action('Pet'); p.action('Feed'); check(p.h.data.happiness === 93, 'Happiness actions failed');
    p.action('Sleep'); check(p.style('.sprite').backgroundPositionY === '-576px', 'Sleep row wrong');
    check(sleepBtn.style.display === 'none' && wakeBtn.style.display !== 'none', 'Sleeping Wake up button visibility wrong');
    p.action('Wake up'); check(p.style('.sprite-z').display === 'none', 'Wake Z remains');
    check(sleepBtn.style.display !== 'none' && wakeBtn.style.display === 'none', 'Woken Sleep button visibility wrong');
    p.action('Rename'); const form = p.root.querySelector('.rename'); form.querySelector('input').value = 'Mochi';
    form.dispatchEvent(new p.w.Event('submit', { cancelable: true }));
    check(p.h.data.name === 'Mochi', 'Rename not saved');
    p.action('Hide'); p.h.remote({ hidden: false });
    check(p.w.document.querySelector('little-lovebug').style.display === 'block', 'Show did not restore kitten');
    await settled();
  });
  await scenario('occasional local notes appear between gestures, block walking and expire', p => {
    p.h.random(.1); p.h.tick(181000);
    // A pending walk is deliberately completed to allow the next note opportunity.
    p.h.frame(1700); p.h.next();
    check(!p.root.querySelector('.bubble').hidden, 'Local note did not appear');
    check(p.root.querySelector('.bubble').textContent.length > 0, 'Note empty');
    check(!p.anchor.classList.contains('walking'), 'Walk overlapped note');
    p.h.tick(7000); check(p.root.querySelector('.bubble').hidden, 'Note did not expire');
  });
  await scenario('random notes avoid immediate repeats and handle short message lists', p => {
    const bubble = p.root.querySelector('.bubble');
    const nextNote = () => { p.h.tick(181000); p.h.frame(1700); p.h.next(); };
    p.h.random(.1); p.w.LOVEBUG_MESSAGES = ['First note', 'Second note']; nextNote();
    check(bubble.textContent === 'First note', 'First random note was not selected');
    p.h.tick(7000); nextNote();
    check(bubble.textContent === 'Second note', 'Random note immediately repeated');
    p.h.tick(7000); p.w.LOVEBUG_MESSAGES = ['Only note']; nextNote();
    check(bubble.textContent === 'Only note', 'One-item message list was not displayed');
    p.h.tick(7000); p.w.LOVEBUG_MESSAGES = []; nextNote();
    check(bubble.hidden, 'Empty message list displayed a note');
  });
  return results;
}

for (const reduced of [false, true]) {
  test(`Chromium regressions${reduced ? ' with reduced motion' : ''}`, { skip: !browser }, () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lovebug-animation-'));
    const assets = { content: read('content.js'), css: read('pet.css'), messages: read('messages.js'),
      png: 'data:image/png;base64,' + fs.readFileSync(path.join(project, 'pet-sprites.png')).toString('base64') };
    const html = '<!doctype html><meta charset="utf-8"><pre id="results">RUNNING</pre><script>' +
      'window.assets=' + JSON.stringify(assets) + ';window.bootstrapText=' + JSON.stringify(bootstrap.toString()) + ';' +
      '(' + scenarios.toString() + ')(' + reduced + ').then(results=>{document.getElementById("results").textContent=JSON.stringify({ok:true,results})}).catch(error=>{document.getElementById("results").textContent=JSON.stringify({ok:false,error:error.stack})});</script>';
    const file = path.join(temp, 'test.html'); fs.writeFileSync(file, html);
    const run = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run',
      '--user-data-dir=' + path.join(temp, 'profile'), '--virtual-time-budget=15000',
      ...(reduced ? ['--force-prefers-reduced-motion=reduce'] : []), '--dump-dom', new URL('file:///' + file.replaceAll('\\', '/')).href
    ], { encoding: 'utf8', timeout: 45000, maxBuffer: 5000000 });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stderr?.slice(-1000));
    const result = run.stdout.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(result && result !== 'RUNNING', 'Browser test did not finish');
    const parsed = JSON.parse(result.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&'));
    assert.equal(parsed.ok, true, parsed.error);
    assert.equal(parsed.results.length, reduced ? 1 : 27, 'Some browser scenarios did not execute');
    for (const line of parsed.results) console.log(line);
    // Files remain in the OS temp directory for diagnosing a browser failure.
  });
}

test('MV3 permissions and all local manifest resources remain valid', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const file of [...manifest.content_scripts.flatMap(c => c.js),
    ...manifest.web_accessible_resources.flatMap(r => r.resources), manifest.action.default_popup]) {
    assert.ok(fs.existsSync(path.join(project, file)), file);
  }
  require(path.join(project, 'messages.js'));
  assert.ok(Array.isArray(globalThis.LOVEBUG_MESSAGES) && globalThis.LOVEBUG_MESSAGES.length > 0);
  assert.ok(globalThis.LOVEBUG_TIME_MESSAGES && typeof globalThis.LOVEBUG_TIME_MESSAGES === 'object');
  for (const period of ['morning', 'afternoon', 'evening', 'night']) {
    assert.ok(Array.isArray(globalThis.LOVEBUG_TIME_MESSAGES[period]) && globalThis.LOVEBUG_TIME_MESSAGES[period].length > 0);
  }
});
