// ===========================
// Stage & Tree Configuration
// ===========================

const StageConfig = {
  width: 1100,
  height: 680
};

const TreeRenderConfig = {
  radiusDecay: 0.97
};

const TreeShape = {
  seed: { x: StageConfig.width / 2 - 20, color: "rgb(190, 26, 37)", scale: 2 },
  branches: [
    {
      from: [535, 680],
      control: [570, 250],
      to: [500, 200],
      radius: 30,
      steps: 100,
      children: [
        {
          from: [540, 500],
          control: [455, 417],
          to: [340, 400],
          radius: 13,
          steps: 100,
          children: [
            { from: [450, 435], control: [434, 430], to: [394, 395], radius: 2, steps: 40 }
          ]
        },
        {
          from: [550, 445],
          control: [600, 356],
          to: [680, 345],
          radius: 12,
          steps: 100,
          children: [
            { from: [578, 400], control: [648, 409], to: [661, 426], radius: 3, steps: 80 }
          ]
        },
        { from: [539, 281], control: [537, 248], to: [534, 217], radius: 3, steps: 40 },
        {
          from: [546, 397],
          control: [413, 247],
          to: [328, 244],
          radius: 9,
          steps: 80,
          children: [
            { from: [427, 286], control: [383, 253], to: [371, 205], radius: 2, steps: 40 },
            { from: [498, 345], control: [435, 315], to: [395, 330], radius: 4, steps: 60 }
          ]
        },
        {
          from: [546, 357],
          control: [608, 252],
          to: [678, 221],
          radius: 6,
          steps: 100,
          children: [
            { from: [590, 293], control: [646, 277], to: [648, 271], radius: 2, steps: 80 }
          ]
        }
      ]
    }
  ],
  bloom: { num: 700, width: 1080, height: 650 },
  footer: { width: 1200, height: 5, speed: 10 }
};

// ===========================
// Seed — the initial clickable heart
// ===========================

class Seed {
  constructor(tree, point, scale = 1, color = "#FF0000", config = {}) {
    this.tree = tree;
    this.config = config;
    this.heart = { point, scale, color, figure: new Heart() };
    this.circle = { point: new Point(point.x, point.y), scale, color, radius: 5 };
  }

  draw() {
    this.drawHeart();
    this.drawText();
  }

  canMove() { return this.circle.point.y < this.tree.height + 20; }
  canScale() { return this.heart.scale > 0.2; }

  move(x, y) {
    this.clear();
    this.drawCircle();
    const { point } = this.circle;
    point.set(point.x + x, point.y + y);
  }

  scale(s) {
    this.clear();
    this.drawCircle();
    this.drawHeart();
    this.heart.scale *= s;
  }

  drawHeart() {
    const { ctx } = this.tree;
    const { point, color, scale, figure } = this.heart;
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(point.x, point.y);
    ctx.scale(scale, scale);
    ctx.fill(figure.path);
    ctx.restore();
  }

