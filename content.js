(() => {
  'use strict';
  if (globalThis.__littleLovebug) return;
  globalThis.__littleLovebug = true;
  const PET_SIZE = 192; // Sprite cell; the visible sitting kitten is about 160px tall.
  const defaults = { name: 'Lovebug', happiness: 80, hidden: false, sleeping: false, position: null };
  let state = { ...defaults }, host, root, anchor, kitten, panel, bubble, reaction, title, meter, status;
  let dragging = null, moved = false, walking = false, walkFrame = null, walkGeneration = 0;
  let activePose = null, poseTimer, reactionKind = null;
  let bubbleTimer, reactionTimer, idleTimer, lastMessage = Date.now(), previousRandomMessage, idleCount = 0;
  let actionButtons = {}, clickTimer = null;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Identify our own position notifications so a delayed storage echo cannot
  // rewind a newer drag/walk. Other tabs still receive and apply our position.
  const positionWriter = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function clean(data) {
    return { name: typeof data.name === 'string' ? data.name.trim().slice(0, 30) || 'Lovebug' : 'Lovebug',
      happiness: Number.isFinite(data.happiness) ? Math.max(0, Math.min(100, data.happiness)) : 80,
      hidden: data.hidden === true, sleeping: data.sleeping === true,
      position: data.position && Number.isFinite(data.position.x) && Number.isFinite(data.position.y) ? { x: data.position.x, y: data.position.y } : null };
  }
  async function save(patch) {
    // Capture the visible walk position before rendering any changed preference.
    if (stopWalk(false)) patch = { position: state.position, ...patch };
    clearPose();
    state = clean({ ...state, ...patch }); render();
    await store(patch);
  }
  async function store(patch) {
    if (patch.position) patch = { ...patch, position: { ...patch.position, writer: positionWriter } };
    try { await chrome.storage.local.set(patch); } catch { /* Keep working in memory if storage is unavailable. */ }
  }
  function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text) node.textContent = text; return node; }
  function typing() {
    let a = root?.activeElement || document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a && (a.matches('input,textarea,select,iframe') || a.isContentEditable);
  }
  function position() {
    const maxX = Math.max(0, innerWidth - PET_SIZE), maxY = Math.max(0, innerHeight - PET_SIZE);
    const x = Math.max(0, Math.min(maxX, (state.position?.x ?? .97) * maxX));
    const y = Math.max(0, Math.min(maxY, (state.position?.y ?? .97) * maxY));
    anchor.style.left = `${x}px`; anchor.style.top = `${y}px`;
    if (panel.hidden && bubble.hidden) return; // Walking needs no hidden-menu layout work.
    const width = Math.min(224, Math.max(0, innerWidth - 16));
    panel.style.width = `${width}px`; bubble.style.width = `${Math.min(220, width)}px`;
    const left = Math.max(8, Math.min(innerWidth - width - 8, x + PET_SIZE - 10 - width)) - x;
    panel.style.left = bubble.style.left = `${left}px`;
    panel.style.top = `${Math.max(8, Math.min(innerHeight - panel.offsetHeight - 8, y - panel.offsetHeight - 8)) - y}px`;
    bubble.style.top = `${Math.max(8, y - bubble.offsetHeight - 8) - y}px`;
    panel.style.maxHeight = `${Math.max(40, innerHeight - 16)}px`; panel.style.overflowY = 'auto';
  }
  function rememberPixels(x, y) {
    const maxX = Math.max(0, innerWidth - PET_SIZE), maxY = Math.max(0, innerHeight - PET_SIZE);
    state.position = {
      x: maxX ? Math.max(0, Math.min(maxX, x)) / maxX : 0,
      y: maxY ? Math.max(0, Math.min(maxY, y)) / maxY : 0
    };
  }
  function stopWalk(persist = true) {
    if (!walking) return false;
    walking = false;
    // Invalidate and cancel the old callback so it cannot affect a later walk or drag.
    walkGeneration++;
    cancelAnimationFrame(walkFrame); walkFrame = null;
    rememberPixels(parseFloat(anchor.style.left), parseFloat(anchor.style.top));
    anchor.classList.remove('walking', 'facing-left');
    position();
    if (persist) void store({ position: { ...state.position } });
    return true;
  }
  function stopDrag() {
    if (!dragging) return;
    rememberPixels(parseFloat(anchor.style.left), parseFloat(anchor.style.top));
    const id = dragging.id;
    dragging = null; moved = true;
    if (kitten.hasPointerCapture(id)) kitten.releasePointerCapture(id);
    void store({ position: { ...state.position } });
  }
  function render() {
    if (!host) return;
    host.style.setProperty('display', state.hidden ? 'none' : 'block', 'important');
    anchor.classList.toggle('sleeping', state.sleeping);
    // Happiness must not permanently close the eyes: blinking needs open eyes.
    if (state.sleeping || state.hidden) { stopDrag(); endReaction(); }
    title.textContent = state.name; status.textContent = `♥ ${state.happiness}/100 · ${state.sleeping ? 'Dreaming of you' : state.happiness >= 90 ? 'Feeling adored' : 'Happy to be here'}`;
    meter.style.width = `${state.happiness}%`;
    kitten.setAttribute('aria-label', `${state.name}, ${state.sleeping ? 'sleeping kitten. Wake and open menu' : 'open kitten menu'}`);
    if (actionButtons['Sleep'] && actionButtons['Wake up']) {
      actionButtons['Sleep'].style.display = state.sleeping ? 'none' : '';
      actionButtons['Wake up'].style.display = state.sleeping ? '' : 'none';
    }
    if (state.hidden) { panel.hidden = bubble.hidden = true; }
    position();
  }
  function say(text) {
    if (state.hidden || state.sleeping || document.hidden || typing() || !panel.hidden || dragging || walking || activePose || reactionKind) return false;
    bubble.textContent = text; bubble.hidden = false; position();
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 7000);
    return true;
  }
  function endReaction() {
    clearTimeout(reactionTimer);
    reactionKind = null;
    anchor.classList.remove('petting', 'feeding', 'waking');
    reaction.replaceChildren();
  }
  function react(kind) {
    stopWalk(); clearPose();
    endReaction();
    reactionKind = kind;
    anchor.classList.add(kind);
    const symbols = kind === 'feeding' ? ['●', '♥', '♥'] : kind === 'waking' ? ['✧', '✦', '✧'] : ['♥', '♡', '♥'];
    for (const symbol of symbols) reaction.append(el('span', 'particle', symbol));
    reactionTimer = setTimeout(endReaction, 3200);
  }
  function pose(cls, duration) {
    if (!canIdle()) return;
    activePose = cls;
    anchor.classList.add(cls);
    poseTimer = setTimeout(clearPose, duration);
  }
  function clearPose() {
    clearTimeout(poseTimer);
    if (activePose) anchor.classList.remove(activePose);
    activePose = null;
  }
  function canIdle() {
    return !state.hidden && !state.sleeping && !document.hidden && !motion.matches &&
      panel.hidden && bubble.hidden && !dragging && !walking && !activePose && !reactionKind && !typing();
  }
  function randomMessage() {
    const messages = globalThis.LOVEBUG_MESSAGES;
    const timePools = globalThis.LOVEBUG_TIME_MESSAGES;
    let pool = Array.isArray(messages) ? messages : [];

    // When time pools are available and not in test harness, weave in contextual time-of-day notes
    if (timePools && typeof timePools === 'object' && !globalThis.harness) {
      const hour = new Date().getHours();
      const timeKey = (hour >= 5 && hour < 12) ? 'morning'
        : (hour >= 12 && hour < 17) ? 'afternoon'
        : (hour >= 17 && hour < 21) ? 'evening'
        : 'night';
      const timeSpecific = Array.isArray(timePools[timeKey]) ? timePools[timeKey] : [];
      if (timeSpecific.length > 0) {
        // ~50% chance for time-of-day care notes, ~50% for anytime romantic notes
        pool = (Math.random() < .5 || pool.length === 0) ? timeSpecific : pool;
      }
    }

    if (!Array.isArray(pool) || pool.length === 0) return;
    const choices = pool.length > 1 ? pool.filter(message => message !== previousRandomMessage) : pool;
    const available = choices.length ? choices : pool;
    return available[Math.floor(Math.random() * available.length)];
  }
  function schedule() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!state.hidden && !document.hidden) {
        // Offer a note before selecting a pose; a visible bubble then blocks walking.
        if (Date.now() - lastMessage > 180000 && Math.random() < .14) {
          const message = randomMessage();
          if (message !== undefined && say(message)) { previousRandomMessage = message; lastMessage = Date.now(); }
        }
        if (canIdle()) {
          idleCount++;
          const n = Math.random();
          // Choose one action per tick; a periodic walk must not overlap a pose.
          if (idleCount % 6 === 0) walk();
          else if (n < .42) pose('blink', 650);
          else if (n < .62) pose(Math.random() < .5 ? 'look' : 'look-left', 1700);
          else if (n < .78) pose('twitch', 600);
          else if (n < .9) pose('stretch', 1900);
          else if (n < .98) walk();
          else save({ sleeping: true });
        }
      }
      schedule();
    }, 3500 + Math.random() * 4000);
  }
  function walk() {
    if (!canIdle()) return;
    walking = true; anchor.classList.add('walking');
    const generation = ++walkGeneration;
    const x = parseFloat(anchor.style.left), max = Math.max(0, innerWidth - PET_SIZE);
    const direction = x > max - 65 ? -1 : x < 65 ? 1 : Math.random() < .5 ? -1 : 1;
    anchor.classList.toggle('facing-left', direction < 0);
    const target = Math.max(0, Math.min(max, x + direction * 65));
    const started = performance.now();
    function frame(now) {
      if (generation !== walkGeneration || !walking) return;
      if (state.hidden || state.sleeping || document.hidden || motion.matches || !panel.hidden || dragging || activePose || reactionKind) { stopWalk(); return; }
      const p = Math.min(1, (now - started) / 1700);
      // Keep render() and position() on the live position, not the pre-walk save.
      rememberPixels(x + (target - x) * p, parseFloat(anchor.style.top));
      position();
      if (p < 1) walkFrame = requestAnimationFrame(frame);
      else stopWalk();
    }
    walkFrame = requestAnimationFrame(frame);
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
    const gesture = el('span', 'gesture'); gesture.append(sprite);
    kitten.append(gesture, sleepZ);
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
    for (const [label, callback] of Object.entries(callbacks)) {
      const button = el('button', label === 'Hide' ? 'action-hide' : '', label);
      button.type = 'button';
      button.addEventListener('click', callback);
      actions.append(button);
      actionButtons[label] = button;
    }
    panel.append(title, status, track, actions, rename); bubble = el('div', 'bubble'); bubble.hidden = true; reaction = el('div', 'reaction');
    reaction.setAttribute('aria-hidden', 'true');
    const food = el('div', 'food', '● ● ●'); food.setAttribute('aria-hidden', 'true'); kitten.append(food);
    anchor.append(kitten, panel, bubble, reaction); root.append(anchor); document.documentElement.append(host); render();
    kitten.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      stopWalk(); clearPose(); endReaction(); position();
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
      if (e.detail > 1) return;
      clearTimeout(clickTimer);
      const openMenu = () => {
        stopWalk(); clearPose();
        if (state.sleeping) save({ sleeping: false });
        panel.hidden = !panel.hidden; bubble.hidden = true; kitten.setAttribute('aria-expanded', String(!panel.hidden)); position();
      };
      if (e.detail === 0) { openMenu(); return; }
      clickTimer = setTimeout(openMenu, 220);
    });
    kitten.addEventListener('dblclick', e => {
      clearTimeout(clickTimer);
      if (moved) { moved = false; return; }
      panel.hidden = true; bubble.hidden = true; kitten.setAttribute('aria-expanded', 'false');
      callbacks['Pet']();
    });
    document.addEventListener('pointerdown', e => { if (!e.composedPath().includes(host)) { panel.hidden = true; kitten.setAttribute('aria-expanded', 'false'); } }, true);
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; kitten.setAttribute('aria-expanded', 'false'); kitten.focus(); } });
    document.addEventListener('keydown', () => { bubble.hidden = true; }, true);
    addEventListener('resize', () => {
      stopWalk(); clearPose();
      stopDrag();
      position();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopWalk(); stopDrag(); clearPose(); bubble.hidden = true; }
      anchor.classList.toggle('paused', document.hidden);
    });
    motion.addEventListener('change', () => { if (motion.matches) { stopWalk(); clearPose(); } });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const key of Object.keys(defaults)) if (changes[key]) patch[key] = changes[key].newValue ?? defaults[key];
      // A local drag owns its live position until release; unrelated tab updates
      // may still update name, happiness and visibility without moving the kitten.
      if (dragging || patch.position?.writer === positionWriter) delete patch.position;
      else if ('position' in patch) stopWalk(false);
      if (patch.hidden || patch.sleeping) { stopWalk(); clearPose(); }
      state = clean({ ...state, ...patch }); render();
    });
    anchor.classList.toggle('paused', document.hidden);
    schedule();
    // A slow health check restores the overlay if a dynamic site replaces its root content.
    setInterval(() => { if (!host.isConnected && document.documentElement) document.documentElement.append(host); }, 10000);
  }
  init().catch(error => { console.warn('Little Lovebug could not start:', error.message); globalThis.__littleLovebug = false; });
})();
