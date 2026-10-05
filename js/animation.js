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
    if (now - last >= interval) {
      step();
      last = now;
    }
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
  SCALE_FACTOR: 0.95,
  SEED_MOVE_SPEED: 2,
  TREE_GROW_DELAY: 5,
  FLOWER_BLOOM_COUNT: 4,
  FLOWER_BLOOM_DELAY: 10,
  TREE_SHIFT_X: 260,
  TREE_MOVE_DURATION: 1600,
  HEART_JUMP_INTERVAL: 25,
  MAX_FALLING_HEARTS: 4,
  FALLING_SPAWN_CHANCE: 0.22,
  TIME_UPDATE_INTERVAL: 1000
};

// ===========================
// Animation Phase Functions
// ===========================

function getCanvasPoint(event, canvas) {
  const source = event.touches ? event.touches[0] : event;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;
  return new Point(
    (source.clientX - rect.left) * logicalWidth / rect.width,
    (source.clientY - rect.top) * logicalHeight / rect.height
  );
}

async function waitForUserClick(seed, canvas) {
  return new Promise((resolve) => {
    function handler(e) {
      if (e.type === "touchstart") e.preventDefault();
      const point = getCanvasPoint(e, canvas);
      if (seed.hover(point.x, point.y)) {
        document.getElementById("bgm").play().catch(() => {});
        canvas.removeEventListener("click", handler);
        canvas.removeEventListener("touchstart", handler);
        resolve();
      }
    }

    canvas.addEventListener("click", handler);
    canvas.addEventListener("touchstart", handler, { passive: false });
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