  drawCircle() {
    const { ctx } = this.tree;
    const { point, color, scale, radius } = this.circle;
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(point.x, point.y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawText() {
    const { ctx } = this.tree;
    const { point, color, scale } = this.heart;
    const text = this.config.seedText || "Love";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.translate(point.x, point.y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(15, 15);
    ctx.lineTo(60, 15);
    ctx.stroke();
    ctx.moveTo(0, 0);
    ctx.scale(0.75, 0.75);
    ctx.font = '12px sans-serif';
    ctx.fillText(text, 23, 10);
    ctx.restore();
  }

  clear() {
    const { ctx } = this.tree;
    const { point, scale } = this.circle;
    const w = 26 * scale, h = 26 * scale;
    ctx.clearRect(point.x - w, point.y - h, 4 * w, 4 * h);
  }

  hover(x, y) {
    const { point, scale = 1 } = this.heart;
    // Generous hitbox for easy clicking and tapping, especially on mobile devices
    const heartRadius = Math.max(60, 50 * scale);
    if (Math.hypot(x - point.x, y - point.y) <= heartRadius) {
      return true;
    }

    // Bounding box covering the branch stem and seed text with padding
    const minX = point.x - 45 * scale;
    const maxX = point.x + 95 * scale;
    const minY = point.y - 50 * scale;
    const maxY = point.y + 50 * scale;

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }
}

// ===========================
// Footer — the ground line that grows outward
// ===========================

class Footer {
  constructor(tree, width, height, speed = 2) {
    this.tree = tree;
    this.point = new Point(tree.seed.heart.point.x, tree.height - height / 2);
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.length = 0;
  }

  draw(ctx) {
    ctx = ctx || this.tree.groundCtx;
    const { point, height, length, width } = this;
    ctx.save();
    ctx.strokeStyle = "rgb(35, 31, 32)";
    ctx.lineWidth = height;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(point.x, point.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length / 2, 0);
    ctx.lineTo(-length / 2, 0);
    ctx.stroke();
    ctx.restore();
    if (length < width) this.length += this.speed;
  }
}

// ===========================
// Branch — a quadratic bezier segment that grows progressively
// ===========================

class Branch {
  constructor(tree, p1, p2, p3, radius, steps = 100, children = []) {
    this.tree = tree;
    this.curve = [p1, p2, p3];
    this.initialRadius = radius;
    this.steps = steps;
    this.children = children;
    this.step = 0;
  }

  currentRadius() {
    return this.initialRadius * Math.pow(TreeRenderConfig.radiusDecay, this.step);
  }

  grow() {
    if (this.step >= this.steps) {
      this.tree.removeBranch(this);
      this.tree.addBranches(this.children);
      return;
    }

    const t0 = this.step / this.steps;
    const t1 = (this.step + 1) / this.steps;
    const start = bezier(this.curve, t0);
    const end = bezier(this.curve, t1);

    const { ctx } = this.tree;
    const r = this.currentRadius();
    ctx.save();
    ctx.strokeStyle = "rgb(35, 31, 32)";
    ctx.lineWidth = r * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgb(35, 31, 32)";
    ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();

    this.step++;
  }
}

// ===========================
// Bloom — a heart-shaped petal that blooms or falls
// ===========================

class Bloom {
  constructor(tree, point, figure, color = `rgb(255,${randomInt(0, 255)},${randomInt(0, 255)})`,
    alpha = randomFloat(0.3, 1), angle = randomFloat(0, Math.PI * 2), scale = 0.1) {
    this.tree = tree;
    this.point = point;
    this.color = color;
    this.alpha = alpha;
    this.angle = angle;
    this.scale = scale;
    this.figure = figure;
    this.vx = 0;
    this.vy = 0;
    this.swing = 0.02;
    this.swingAmp = 0.6;
    this.wind = 0;
    this.phase = 0;
    this.spin = 0.02;
  }

  flower() {
    this.drawOn(this.tree.ctx);
    this.scale += 0.1;
    return this.scale <= 1;
  }

  drawOn(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.point.x, this.point.y);
    ctx.scale(this.scale, this.scale);
    ctx.rotate(this.angle);
    ctx.fill(this.figure.path);
    ctx.restore();
  }

  fall(dt) {
    const { x, y } = this.point;
    if (x < -40 || x > this.tree.width + 40 || y > this.tree.height + 40) {
      this.alpha = 0;
      return;
    }
    this.drawOn(this.tree.dynamicCtx);
    const f = dt / 16;
    this.vy += 0.018 * f;
    this.vx += this.wind * 0.01 * f;
    const sway = Math.sin(this.phase + y * this.swing) * this.swingAmp * f;
    this.point.set(x + this.vx * f + sway, y + this.vy * f);
    this.angle += this.spin * f;
    this.alpha = Math.max(this.alpha - 0.0008 * f, 0);
  }
}

// ===========================
// Tree — orchestrates all canvas elements
// ===========================

function getTreeShiftX() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--tree-shift-x");
  return parseFloat(value) || AnimationConfig.TREE_SHIFT_X;
}

function toPoint([x, y]) {
  return new Point(x, y);
}

class Tree {
  constructor(staticCanvas, dynamicCanvas, groundCanvas, width, height, opt = {}, config = {}) {
    this.staticCanvas = staticCanvas;
    this.ctx = staticCanvas.getContext("2d");
    this.dynamicCanvas = dynamicCanvas;
    this.dynamicCtx = dynamicCanvas.getContext("2d");
    this.groundCanvas = groundCanvas;
    this.groundCtx = groundCanvas.getContext("2d");
    this.width = width;
    this.height = height;
    this.opt = opt;
    this.config = config;
    this.initSeed();
    this.initFooter();
    this.initBranch();
    this.initBloom();
  }

