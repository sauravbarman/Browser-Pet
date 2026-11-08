(() => {
  'use strict';
  if (globalThis.__littleLovebug) return;
  globalThis.__littleLovebug = true;
  const PET_SIZE = 192; // Sprite cell; the visible sitting kitten is about 160px tall.
  const defaults = {
    name: 'Lovebug',
    happiness: 80,
    hidden: false,
    sleeping: false,
    position: null,
    surpriseGifts: true,
    giftFrequency: 'normal',
    giftMessages: true
  };
  let state = { ...defaults }, host, root, anchor, kitten, panel, bubble, reaction, title, meter, status;
  let dragging = null, moved = false, walking = false, walkFrame = null, walkGeneration = 0;
  let activePose = null, poseTimer, reactionKind = null;
  let bubbleTimer, reactionTimer, idleTimer, lastMessage = globalThis.harness ? Date.now() : (Date.now() - 30000), previousRandomMessage, idleCount = 0;
  let actionButtons = {}, clickTimer = null;
  let toyTimer = null, toyCleanup = null, lastToyKind = null, toyCount = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Identify our own position notifications so a delayed storage echo cannot
  // rewind a newer drag/walk. Other tabs still receive and apply our position.
  const positionWriter = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // ── Sleep pose state (ephemeral per-tab, not persisted) ──────────────────
  let sleepPose = null, lastSleepPose = null, sleepPoseTimer = null, dreamBubbleTimer = null, autoWakeTimer = null;
  const SLEEP_POSES = ['curled', 'side', 'face', 'belly'];
  const SLEEP_POSE_WEIGHTS = [40, 30, 20, 10]; // %

  function scheduleAutoWake() {
    clearTimeout(autoWakeTimer);
    autoWakeTimer = setTimeout(() => {
      if (state.sleeping && !dragging && panel.hidden) {
        save({ sleeping: false });
        react('waking');
      }
    }, 16000 + Math.random() * 8000);
  }

  function pickSleepPose() {
    // Weighted random selection avoiding the last pose
    const available = SLEEP_POSES.map((p, i) => ({ p, w: SLEEP_POSE_WEIGHTS[i] }))
      .filter(({ p }) => p !== lastSleepPose);
    const sum = available.reduce((s, { w }) => s + w, 0);
    let r = Math.random() * sum;
    for (const { p, w } of available) { r -= w; if (r <= 0) return p; }
    return available[available.length - 1].p;
  }

  function applySleepPose(pose) {
    if (sleepPose) anchor.classList.remove('sleep-' + sleepPose);
    sleepPose = pose;
    lastSleepPose = pose;
    if (pose) anchor.classList.add('sleep-' + pose);
  }

  function scheduleSleepPoseChange() {
    clearTimeout(sleepPoseTimer);
    if (!state.sleeping || motion.matches || document.hidden) return;
    sleepPoseTimer = setTimeout(() => {
      if (!state.sleeping || motion.matches || document.hidden) return;
      if (!dragging) {
        applySleepPose(pickSleepPose());
      }
      scheduleSleepPoseChange();
    }, 45000 + Math.random() * 45000);
  }

  function startSleepPose() {
    if (!state.sleeping) return;
    const pose = pickSleepPose();
    applySleepPose(pose);
    if (!motion.matches) scheduleSleepPoseChange();
  }

  function clearSleepPose() {
    clearTimeout(sleepPoseTimer);
    sleepPoseTimer = null;
    if (sleepPose) anchor.classList.remove('sleep-' + sleepPose);
    sleepPose = null;
  }

  function spawnDreamBubble() {
    if (!anchor) return;
    const symbols = ['z', 'Z', '♡', 'z', 'Z'];
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    const colors = ['#b996d1', '#f4a7c0', '#c5b8f0', '#a787b7'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const bub = document.createElement('span');
    bub.className = 'dream-bubble';
    bub.textContent = sym;
    bub.setAttribute('aria-hidden', 'true');
    const size = 12 + Math.random() * 10;
    bub.style.cssText = `font-size:${size}px;color:${color};right:${5 + Math.random() * 20}px;top:${40 + Math.random() * 20}px`;
    anchor.append(bub);
    setTimeout(() => { if (bub.isConnected) bub.remove(); }, 3000);
  }

  function scheduleDreamBubble() {
    clearTimeout(dreamBubbleTimer);
    if (!state.sleeping || motion.matches || document.hidden) return;
    dreamBubbleTimer = setTimeout(() => {
      if (state.sleeping && !motion.matches && !document.hidden) spawnDreamBubble();
      scheduleDreamBubble();
    }, 4000 + Math.random() * 6000);
  }

  function clean(data) {
    return {
      name: typeof data.name === 'string' ? data.name.trim().slice(0, 30) || 'Lovebug' : 'Lovebug',
      happiness: Number.isFinite(data.happiness) ? Math.max(0, Math.min(100, data.happiness)) : 80,
      hidden: data.hidden === true,
      sleeping: data.sleeping === true,
      position: data.position && Number.isFinite(data.position.x) && Number.isFinite(data.position.y) ? { x: data.position.x, y: data.position.y } : null,
      surpriseGifts: data.surpriseGifts !== false,
      giftFrequency: ['rare', 'normal', 'frequent'].includes(data.giftFrequency) ? data.giftFrequency : 'normal',
      giftMessages: data.giftMessages !== false
    };
  }
  async function save(patch) {
    // Capture the visible walk position before rendering any changed preference.
    if (stopWalk(false)) patch = { position: state.position, ...patch };
    clearPose(); cancelToy(); cancelPeekaboo(true); cancelGift();
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
    const preferAbove = y - panel.offsetHeight - 8 >= 8 || y + PET_SIZE + panel.offsetHeight + 8 > innerHeight;
    const targetPanelY = preferAbove ? Math.max(8, y - panel.offsetHeight - 8) : Math.min(innerHeight - panel.offsetHeight - 8, y + PET_SIZE + 8);
    panel.style.top = `${targetPanelY - y}px`;
    const preferBubbleAbove = y - bubble.offsetHeight - 8 >= 8 || y + PET_SIZE + bubble.offsetHeight + 8 > innerHeight;
    const targetBubbleY = preferBubbleAbove ? Math.max(8, y - bubble.offsetHeight - 8) : Math.min(innerHeight - bubble.offsetHeight - 8, y + PET_SIZE + 8);
    bubble.style.top = `${targetBubbleY - y}px`;
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
    // Track sleeping state before DOM update to detect transitions
    const wasSleeping = anchor.classList.contains('sleeping');
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
    // Handle sleeping pose transitions
    if (state.sleeping && !wasSleeping) {
      startSleepPose();
      scheduleDreamBubble();
      if (!globalThis.harness) scheduleAutoWake();
    } else if (!state.sleeping && wasSleeping) {
      clearSleepPose();
      clearTimeout(dreamBubbleTimer);
      dreamBubbleTimer = null;
      clearTimeout(autoWakeTimer);
      autoWakeTimer = null;
      // Clean up any lingering dream bubble elements
      anchor.querySelectorAll('.dream-bubble').forEach(el => el.remove());
    } else if (state.sleeping && !globalThis.harness && !autoWakeTimer) {
      scheduleAutoWake();
    }
  }
  function say(text) {
    if (state.hidden || state.sleeping || document.hidden || typing() || !panel.hidden || dragging || walking || activePose || reactionKind || peekaboo || currentGift) return false;
    bubble.textContent = text; bubble.hidden = false; position();
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { bubble.hidden = true; }, globalThis.harness ? 7000 : 4500);
    return true;
  }
  function endReaction() {
    clearTimeout(reactionTimer);
    reactionKind = null;
    anchor.classList.remove('petting', 'feeding', 'waking');
    reaction.replaceChildren();
  }
  function react(kind) {
    stopWalk(); clearPose(); cancelPeekaboo(true);
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
  function cancelToy() {
    if (!toyCleanup) return;
    const fn = toyCleanup; toyCleanup = null;
    fn();
  }
  function canIdle() {
    return !state.hidden && !state.sleeping && !document.hidden && !motion.matches &&
      panel.hidden && bubble.hidden && !dragging && !walking && !activePose && !reactionKind && !toyCleanup && !peekaboo && !currentGift && !typing();
  }
  function canGift() {
    return !state.hidden && !state.sleeping && !document.hidden &&
      panel.hidden && bubble.hidden && !dragging && !walking && !activePose && !reactionKind && !toyCleanup && !peekaboo && !currentGift &&
      !typing() && !Boolean(document.fullscreenElement);
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
  function toyPosition() {
    // Returns pixel position of anchor for toy placement reference
    const ax = parseFloat(anchor.style.left), ay = parseFloat(anchor.style.top);
    return { ax, ay };
  }

  function clampToyX(x, w) {
    return Math.max(0, Math.min(innerWidth - w, x));
  }

  function clampToyY(y, h) {
    return Math.max(0, Math.min(innerHeight - h, y));
  }

  function playYarn() {
    if (!canIdle() || motion.matches) return;
    const ax = parseFloat(anchor.style.left);
    // Spawn yarn ball to the left or right of the kitten, keeping it on-screen
    const side = ax > innerWidth - 240 ? -1 : ax < 80 ? 1 : (Math.random() < 0.5 ? -1 : 1);
    const bx = side < 0 ? -20 : 182;
    const by = 146;

    const ball = document.createElement('div');
    ball.className = 'toy-yarn';
    ball.setAttribute('aria-hidden', 'true');
    ball.style.cssText = `left:${bx}px;top:${by}px`;
    anchor.append(ball);

    const rollDir = side > 0 ? 1 : -1;
    const rollDist = 28 + Math.random() * 20;
    let done = false;

    const timers = [];
    function t(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }

    // Phase 1: kitten looks toward ball
    const lookCls = bx < 96 ? 'look-left' : 'look';
    activePose = lookCls; anchor.classList.add(lookCls);

    // Phase 2: bat — after a moment kitten reaches with paw
    t(() => {
      if (!toyCleanup) return;
      clearPose();
      activePose = 'twitch'; anchor.classList.add('twitch');
      // Ball rolls
      ball.style.transform = `translateX(${rollDir * rollDist}px)`;
      ball.style.transition = 'transform 0.5s ease-out';
    }, 900 + Math.random() * 300);

    // Phase 3: sometimes walk a step toward ball
    const willStep = Math.random() < 0.4;
    if (willStep) {
      t(() => {
        if (!toyCleanup || !canIdle()) return;
        clearPose();
        // Small nudge walk
        const curX = parseFloat(anchor.style.left);
        const stepDir = bx < 96 ? -1 : 1;
        const stepDist = 20 + Math.random() * 15;
        walking = true; anchor.classList.add('walking');
        anchor.classList.toggle('facing-left', stepDir < 0);
        const generation = ++walkGeneration;
        const target = Math.max(0, Math.min(Math.max(0, innerWidth - 192), curX + stepDir * stepDist));
        const started = performance.now();
        function frame(now) {
          if (generation !== walkGeneration || !walking || !toyCleanup) { if (walking) stopWalk(); return; }
          const p = Math.min(1, (now - started) / 600);
          rememberPixels(curX + (target - curX) * p, parseFloat(anchor.style.top));
          position();
          if (p < 1) requestAnimationFrame(frame); else stopWalk();
        }
        requestAnimationFrame(frame);
      }, 1500);
    }

    // Phase 4: ball fades out
    t(() => {
      if (!toyCleanup) return;
      ball.style.opacity = '0';
      ball.style.transition = (ball.style.transition ? ball.style.transition + ',' : '') + 'opacity 0.8s ease-out';
    }, 2800 + Math.random() * 400);

    // Phase 5: cleanup
    t(() => {
      done = true;
      toyCleanup = null;
      clearPose();
      if (ball.isConnected) ball.remove();
    }, 3800 + Math.random() * 400);

    toyCleanup = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      clearPose();
      if (ball.isConnected) ball.remove();
    };
  }

  function playButterfly() {
    if (!canIdle() || motion.matches) return;
    const ay = parseFloat(anchor.style.top);
    // Start near kitten head, safely within viewport
    const startRelX = 60 + Math.random() * 72;
    const startRelY = ay < 50 ? (20 + Math.random() * 20) : -(20 + Math.random() * 20);
    const bf = document.createElement('div');
    bf.className = 'toy-butterfly';
    bf.setAttribute('aria-hidden', 'true');
    bf.style.cssText = `left:${startRelX}px;top:${startRelY}px`;
    anchor.append(bf);

    let done = false;
    const timers = [];
    function t(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }

    // Kitten head-tilt look
    const lookCls = startRelX < 96 ? 'look-left' : 'look';
    activePose = lookCls; anchor.classList.add(lookCls);

    // Butterfly flutters in a wandering path using CSS animation key driven by JS
    let phase = 0;
    const phases = [
      { dx: (Math.random() - 0.5) * 60, dy: -15 - Math.random() * 20 },
      { dx: (Math.random() - 0.5) * 60, dy: -10 - Math.random() * 15 },
      { dx: (Math.random() - 0.5) * 40, dy: 5 + Math.random() * 10 },
    ];
    let curX = startRelX, curY = startRelY;

    function flutter() {
      if (!toyCleanup || phase >= phases.length) return;
      const { dx, dy } = phases[phase++];
      curX = Math.max(-20, Math.min(210, curX + dx));
      curY = Math.max(-60, Math.min(60, curY + dy));
      bf.style.left = curX + 'px'; bf.style.top = curY + 'px';
      bf.style.transition = `left ${0.7 + Math.random() * 0.4}s ease-in-out, top ${0.6 + Math.random() * 0.3}s ease-in-out`;
    }
    flutter();
    t(flutter, 800 + Math.random() * 200);
    t(flutter, 1600 + Math.random() * 300);

    // Kitten reaches paw
    const reachTime = 1200 + Math.random() * 400;
    t(() => {
      if (!toyCleanup) return;
      clearPose();
      activePose = 'twitch'; anchor.classList.add('twitch');
    }, reachTime);

    // Butterfly flies away and fades
    t(() => {
      if (!toyCleanup) return;
      clearPose();
      const lookAway = curX < 96 ? 'look-left' : 'look';
      activePose = lookAway; anchor.classList.add(lookAway);
      const flyX = curX + (Math.random() < 0.5 ? -80 : 80);
      const flyY = curY - 60;
      bf.style.left = flyX + 'px'; bf.style.top = flyY + 'px';
      bf.style.opacity = '0';
      bf.style.transition = `left 1s ease-in, top 0.8s ease-in, opacity 0.9s ease-in`;
    }, 2600 + Math.random() * 400);

    t(() => {
      done = true; toyCleanup = null;
      clearPose();
      if (bf.isConnected) bf.remove();
    }, 3800 + Math.random() * 400);

    toyCleanup = () => {
      if (done) return; done = true;
      timers.forEach(clearTimeout); clearPose();
      if (bf.isConnected) bf.remove();
    };
  }

  function playHeart() {
    if (!canIdle() || motion.matches) return;
    const ay = parseFloat(anchor.style.top);
    // Heart appears above kitten, safely within viewport
    const relX = 40 + Math.random() * 60;
    const relY = ay < 60 ? (20 + Math.random() * 20) : -(25 + Math.random() * 20);

    const heart = document.createElement('div');
    heart.className = 'toy-heart';
    heart.setAttribute('aria-hidden', 'true');
    heart.style.cssText = `left:${relX}px;top:${relY}px`;
    anchor.append(heart);

    let done = false;
    const timers = [];
    function t(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }

    // Kitten looks at heart
    activePose = 'look'; anchor.classList.add('look');

    // Kitten reaches paw
    t(() => {
      if (!toyCleanup) return;
      clearPose();
      activePose = 'twitch'; anchor.classList.add('twitch');
    }, 900 + Math.random() * 200);

    // Heart bursts into sparkles
    t(() => {
      if (!toyCleanup) return;
      heart.classList.add('toy-heart-burst');
      // Create sparkle particles
      for (let i = 0; i < 4; i++) {
        const sp = document.createElement('span');
        sp.className = 'toy-sparkle';
        sp.textContent = ['✦', '✧', '♡', '·'][i];
        sp.style.cssText = `--sx:${(Math.random() - 0.5) * 40}px;--sy:${-(20 + Math.random() * 30)}px;animation-delay:${i * 0.08}s`;
        heart.append(sp);
      }
    }, 1500 + Math.random() * 200);

    // Clear reaction, fade out
    t(() => {
      if (!toyCleanup) return;
      clearPose();
      heart.style.opacity = '0';
      heart.style.transition = 'opacity 0.6s ease-out';
    }, 2500);

    t(() => {
      done = true; toyCleanup = null;
      clearPose();
      if (heart.isConnected) heart.remove();
    }, 3300);

    toyCleanup = () => {
      if (done) return; done = true;
      timers.forEach(clearTimeout); clearPose();
      if (heart.isConnected) heart.remove();
    };
  }

  function tryStartToy() {
    if (!canIdle() || motion.matches) return;
    // Pick a toy, avoiding the same one twice in a row
    const toys = ['yarn', 'butterfly', 'heart'];
    const available = lastToyKind ? toys.filter(t => t !== lastToyKind) : toys;
    const kind = available[Math.floor(Math.random() * available.length)];
    lastToyKind = kind;
    if (kind === 'yarn') playYarn();
    else if (kind === 'butterfly') playButterfly();
    else playHeart();
  }

  // ── Feature 3: Peekaboo Mode ──────────────────────────────────────────
  let peekaboo = null;
  let lastPeekabooTime = globalThis.harness ? Date.now() : 0;
  let peekabooCooldown = globalThis.harness ? (480000 + Math.random() * 420000) : (45000 + Math.random() * 45000);

  function getPeekabooTarget() {
    if (!anchor) return null;
    const currentX = parseFloat(anchor.style.left);
    const currentY = parseFloat(anchor.style.top);
    if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) return null;

    // Visible slice width when hidden behind edge (~75px out of 192px sprite = ~61% hidden)
    const VISIBLE_SLICE = 75;
    const leftEdgeX = -(PET_SIZE - VISIBLE_SLICE); // -117px
    const rightEdgeX = innerWidth - VISIBLE_SLICE;  // innerWidth - 75px

    const distToLeft = Math.abs(currentX - leftEdgeX);
    const distToRight = Math.abs(rightEdgeX - currentX);

    // Pick the nearer horizontal edge
    const edge = distToLeft <= distToRight ? 'left' : 'right';
    const targetX = edge === 'left' ? leftEdgeX : rightEdgeX;
    const distance = edge === 'left' ? distToLeft : distToRight;

    // Skip peekaboo if too far from the nearest edge (avoids long cross-screen trek)
    const maxDistance = globalThis.harness ? Math.min(380, innerWidth * 0.45) : Math.min(550, innerWidth * 0.55);
    if (distance > maxDistance || distance < 25) return null;

    return { edge, targetX, currentX, currentY, distance };
  }

  function shouldPeekaboo() {
    if (globalThis.harness && !globalThis.harness.allowPeekaboo) return false;
    if (Date.now() - lastPeekabooTime < peekabooCooldown) return false;
    if (Date.now() - lastGiftTime < (globalThis.harness ? 60000 : 15000)) return false;
    return getPeekabooTarget() !== null;
  }

  function cancelPeekaboo(persist = true) {
    if (!peekaboo) return false;
    const current = peekaboo;
    peekaboo = null;

    current.timers.forEach(clearTimeout);

    walkGeneration++;
    if (walkFrame) {
      cancelAnimationFrame(walkFrame);
      walkFrame = null;
    }
    walking = false;

    anchor.classList.remove(
      'walking', 'facing-left',
      'peeking', 'peekaboo-left', 'peekaboo-right',
      'peeking-tilt', 'peeking-scoot'
    );

    if (persist) {
      rememberPixels(parseFloat(anchor.style.left), parseFloat(anchor.style.top));
      position();
      void store({ position: { ...state.position } });
    }
    return true;
  }

  function tryStartPeekaboo() {
    if (!canIdle() || motion.matches || peekaboo) return;
    const target = getPeekabooTarget();
    if (!target) return;

    lastPeekabooTime = Date.now();
    peekabooCooldown = 480000 + Math.random() * 420000;

    const originPos = { ...state.position };
    const originX = target.currentX;
    const originY = target.currentY;
    const targetX = target.targetX;
    const edge = target.edge;

    peekaboo = {
      originPos,
      originX,
      originY,
      targetX,
      edge,
      phase: 'out',
      timers: []
    };

    function pt(fn, ms) {
      const id = setTimeout(() => {
        if (!peekaboo) return;
        fn();
      }, ms);
      peekaboo.timers.push(id);
      return id;
    }

    // Step 1: Walk to the edge
    walking = true;
    anchor.classList.add('walking');
    // Facing left when moving to left edge; facing right (facing-left = false) when moving to right edge
    const walkDir = edge === 'left' ? -1 : 1;
    anchor.classList.toggle('facing-left', walkDir < 0);

    const generation = ++walkGeneration;
    const durationOut = Math.max(1100, Math.min(2400, (target.distance / 115) * 1000));
    const startedOut = performance.now();

    function frameOut(now) {
      if (generation !== walkGeneration || !walking || !peekaboo || peekaboo.phase !== 'out') return;
      if (state.hidden || state.sleeping || document.hidden || motion.matches || !panel.hidden || dragging || activePose || reactionKind || toyCleanup || typing()) {
        cancelPeekaboo(true);
        return;
      }
      const p = Math.min(1, (now - startedOut) / durationOut);
      const curX = originX + (targetX - originX) * p;
      anchor.style.left = `${curX}px`;

      if (p < 1) {
        walkFrame = requestAnimationFrame(frameOut);
      } else {
        // Arrived at edge! Stop walk, begin Peeking phase
        walkFrame = null;
        walking = false;
        anchor.classList.remove('walking');
        peekaboo.phase = 'peeking';

        // Turn to look into the webpage:
        // At left edge: looks toward right (into page) -> facing-left is false
        // At right edge: looks toward left (into page) -> facing-left is true
        anchor.classList.toggle('facing-left', edge === 'right');
        anchor.classList.add('peeking', edge === 'left' ? 'peekaboo-left' : 'peekaboo-right');

        // Playful peek animations
        // 1) Subtle curious head tilt
        pt(() => {
          if (!peekaboo || peekaboo.phase !== 'peeking') return;
          anchor.classList.add('peeking-tilt');
        }, 550 + Math.random() * 250);

        // 2) Slow curious blink
        pt(() => {
          if (!peekaboo || peekaboo.phase !== 'peeking') return;
          pose('blink', 650);
        }, 1300 + Math.random() * 300);

        // 3) Occasional tiny peek scoot further into view, then settle back
        pt(() => {
          if (!peekaboo || peekaboo.phase !== 'peeking') return;
          anchor.classList.remove('peeking-tilt');
          anchor.classList.add('peeking-scoot');
          pt(() => {
            if (!peekaboo || peekaboo.phase !== 'peeking') return;
            anchor.classList.remove('peeking-scoot');
          }, 650);
        }, 2200 + Math.random() * 300);

        // 4) Return walk after peek duration (approx 3.2 - 4.2 seconds)
        const totalPeekDuration = 3200 + Math.random() * 1000;
        pt(() => {
          if (!peekaboo || peekaboo.phase !== 'peeking') return;
          startReturnWalk();
        }, totalPeekDuration);
      }
    }

    walkFrame = requestAnimationFrame(frameOut);

    function startReturnWalk() {
      if (!peekaboo) return;
      peekaboo.phase = 'return';
      anchor.classList.remove(
        'peeking', 'peekaboo-left', 'peekaboo-right',
        'peeking-tilt', 'peeking-scoot'
      );

      // Walk back toward original position:
      // From left edge: walking right -> facing-left = false
      // From right edge: walking left -> facing-left = true
      walking = true;
      anchor.classList.add('walking');
      anchor.classList.toggle('facing-left', edge === 'right');

      const returnGen = ++walkGeneration;
      const durationReturn = Math.max(1100, Math.min(2400, (target.distance / 115) * 1000));
      const startedReturn = performance.now();
      const fromX = parseFloat(anchor.style.left);

      function frameReturn(now) {
        if (returnGen !== walkGeneration || !walking || !peekaboo || peekaboo.phase !== 'return') return;
        if (state.hidden || state.sleeping || document.hidden || motion.matches || !panel.hidden || dragging || activePose || reactionKind || toyCleanup || typing()) {
          cancelPeekaboo(true);
          return;
        }
        const p = Math.min(1, (now - startedReturn) / durationReturn);
        const curX = fromX + (originX - fromX) * p;
        anchor.style.left = `${curX}px`;

        if (p < 1) {
          walkFrame = requestAnimationFrame(frameReturn);
        } else {
          // Arrived back home!
          walkFrame = null;
          walking = false;
          anchor.classList.remove('walking', 'facing-left');
          const savedPos = peekaboo.originPos;
          peekaboo = null;
          state.position = savedPos;
          position();
        }
      }

      walkFrame = requestAnimationFrame(frameReturn);
    }
  }
  globalThis.__lovebugPeekaboo = tryStartPeekaboo;

  // ── Feature 6: Surprise Gifts 🎁 ──────────────────────────────────────
  let currentGift = null;
  const GIFT_KINDS = ['flower', 'heart', 'star', 'present'];

  function getGiftInterval(frequency) {
    if (globalThis.harness) {
      if (frequency === 'frequent') return (15 + Math.random() * 10) * 60 * 1000;
      if (frequency === 'rare') return (35 + Math.random() * 10) * 60 * 1000;
      return (25 + Math.random() * 10) * 60 * 1000; // 'normal' default (25-35 min)
    }
    if (frequency === 'frequent') return (2 + Math.random() * 2) * 60 * 1000; // 2-4 min
    if (frequency === 'rare') return (8 + Math.random() * 8) * 60 * 1000;   // 8-16 min
    return (3 + Math.random() * 3) * 60 * 1000; // 3-6 min
  }
  let giftCooldown = getGiftInterval(defaults.giftFrequency);
  let lastGiftTime = globalThis.harness ? Date.now() : 0;
  let lastGiftKind = null;

  function shouldGift() {
    if (state.surpriseGifts === false) return false;
    if (globalThis.harness && !globalThis.harness.allowGift) return false;
    if (Date.now() - lastGiftTime < giftCooldown) return false;
    if (Date.now() - lastPeekabooTime < (globalThis.harness ? 60000 : 15000)) return false;
    return canGift();
  }

  function pickGiftMessage(kind) {
    const pools = globalThis.LOVEBUG_GIFT_MESSAGES;
    if (!pools || typeof pools !== 'object') return null;
    const pool = Array.isArray(pools[kind]) ? pools[kind] : [];
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function cancelGift() {
    if (!currentGift) return false;
    const g = currentGift;
    currentGift = null;
    g.timers.forEach(clearTimeout);
    clearPose();
    if (g.element && g.element.isConnected) {
      g.element.remove();
    }
    if (g.particles) {
      g.particles.forEach(p => { if (p.isConnected) p.remove(); });
    }
    anchor.classList.remove('gift-active', 'gift-flower', 'gift-heart', 'gift-star', 'gift-present');
    if (g.bubbleShown) {
      clearTimeout(bubbleTimer);
      bubble.hidden = true;
    }
    return true;
  }

  function buildFlowerElement() {
    const wrap = el('div', 'surprise-gift gift-flower');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <path d="M12 14 C12 18 10 21 8 22 M11 17 C13 16 15 14 15 14" stroke="#93c5a7" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <g fill="#fbcfe8" stroke="#f472b6" stroke-width="0.8">
        <circle cx="12" cy="7" r="3.5"/>
        <circle cx="7.5" cy="10.5" r="3.5"/>
        <circle cx="9.2" cy="15.5" r="3.5"/>
        <circle cx="14.8" cy="15.5" r="3.5"/>
        <circle cx="16.5" cy="10.5" r="3.5"/>
      </g>
      <circle cx="12" cy="11.8" r="3" fill="#fef08a" stroke="#fde047" stroke-width="0.8"/>
    `;
    wrap.append(svg);
    return wrap;
  }

  function buildHeartElement() {
    const wrap = el('div', 'surprise-gift gift-heart');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <linearGradient id="lb-heart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffb3d1"/>
          <stop offset="100%" stop-color="#f472b6"/>
        </linearGradient>
      </defs>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#lb-heart-grad)" stroke="#f472b6" stroke-width="1"/>
      <path d="M6 7 Q8 5 10 6" stroke="rgba(255,255,255,0.75)" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    `;
    wrap.append(svg);
    return wrap;
  }

  function buildStarElement() {
    const wrap = el('div', 'surprise-gift gift-star');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <linearGradient id="lb-star-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#facc15"/>
        </linearGradient>
      </defs>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="url(#lb-star-grad)" stroke="#eab308" stroke-width="1" stroke-linejoin="round"/>
      <circle cx="9" cy="8" r="1.1" fill="#ffffff" opacity="0.85"/>
    `;
    wrap.append(svg);
    return wrap;
  }

  function buildPresentElement() {
    const wrap = el('div', 'surprise-gift gift-present');
    const box = el('div', 'gift-box');
    const lid = el('div', 'gift-box-lid');
    const bow = el('div', 'gift-bow');
    lid.append(bow);
    const base = el('div', 'gift-box-base');
    const surprise = el('div', 'gift-surprise-item');
    surprise.setAttribute('aria-hidden', 'true');
    box.append(lid, base, surprise);
    wrap.append(box);
    return wrap;
  }

  function tryStartGift(forcedKind) {
    if (state.surpriseGifts === false && !forcedKind) return;
    if (forcedKind) {
      stopWalk(); clearPose(); cancelToy(); cancelPeekaboo(true); cancelGift();
    }
    if (!canGift()) return;

    // Pick kind avoiding immediate repeat
    const available = lastGiftKind ? GIFT_KINDS.filter(k => k !== lastGiftKind) : GIFT_KINDS;
    const kind = forcedKind || available[Math.floor(Math.random() * available.length)];
    lastGiftKind = kind;
    lastGiftTime = Date.now();
    giftCooldown = getGiftInterval(state.giftFrequency);

    const timers = [];
    function gt(fn, ms) {
      const id = setTimeout(() => {
        if (!currentGift) return;
        fn();
      }, ms);
      timers.push(id);
      return id;
    }

    const giftRecord = {
      kind,
      timers,
      element: null,
      particles: [],
      bubbleShown: false,
      interacted: false
    };
    currentGift = giftRecord;

    // Look down / toward paws
    activePose = 'look';
    anchor.classList.add('look', 'gift-active', 'gift-' + kind);

    // Build gift element
    let giftEl;
    if (kind === 'flower') giftEl = buildFlowerElement();
    else if (kind === 'heart') giftEl = buildHeartElement();
    else if (kind === 'star') giftEl = buildStarElement();
    else giftEl = buildPresentElement();

    giftEl.setAttribute('role', 'button');
    giftEl.setAttribute('tabindex', '0');
    const labels = {
      flower: `A tiny flower from ${state.name}. Click to accept 🌸`,
      heart: `A tiny heart from ${state.name}. Click to accept 💗`,
      star: `A shining star from ${state.name}. Click to accept ⭐`,
      present: `A wrapped gift from ${state.name}. Click to open 🎁`
    };
    giftEl.setAttribute('aria-label', labels[kind] || 'Gift from Lovebug');

    // Appearance
    gt(() => {
      if (!currentGift) return;
      anchor.append(giftEl);
      giftRecord.element = giftEl;
    }, motion.matches ? 0 : 350);

    // Presenting movement & particles
    gt(() => {
      if (!currentGift) return;
      clearPose();
      if (!motion.matches) {
        giftEl.classList.add('gift-presented');
        if (kind === 'present') giftEl.classList.add('gift-wiggle');
        pose('twitch', 600);
      }

      // Ambient particles for heart and star
      if (!motion.matches) {
        if (kind === 'heart') {
          for (let i = 0; i < 3; i++) {
            const h = el('span', 'gift-mini-heart', ['♡', '♥', '♡'][i]);
            h.style.setProperty('--mx', `${(i - 1) * 14}px`);
            h.style.animationDelay = `${i * 0.5}s`;
            giftEl.append(h);
            giftRecord.particles.push(h);
          }
        } else if (kind === 'star') {
          for (let i = 0; i < 3; i++) {
            const s = el('span', 'gift-sparkle-particle', ['✦', '✧', '✦'][i]);
            s.style.top = `${-8 + (i % 2) * 14}px`;
            s.style.left = `${(i - 1) * 16 + 6}px`;
            s.style.animationDelay = `${i * 0.4}s`;
            giftEl.append(s);
            giftRecord.particles.push(s);
          }
        }
      }
    }, motion.matches ? 50 : 750);

    // Affectionate message bubble
    gt(() => {
      if (!currentGift) return;
      if (state.giftMessages !== false) {
        const msg = pickGiftMessage(kind);
        if (msg && panel.hidden && !dragging && !typing()) {
          bubble.textContent = msg;
          bubble.hidden = false;
          position();
          giftRecord.bubbleShown = true;
        }
      }
    }, motion.matches ? 100 : 1100);

    function fadeOutAndClose(delay = 800) {
      if (!currentGift) return;
      if (giftEl && giftEl.isConnected) {
        giftEl.classList.add('gift-fade-out');
      }
      if (giftRecord.bubbleShown) {
        bubble.hidden = true;
      }
      gt(() => {
        cancelGift();
      }, delay);
    }

    // Interaction handler
    function onInteract(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (!currentGift || currentGift.interacted) return;
      currentGift.interacted = true;

      if (kind === 'present') {
        giftEl.classList.remove('gift-wiggle');
        giftEl.classList.add('opened');
        const surprises = ['🌸', '💖', '⭐'];
        const chosen = surprises[Math.floor(Math.random() * surprises.length)];
        const surpriseEl = giftEl.querySelector('.gift-surprise-item');
        if (surpriseEl) {
          surpriseEl.textContent = chosen;
        }

        if (!motion.matches) {
          const syms = ['✦', '✧', '♡', '·'];
          const dirs = [
            { x: -18, y: -26 },
            { x: 18, y: -28 },
            { x: -22, y: -12 },
            { x: 20, y: -14 }
          ];
          dirs.forEach((dir, i) => {
            const p = el('span', 'gift-pop-particle', syms[i]);
            p.style.setProperty('--px', `${dir.x}px`);
            p.style.setProperty('--py', `${dir.y}px`);
            giftEl.append(p);
            giftRecord.particles.push(p);
          });
        }

        clearPose();
        react('petting');
        state.happiness = Math.min(100, state.happiness + 5);
        if (meter) meter.style.width = `${state.happiness}%`;
        if (status) status.textContent = `♥ ${state.happiness}/100 · ${state.sleeping ? 'Dreaming of you' : state.happiness >= 90 ? 'Feeling adored' : 'Happy to be here'}`;
        void store({ happiness: state.happiness });

        if (state.giftMessages !== false) {
          const revMsg = pickGiftMessage('opened');
          if (revMsg) {
            bubble.textContent = revMsg;
            bubble.hidden = false;
            position();
            giftRecord.bubbleShown = true;
          }
        }

        gt(() => {
          fadeOutAndClose();
        }, motion.matches ? 2000 : 3800);
      } else {
        giftEl.classList.add('accepted');
        clearPose();
        pose('twitch', 600);
        state.happiness = Math.min(100, state.happiness + 5);
        if (meter) meter.style.width = `${state.happiness}%`;
        if (status) status.textContent = `♥ ${state.happiness}/100 · ${state.sleeping ? 'Dreaming of you' : state.happiness >= 90 ? 'Feeling adored' : 'Happy to be here'}`;
        void store({ happiness: state.happiness });

        if (!motion.matches) {
          const syms = ['♡', '✧', '✦'];
          const dirs = [{ x: -14, y: -20 }, { x: 14, y: -20 }, { x: 0, y: -26 }];
          dirs.forEach((dir, i) => {
            const p = el('span', 'gift-pop-particle', syms[i]);
            p.style.setProperty('--px', `${dir.x}px`);
            p.style.setProperty('--py', `${dir.y}px`);
            giftEl.append(p);
            giftRecord.particles.push(p);
          });
        }

        if (state.giftMessages !== false) {
          const accMsg = pickGiftMessage('accepted');
          if (accMsg) {
            bubble.textContent = accMsg;
            bubble.hidden = false;
            position();
            giftRecord.bubbleShown = true;
          }
        }

        gt(() => {
          fadeOutAndClose();
        }, motion.matches ? 1500 : 2600);
      }
    }

    giftEl.addEventListener('pointerdown', e => {
      e.stopPropagation();
    });
    giftEl.addEventListener('click', onInteract);
    giftEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        onInteract(e);
      }
    });

    // Expiration timer if ignored (12.5 seconds)
    gt(() => {
      if (!currentGift || currentGift.interacted) return;
      fadeOutAndClose();
    }, 12500);
  }

  globalThis.__lovebugGift = tryStartGift;

  function schedule() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!state.hidden && !document.hidden) {
        // Offer a note before selecting a pose; a visible bubble then blocks walking.
        const noteCooldown = globalThis.harness ? 180000 : 45000;
        const noteChance = globalThis.harness ? .14 : .35;
        if (Date.now() - lastMessage > noteCooldown && Math.random() < noteChance) {
          const message = randomMessage();
          if (message !== undefined && say(message)) { previousRandomMessage = message; lastMessage = Date.now(); }
        }
        if (shouldGift()) {
          tryStartGift();
        } else if (canIdle()) {
          idleCount++;
          const n = Math.random();
          if (globalThis.harness) {
            // Choose one action per tick; a periodic walk must not overlap a pose.
            if (idleCount % 6 === 0 && idleCount % 18 !== 0) walk();
            else if (idleCount % 18 === 0) { toyCount++; tryStartToy(); }
            else if (shouldPeekaboo()) tryStartPeekaboo();
            else if (n < .42) pose('blink', 650);
            else if (n < .62) pose(Math.random() < .5 ? 'look' : 'look-left', 1700);
            else if (n < .78) pose('twitch', 600);
            else if (n < .9) pose('stretch', 1900);
            else if (n < .98) walk();
            else save({ sleeping: true });
          } else {
            // In real browser: lively, engaging mix of toys, walks, poses, and peekaboo
            if (shouldPeekaboo()) {
              tryStartPeekaboo();
            } else if (toyCount === 0 || idleCount % 4 === 0) {
              toyCount++;
              tryStartToy();
            } else if (idleCount % 3 === 0) {
              walk();
            } else if (n < .22) {
              pose('blink', 650);
            } else if (n < .42) {
              pose(Math.random() < .5 ? 'look' : 'look-left', 1700);
            } else if (n < .60) {
              pose('twitch', 600);
            } else if (n < .76) {
              pose('stretch', 1900);
            } else if (n < .90) {
              toyCount++;
              tryStartToy();
            } else if (n < .97) {
              walk();
            } else {
              save({ sleeping: true });
            }
          }
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
    const stride = globalThis.harness ? 65 : (110 + Math.floor(Math.random() * 90));
    const direction = x > max - stride ? -1 : x < stride ? 1 : Math.random() < .5 ? -1 : 1;
    anchor.classList.toggle('facing-left', direction < 0);
    const target = Math.max(0, Math.min(max, x + direction * stride));
    const started = performance.now();
    const duration = globalThis.harness ? 1700 : Math.round((Math.abs(target - x) / 65) * 1100);
    function frame(now) {
      if (generation !== walkGeneration || !walking) return;
      if (state.hidden || state.sleeping || document.hidden || motion.matches || !panel.hidden || dragging || activePose || reactionKind) { stopWalk(); return; }
      const p = Math.min(1, (now - started) / (duration || 1700));
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

    // Sleep pose overlay elements (always present, shown/hidden via CSS)
    const sleepPawOverlay = el('div', 'sleep-paw-overlay');
    sleepPawOverlay.setAttribute('aria-hidden', 'true');
    const sleepBellyMarks = el('div', 'sleep-belly-marks');
    sleepBellyMarks.setAttribute('aria-hidden', 'true');
    sleepBellyMarks.textContent = '·   ·   ·';

    kitten.append(gesture, sleepZ, sleepPawOverlay, sleepBellyMarks);
    panel = el('section', 'panel'); panel.hidden = true; panel.setAttribute('aria-label', 'Kitten care');
    title = el('div', 'title'); status = el('div', 'sub'); const track = el('div', 'meter'); meter = el('span'); track.append(meter);
    const actions = el('div', 'actions'); const rename = el('form', 'rename'); rename.hidden = true;
    const input = el('input'); input.maxLength = 30; input.setAttribute('aria-label', 'New kitten name'); const submit = el('button', '', 'Save'); submit.type = 'submit'; rename.append(input, submit);
    rename.addEventListener('submit', event => { event.preventDefault(); save({ name: input.value.trim().slice(0, 30) || 'Lovebug' }); rename.hidden = true; position(); });
    const callbacks = {
      'Pet': () => { save({ happiness: Math.min(100, state.happiness + 5), sleeping: false }); react('petting'); },
      'Feed': () => { save({ happiness: Math.min(100, state.happiness + 8), sleeping: false }); react('feeding'); },
      'Play': () => {
        panel.hidden = true; bubble.hidden = true; kitten.setAttribute('aria-expanded', 'false');
        save({ happiness: Math.min(100, state.happiness + 6), sleeping: false });
        tryStartToy();
      },
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
      const wasPeeking = Boolean(peekaboo);
      stopWalk(); clearPose(); endReaction(); cancelToy(); cancelPeekaboo(true); cancelGift();
      if (wasPeeking) position();
      dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, left: parseFloat(anchor.style.left), top: parseFloat(anchor.style.top) }; moved = false;
      kitten.setPointerCapture(e.pointerId);
    });
    kitten.addEventListener('pointermove', e => {
      if (!dragging || dragging.id !== e.pointerId) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.hypot(dx, dy) > 9) moved = true;
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
        stopWalk(); clearPose(); cancelPeekaboo(true); cancelGift();
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
      cancelToy(); cancelPeekaboo(true); cancelGift(); callbacks['Pet']();
    });
    document.addEventListener('pointerdown', e => { if (!e.composedPath().includes(host)) { panel.hidden = true; kitten.setAttribute('aria-expanded', 'false'); } }, true);
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { panel.hidden = true; kitten.setAttribute('aria-expanded', 'false'); kitten.focus(); } });
    document.addEventListener('keydown', () => { bubble.hidden = true; }, true);
    addEventListener('resize', () => {
      stopWalk(); clearPose(); cancelToy(); cancelPeekaboo(true); cancelGift();
      stopDrag();
      position();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopWalk(); stopDrag(); clearPose(); cancelToy(); cancelPeekaboo(true); cancelGift(); bubble.hidden = true;
        // Pause dream bubbles when tab is hidden
        clearTimeout(dreamBubbleTimer); dreamBubbleTimer = null;
      } else if (state.sleeping) {
        // Resume dream bubbles when tab becomes visible again while sleeping
        scheduleDreamBubble();
      }
      anchor.classList.toggle('paused', document.hidden);
    });
    motion.addEventListener('change', () => {
      if (motion.matches) {
        stopWalk(); clearPose(); cancelToy(); cancelPeekaboo(true); cancelGift();
        // Clear pose change timer when motion is reduced
        clearTimeout(sleepPoseTimer); sleepPoseTimer = null;
        // Clear dream bubbles when reduced motion is enabled
        clearTimeout(dreamBubbleTimer); dreamBubbleTimer = null;
        anchor.querySelectorAll('.dream-bubble').forEach(el => el.remove());
      } else if (state.sleeping) {
        // Resume scheduled pose changes and dream bubbles if now sleeping
        scheduleSleepPoseChange();
        scheduleDreamBubble();
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      for (const key of Object.keys(defaults)) if (changes[key]) patch[key] = changes[key].newValue ?? defaults[key];
      // A local drag owns its live position until release; unrelated tab updates
      // may still update name, happiness and visibility without moving the kitten.
      if (dragging || patch.position?.writer === positionWriter) delete patch.position;
      else if ('position' in patch) stopWalk(false);
      if (patch.hidden || patch.sleeping || patch.surpriseGifts === false) { stopWalk(); clearPose(); cancelToy(); cancelPeekaboo(true); cancelGift(); }
      state = clean({ ...state, ...patch }); render();
      if (changes.triggerGiftNow) {
        if (!state.hidden && !document.hidden && !motion.matches) {
          if (state.sleeping) { save({ sleeping: false }); react('waking'); }
          cancelToy(); cancelPeekaboo(true); tryStartGift();
        }
      }
      if (changes.triggerToyNow) {
        if (!state.hidden && !document.hidden && !motion.matches) {
          if (state.sleeping) { save({ sleeping: false }); react('waking'); }
          cancelGift(); cancelPeekaboo(true); tryStartToy();
        }
      }
      if (changes.triggerPeekNow) {
        if (!state.hidden && !document.hidden && !motion.matches) {
          if (state.sleeping) { save({ sleeping: false }); react('waking'); }
          cancelToy(); cancelGift(); tryStartPeekaboo();
        }
      }
    });
    anchor.classList.toggle('paused', document.hidden);
    schedule();
    // A slow health check restores the overlay if a dynamic site replaces its root content.
    setInterval(() => { if (!host.isConnected && document.documentElement) document.documentElement.append(host); }, 10000);
  }
  init().catch(error => { console.warn('Little Lovebug could not start:', error.message); globalThis.__littleLovebug = false; });
})();
