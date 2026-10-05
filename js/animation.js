// ===========================
// Animation Timing
// ===========================

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function wait(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function runUntil(isDone, step, interval = 16) {
  let last = 0;
  while (!isDone()) {
    const now = await nextFrame();
    const elapsed = last ? now - last : interval;
    // Run multiple steps per frame to compensate for low frame rates
    const stepsToRun = Math.max(1, Math.floor(elapsed / Math.max(interval, 1)));
    for (let i = 0; i < stepsToRun && !isDone(); i++) {
      step();
    }
    last = now;
  }
}

function startFrameLoop(step, interval = 16) {
  let last = 0;
  let frameId = 0;
  let running = true;

  function tick(now) {
    if (!running) return;
    if (now - last >= interval) {
      step(now);
      last = now;
    }
    frameId = requestAnimationFrame(tick);
  }

  frameId = requestAnimationFrame(tick);

  return function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  };
}

// ===========================
// Animation Config
// ===========================

const AnimationConfig = {
  SCALE_FACTOR: 0.93,
  SEED_MOVE_SPEED: 4,
  TREE_GROW_DELAY: 5,
  FLOWER_BLOOM_COUNT: 8,
  FLOWER_BLOOM_DELAY: 8,
  TREE_SHIFT_X: 260,
  TREE_MOVE_DURATION: 1400,
  HEART_JUMP_INTERVAL: 25,
  MAX_FALLING_HEARTS: 4,
  FALLING_SPAWN_CHANCE: 0.22,
  TIME_UPDATE_INTERVAL: 1000
};

// ===========================
// Animation Phase Functions
// ===========================

function getCanvasPoint(event, canvas) {
  const source = (event.touches && event.touches[0]) ||
                 (event.changedTouches && event.changedTouches[0]) ||
                 event;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;
  return new Point(
    (source.clientX - rect.left) * logicalWidth / rect.width,
    (source.clientY - rect.top) * logicalHeight / rect.height
  );
}

function playBgm() {
  const bgm = document.getElementById("bgm");
  if (!bgm) return;

  // Wake up Web Audio session on iOS/mobile if supported
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!window._bgmAudioCtx) {
        window._bgmAudioCtx = new AudioCtx();
      }
      if (window._bgmAudioCtx.state === "suspended") {
        window._bgmAudioCtx.resume().catch(() => {});
      }
    }
  } catch (err) {
    // Ignore audio context errors
  }

  bgm.muted = false;
  bgm.volume = 1.0;

  const playPromise = bgm.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn("Audio autoplay blocked, will retry on next user tap:", err);
      // Fallback: unlock and play on the next user tap anywhere on the screen
      const retryPlay = () => {
        bgm.muted = false;
        bgm.volume = 1.0;
        bgm.play().then(() => {
          document.removeEventListener("touchstart", retryPlay);
          document.removeEventListener("touchend", retryPlay);
          document.removeEventListener("click", retryPlay);
        }).catch(() => {});
      };

      document.addEventListener("touchstart", retryPlay, { passive: true });
      document.addEventListener("touchend", retryPlay, { passive: true });
      document.addEventListener("click", retryPlay);
    });
  }
}

async function waitForUserClick(seed, canvas) {
  return new Promise((resolve) => {
    let started = false;
    let touchStartedOnSeed = false;

    function onMove(e) {
      const point = getCanvasPoint(e, canvas);
      canvas.style.cursor = seed.hover(point.x, point.y) ? "pointer" : "default";
    }

    function onTouchStart(e) {
      const point = getCanvasPoint(e, canvas);
      if (seed.hover(point.x, point.y)) {
        touchStartedOnSeed = true;
        // Prime/load the audio on touchstart
        const bgm = document.getElementById("bgm");
        if (bgm) bgm.load();
      }
    }

    function onTouchEnd(e) {
      const point = getCanvasPoint(e, canvas);
      if (touchStartedOnSeed || seed.hover(point.x, point.y)) {
        touchStartedOnSeed = false;
        triggerStart(e);
      }
    }

    function onClick(e) {
      const point = getCanvasPoint(e, canvas);
      if (seed.hover(point.x, point.y)) {
        triggerStart(e);
      }
    }

    function triggerStart(e) {
      if (started) return;
      started = true;

      // Play music inside the user gesture (touchend/click)
      playBgm();

      cleanup();
      resolve();
    }

    function cleanup() {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("click", onClick);
      canvas.style.cursor = "default";
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("click", onClick);
  });
}

function animateSeedShrink(seed) {
  return runUntil(
    () => !seed.canScale(),
    () => seed.scale(AnimationConfig.SCALE_FACTOR),
    AnimationConfig.TREE_GROW_DELAY
  );
}

function animateSeedMove(seed, footer) {
  return runUntil(
    () => !seed.canMove(),
    () => {
      seed.move(0, AnimationConfig.SEED_MOVE_SPEED);
      footer.draw();
    },
    AnimationConfig.TREE_GROW_DELAY
  );
}

function animateTreeGrow(tree) {
  return runUntil(
    () => !tree.canGrow(),
    () => tree.grow(),
    AnimationConfig.TREE_GROW_DELAY
  );
}

function animateFlowerBloom(tree) {
  return runUntil(
    () => !tree.canFlower(),
    () => tree.flower(AnimationConfig.FLOWER_BLOOM_COUNT),
    AnimationConfig.FLOWER_BLOOM_DELAY
  );
}

async function animateTreeMove(staticCanvas) {
  staticCanvas.classList.add("shifted");
  await wait(AnimationConfig.TREE_MOVE_DURATION);
}

function startHeartJumpAnimation(tree) {
  const { dynamicCtx, width, height } = tree;
  let lastTime = 0;

  function render(now) {
    const dt = Math.min(lastTime ? now - lastTime : 16, 50);
    lastTime = now;
    dynamicCtx.clearRect(0, 0, width, height);
    tree.jump(dt);
  }

  let stop = startFrameLoop(render, AnimationConfig.HEART_JUMP_INTERVAL);

  function handleVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      lastTime = 0;
      stop = startFrameLoop(render, AnimationConfig.HEART_JUMP_INTERVAL);
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
}

// ===========================
// Typewriter Effect
// ===========================

function charDelay(char, base) {
  if ("…".includes(char)) return base * 12;
  if ("。！？.!?".includes(char)) return base * 10;
  if ("，、；：,;:".includes(char)) return base * 5;
  return base + Math.random() * base * 0.5;
}

async function typewriter(el, speed = 100) {
  el.style.display = "block";

  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  cursor.textContent = "_";

  const lines = [];
  const paragraphs = el.querySelectorAll("p");
  for (const p of paragraphs) {
    lines.push({ p, text: p.textContent });
    p.textContent = "";
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const textNode = document.createTextNode("");
    line.p.appendChild(textNode);
    line.p.appendChild(cursor);

    for (const char of line.text) {
      textNode.textContent += char;
      await wait(charDelay(char, speed));
    }

    if (i < lines.length - 1) {
      await wait(speed * 8);
    }
  }

  cursor.classList.add("typewriter-cursor--done");
  await wait(3600);
  cursor.remove();
}