  initSeed() {
    const { x = this.width / 2, y = this.height / 2, color = "#FF0000", scale = 1 } = this.opt.seed || {};
    this.seed = new Seed(this, new Point(x, y), scale, color, this.config);
  }

  initFooter() {
    const { width = this.width, height = 5, speed = 2 } = this.opt.footer || {};
    this.footer = new Footer(this, width, height, speed);
  }

  initBranch() {
    this.branches = [];
    this.addBranches(this.opt.branches || []);
  }

  initBloom() {
    const { num = 500, width = this.width, height = this.height } = this.opt.bloom || {};
    const figure = this.seed.heart.figure;
    this.blooms = [];
    this.bloomsCache = Array.from(
      { length: num },
      () => this.createBloom(width, height, 240, figure)
    );
    this.fallingBlooms = [];
  }

  addBranches(branches) {
    branches.forEach(({ from, control, to, radius, steps, children = [] }) => {
      this.branches.push(new Branch(
        this,
        toPoint(from),
        toPoint(control),
        toPoint(to),
        radius,
        steps,
        children
      ));
    });
  }

  removeBranch(branch) { this.branches = this.branches.filter((b) => b !== branch); }
  canGrow() { return this.branches.length > 0; }
  grow() { this.branches.forEach((b) => b?.grow()); }

  createBloom(width, height, radius, figure) {
    const maxAttempts = 1000;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.random() * (width - 40) + 20;
      const y = Math.random() * (height - 40) + 20;
      if (inHeart(x - width / 2, height - (height - 40) / 2 - y, radius)) {
        return new Bloom(this, new Point(x, y), figure);
      }
    }
    return new Bloom(this, new Point(width / 2, height / 2), figure);
  }

  canFlower() { return this.bloomsCache.length > 0; }

  flower(num) {
    this.blooms.push(...this.bloomsCache.splice(0, num));
    for (let i = 0; i < this.blooms.length; i++) {
      if (!this.blooms[i].flower()) {
        this.blooms.splice(i, 1);
        i--;
      }
    }
  }

  createFallingBloom() {
    const figure = this.seed.heart.figure;
    const crown = {
      x: this.width / 2 + getTreeShiftX(),
      y: this.height * 0.42
    };
    const bloom = new Bloom(
      this,
      new Point(crown.x + randomFloat(-150, 170), crown.y + randomFloat(-140, 65)),
      figure,
      `rgb(255,${randomInt(70, 210)},${randomInt(90, 210)})`,
      randomFloat(0.65, 1),
      randomFloat(-0.8, 0.8),
      randomFloat(0.55, 0.95)
    );

    bloom.vx = randomFloat(-0.75, -0.15);
    bloom.vy = randomFloat(0.35, 0.9);
    bloom.swing = randomFloat(0.012, 0.028);
    bloom.swingAmp = randomFloat(0.35, 1.1);
    bloom.wind = randomFloat(-1.4, -0.55);
    bloom.phase = randomFloat(0, Math.PI * 2);
    bloom.spin = randomFloat(-0.018, 0.022);
    return bloom;
  }

  resetFallingBlooms() {
    this.blooms = [];
    this.fallingBlooms = [];
  }

  jump(dt) {
    for (let i = 0; i < this.fallingBlooms.length; i++) {
      const bloom = this.fallingBlooms[i];
      bloom.fall(dt);
      if (bloom.alpha <= 0) {
        this.fallingBlooms.splice(i, 1);
        i--;
      }
    }

    if (this.fallingBlooms.length < AnimationConfig.MAX_FALLING_HEARTS && Math.random() < AnimationConfig.FALLING_SPAWN_CHANCE) {
      this.fallingBlooms.push(this.createFallingBloom());
    }
  }
}
