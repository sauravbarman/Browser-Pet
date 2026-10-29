(() => {
  'use strict';
  if (globalThis.__littleLovebug) return;
  globalThis.__littleLovebug = true;
  const PET_SIZE = 192; // Sprite cell; the visible sitting kitten is about 160px tall.
  const defaults = { name: 'Lovebug', happiness: 80, hidden: false, sleeping: false, position: null };
  let state = { ...defaults }, host, root, anchor, kitten, panel, bubble, reaction, title, meter, status;
  let dragging = null, moved = false, walking = false, bubbleTimer, reactionTimer, idleTimer, lastMessage = Date.now(), idleCount = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set();
  function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function clean(data) {
    return { name: typeof data.name === 'string' ? data.name.trim().slice(0, 30) || 'Lovebug' : 'Lovebug',
      happiness: Number.isFinite(data.happiness) ? Math.max(0, Math.min(100, data.happiness)) : 80,
      hidden: data.hidden === true, sleeping: data.sleeping === true,
      position: data.position && Number.isFinite(data.position.x) && Number.isFinite(data.position.y) ? data.position : null };
  }
  async function save(patch) {
    state = clean({ ...state, ...patch }); render();
    try { await chrome.storage.local.set(patch); } catch { /* Keep working in memory if storage is unavailable. */ }
  }
  function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; }
  function typing() {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a && (a.matches('input,textarea,select,iframe') || a.isContentEditable);
  }
  function position() {
    const maxX = Math.max(0, innerWidth - PET_SIZE), maxY = Math.max(0, innerHeight - PET_SIZE);
    const x = Math.max(0, Math.min(maxX, (state.position?.x ?? .97) * maxX));
    const y = Math.max(0, Math.min(maxY, (state.position?.y ?? .97) * maxY));
    anchor.style.left = `${x}px`; anchor.style.top = `${y}px`;
    const width = Math.min(224, Math.max(0, innerWidth - 16));
    panel.style.width = `${width}px`; bubble.style.width = `${Math.min(220, width)}px`;
    const left = Math.max(8, Math.min(innerWidth - width - 8, x + PET_SIZE - 10 - width)) - x;
    panel.style.left = bubble.style.left = `${left}px`;
    panel.style.top = `${Math.max(8, Math.min(innerHeight - panel.offsetHeight - 8, y - panel.offsetHeight - 8)) - y}px`;
    bubble.style.top = `${Math.max(8, y - bubble.offsetHeight - 8) - y}px`;
    panel.style.maxHeight = `${Math.max(40, innerHeight - 16)}px`; panel.style.overflowY = 'auto';
  }
  function render() {
    if (!host) return;
    host.style.setProperty('display', state.hidden ? 'none' : 'block', 'important');
    anchor.classList.toggle('sleeping', state.sleeping);
    // Happiness must not permanently close the eyes: blinking needs open eyes.
    if (state.sleeping || state.hidden) endReaction();
    title.textContent = state.name; status.textContent = `♥ ${state.happiness}/100 · ${state.sleeping ? 'Dreaming of you' : state.happiness >= 90 ? 'Feeling adored' : 'Happy to be here'}`;
    meter.style.width = `${state.happiness}%`;
    kitten.setAttribute('aria-label', `${state.name}, ${state.sleeping ? 'sleeping kitten. Wake and open menu' : 'open kitten menu'}`);
    if (state.hidden) { panel.hidden = bubble.hidden = true; }
    position();
  }
  function say(text) {
    if (state.hidden || document.hidden || typing() || !panel.hidden || dragging) return;
    bubble.textContent = text; bubble.hidden = false; position();
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 7000);
  }
  function endReaction() {
    clearTimeout(reactionTimer);
    anchor.classList.remove('petting', 'feeding', 'waking');
    reaction.replaceChildren();
  }
  function react(kind) {
    endReaction();
    // Stop walking before a user interaction so its frame loop cannot move the menu.
    walking = false; anchor.classList.remove('walking'); position();
    anchor.classList.add(kind);
    const symbols = kind === 'feeding' ? ['●', '♥', '♥'] : kind === 'waking' ? ['✧', '✦', '✧'] : ['♥', '♡', '♥'];
    for (const symbol of symbols) reaction.append(el('span', 'particle', symbol));
    reactionTimer = setTimeout(endReaction, 3200);
  }
  function pose(cls, duration) {
    anchor.classList.add(cls);
    later(() => anchor.classList.remove(cls), duration);
  }
  function schedule() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!state.hidden && !document.hidden && panel.hidden && !dragging) {
        if (!state.sleeping) {
          idleCount++;
          const n = Math.random();
          if (n < .42) pose('blink', 650);
          else if (n < .62) pose(Math.random() < .5 ? 'look' : 'look-left', 1700);
          else if (n < .78) pose('twitch', 600);
          else if (n < .9) pose('stretch', 1900);
          else if (n < .98 && !motion.matches && !typing()) walk();
          else if (!typing()) save({ sleeping: true });
          if (idleCount % 6 === 0 && !walking && !motion.matches && !typing() && !state.sleeping) walk();
        }
        if (Date.now() - lastMessage > 180000 && Math.random() < .14 && !state.sleeping) {
          say(globalThis.LOVEBUG_MESSAGES[Math.floor(Math.random() * globalThis.LOVEBUG_MESSAGES.length)]); lastMessage = Date.now();
        }
      }
      schedule();
    }, 3500 + Math.random() * 4000);
  }
  function walk() {
    walking = true; anchor.classList.add('walking');
    const x = parseFloat(anchor.style.left), max = Math.max(0, innerWidth - PET_SIZE);
    const direction = x > max - 65 ? -1 : x < 65 ? 1 : Math.random() < .5 ? -1 : 1;
    anchor.classList.toggle('facing-left', direction < 0);
    const target = Math.max(0, Math.min(max, x + direction * 65));
    const started = performance.now();
    function frame(now) {
      if (!walking || state.hidden || state.sleeping || document.hidden || motion.matches || !panel.hidden || dragging) { walking = false; anchor.classList.remove('walking'); position(); return; }
      const p = Math.min(1, (now - started) / 1700);
      anchor.style.left = `${x + (target - x) * p}px`;
      if (p < 1) requestAnimationFrame(frame);
      else { walking = false; anchor.classList.remove('walking'); save({ position: { x: max ? target / max : 0, y: state.position?.y ?? .97 } }); }
    }
    requestAnimationFrame(frame);
  }
  async function init() {
    try { state = clean(await chrome.storage.local.get(defaults)); } catch { /* defaults */ }
    const cssResponse = await fetch(chrome.runtime.getURL('pet.css'));
    if (!cssResponse.ok) throw Error('Cannot load pet.css');
    const css = await cssResponse.text();
    // Decode first: a missing atlas should report a clear error instead of an invisible pet.
    const spriteUrl = chrome.runtime.getURL('pet-sprites.png');
    const atlas = new Image(); atlas.src = spriteUrl; await atlas.decode();
    host = document.createElement('little-lovebug'); root = host.attachShadow({ mode: 'closed' });
    const style = el('style'); style.textContent = css; root.append(style);
    anchor = el('div', 'anchor'); kitten = el('button', 'kitten'); kitten.type = 'button'; kitten.setAttribute('aria-expanded', 'false');
    const sprite = el('span', 'sprite'); sprite.setAttribute('aria-hidden', 'true');
    sprite.style.backgroundImage = 'url("' + spriteUrl + '")';
    const sleepZ = el('span', 'sprite-z', 'z Z'); sleepZ.setAttribute('aria-hidden', 'true');
    kitten.append(sprite, sleepZ);
    panel = el('section', 'panel'); panel.hidden = true; panel.setAttribute('aria-label', 'Kitten care');
    title = el('div', 'title'); status = el('div', 'sub'); const track = el('div', 'meter'); meter = el('span'); track.append(meter);
    const actions = el('div', 'actions'); const rename = el('form', 'rename'); rename.hidden = true;
    const input = el('input'); input.maxLength = 30; input.setAttribute('aria-label', 'New kitten name'); const submit = el('button', '', 'Save'); submit.type = 'submit'; rename.append(input, submit);
    rename.addEventListener('submit', event => { event.preventDefault(); save({ name: input.value.trim().slice(0, 30) || 'Lovebug' }); rename.hidden = true; position(); });
    const callbacks = {
      'Pet': () => { save({ happiness: Math.min(100, state.happiness + 5), sleeping: false }); react('petting'); },
      'Feed': () => { save({ happiness: Math.min(100, state.happiness + 8), sleeping: false }); react('feeding'); },
      'Sleep': () => save({ sleeping: true }), 'Wake up': () => { save({ sleeping: false }); react('waking'); },
      'Rename': () => { rename.hidden = !rename.hidden; input.value = state.name; position(); if (!rename.hidden) input.focus(); },
      'Hide': () => save({ hidden: true })
    };
    for (const [label, callback] of Object.entries(callbacks)) { const button = el('button', '', label); button.type = 'button'; button.addEventListener('click', callback); actions.append(button); }
    panel.append(title, status, track, actions, rename); bubble = el('div', 'bubble'); bubble.hidden = true; reaction = el('div', 'reaction');
    reaction.setAttribute('aria-hidden', 'true');
    const food = el('div', 'food', '● ● ●'); food.setAttribute('aria-hidden', 'true'); kitten.append(food);
    anchor.append(kitten, panel, bubble, reaction); root.append(anchor); document.documentElement.append(host); render();
    kitten.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      walking = false; anchor.classList.remove('walking'); position();
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, left: parseFloat(anchor.style.left), top: parseFloat(anchor.style.top) }; moved = false;
      kitten.setPointerCapture(e.pointerId);
    });
    kitten.addEventListener('pointermove', e => {
      if (!dragging || dragging.id !== e.pointerId) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.hypot(dx, dy) > 5) moved = true;
      if (!moved) return;
      panel.hidden = bubble.hidden = true;
      const mx = Math.max(0, innerWidth - PET_SIZE), my = Math.max(0, innerHeight - PET_SIZE);
      state.position = { x: mx ? Math.max(0, Math.min(mx, dragging.left + dx)) / mx : 0, y: my ? Math.max(0, Math.min(my, dragging.top + dy)) / my : 0 }; position();
    });
    const release = () => { if (dragging && moved) save({ position: state.position }); dragging = null; };
    kitten.addEventListener('pointerup', release); kitten.addEventListener('pointercancel', () => { moved = true; release(); }); kitten.addEventListener('lostpointercapture', release);
    kitten.addEventListener('click', e => {
      if (moved && e.detail !== 0) { moved = false; return; }
      if (state.sleeping) save({ sleeping: false });
      panel.hidden = !panel.hidden; bubble.hidden = true; kitten.setAttribute('aria-expanded', String(!panel.hidden)); position();
    });
    document.addEventListener('pointerdown', e => { if (!e.composedPath().includes(host)) { panel.hidden = true; kitten.setAttribute('aria-expanded', 'false'); } }, true);
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; kitten.setAttribute('aria-expanded', 'false'); kitten.focus(); } });
    document.addEventListener('keydown', () => { bubble.hidden = true; }, true);
    addEventListener('resize', position);
    document.addEventListener('visibilitychange', () => { anchor.classList.toggle('paused', document.hidden); if (document.hidden) bubble.hidden = true; });
    chrome.storage.onChanged.addListener((changes, area) => { if (area !== 'local') return; const patch = {}; for (const key of Object.keys(defaults)) if (changes[key]) patch[key] = changes[key].newValue ?? defaults[key]; state = clean({ ...state, ...patch }); render(); });
    schedule();
    // A slow health check restores the overlay if a dynamic site replaces its root content.
    setInterval(() => { if (!host.isConnected && document.documentElement) document.documentElement.append(host); }, 10000);
  }
  init().catch(error => { console.warn('Little Lovebug could not start:', error.message); globalThis.__littleLovebug = false; });
})();
