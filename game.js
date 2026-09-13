// CUTTING RHYTHM - Knight movement / sprite animation
// Background implementation is intentionally untouched.

const world = document.querySelector('.game-world');
const actorsLayer = document.querySelector('#actors-layer');

actorsLayer.style.zIndex = '100';
actorsLayer.style.position = 'absolute';
actorsLayer.style.inset = '0';

const knight = document.createElement('div');
knight.id = 'knight-actor';
Object.assign(knight.style, {
  position: 'absolute',
  display: 'block',
  width: '128px',
  height: '227px',
  pointerEvents: 'none',
  zIndex: '101',
  transformOrigin: 'bottom center',
  willChange: 'transform, left, top'
});

const knightCanvas = document.createElement('canvas');
knightCanvas.width = 128;
knightCanvas.height = 227;
Object.assign(knightCanvas.style, {
  display: 'block',
  width: '100%',
  height: '100%',
  imageRendering: 'pixelated',
  pointerEvents: 'none'
});
knight.appendChild(knightCanvas);
actorsLayer.appendChild(knight);

const ctx = knightCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// 8 columns x 3 visible animation rows.
const SHEET_URL = './knight-sheet.png?v=10';
const SHEET_W = 1024;
const SHEET_H = 682;
const COLS = 8;
const ROWS = 3;
const CELL_W = SHEET_W / COLS;
const CELL_H = SHEET_H / ROWS;
const WALK_FRAMES = 8;

// Slightly slower than the previous version so each step reads clearly,
// while still looping smoothly.
const WALK_FRAME_TIME = 0.105;
const IDLE_FRAME = 0;
const GROUND_Y = 0.947;

const player = {
  x: 0.26,
  y: GROUND_Y,
  vx: 0,
  vy: 0,
  direction: 1,
  onGround: true,
  state: 'idle',
  frame: 0,
  frameTimer: 0,
  jumpLock: false
};

const WALK_SPEED = 0.27;
const GRAVITY = 1.85;
const JUMP_VELOCITY = -0.72;
const ACCELERATION = 7.5;
const DECELERATION = 10.0;
const keys = new Set();

let sheetReady = false;
let normalizedFrames = [];

function approach(current, target, amount) {
  if (current < target) return Math.min(current + amount, target);
  if (current > target) return Math.max(current - amount, target);
  return target;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

// Remove ONLY the checkerboard/background connected to the outside edge.
// This is much safer than deleting every gray pixel because the knight's
// silver armor is also gray. Armor remains because it is enclosed by the
// character outline instead of being connected to the sheet border.
function removeCheckerboard(image) {
  const source = document.createElement('canvas');
  source.width = SHEET_W;
  source.height = SHEET_H;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.drawImage(image, 0, 0, SHEET_W, SHEET_H);

  const imageData = sourceCtx.getImageData(0, 0, SHEET_W, SHEET_H);
  const pixels = imageData.data;
  const total = SHEET_W * SHEET_H;
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  function isBackgroundPixel(x, y) {
    const i = (y * SHEET_W + x) * 4;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 20) return true;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max - min;
    const brightness = (r + g + b) / 3;

    // Checkerboard is neutral/light. Keep darker neutral knight outlines and
    // blue colored pixels intact.
    return saturation <= 12 && brightness >= 135;
  }

  function seed(x, y) {
    const index = y * SHEET_W + x;
    if (background[index] || !isBackgroundPixel(x, y)) return;
    background[index] = 1;
    queue[tail++] = index;
  }

  // Seed every edge pixel, then flood-fill all connected checkerboard areas.
  for (let x = 0; x < SHEET_W; x++) {
    seed(x, 0);
    seed(x, SHEET_H - 1);
  }
  for (let y = 1; y < SHEET_H - 1; y++) {
    seed(0, y);
    seed(SHEET_W - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % SHEET_W;
    const y = Math.floor(index / SHEET_W);

    if (x > 0) seed(x - 1, y);
    if (x + 1 < SHEET_W) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y + 1 < SHEET_H) seed(x, y + 1);
  }

  for (let index = 0; index < total; index++) {
    if (background[index]) {
      pixels[index * 4 + 3] = 0;
    }
  }

  sourceCtx.putImageData(imageData, 0, 0);
  return source;
}

// Normalize every walk frame to the same center and foot line.
// This prevents the character from visibly bouncing when the sprite frame changes.
function makeNormalizedFrames(source) {
  const frames = [];
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  const baseLine = 226;

  for (let frame = 0; frame < WALK_FRAMES; frame++) {
    const sx = Math.round(frame * CELL_W);
    const sy = 0;
    const sw = Math.round(CELL_W);
    const sh = Math.round(CELL_H);
    const imageData = sourceCtx.getImageData(sx, sy, sw, sh);
    const p = imageData.data;

    let minX = sw;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (p[(y * sw + x) * 4 + 3] > 10) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = Math.round(CELL_W);
    frameCanvas.height = Math.round(CELL_H);
    const frameCtx = frameCanvas.getContext('2d');
    frameCtx.imageSmoothingEnabled = false;

    if (maxX >= 0) {
      const contentCenter = (minX + maxX) / 2;
      const dx = Math.round(CELL_W / 2 - contentCenter);
      const dy = Math.round(baseLine - maxY);
      frameCtx.putImageData(imageData, dx, dy);
    }

    frames.push(frameCanvas);
  }

  return frames;
}

async function prepareKnightSprite() {
  try {
    const image = await loadImage(SHEET_URL);
    const transparentSheet = removeCheckerboard(image);
    normalizedFrames = makeNormalizedFrames(transparentSheet);
    sheetReady = true;
    drawKnight();
  } catch (error) {
    console.error('Knight sprite failed to load:', SHEET_URL, error);
  }
}

function updatePlayer(dt) {
  const input = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);

  if (input !== 0) {
    player.direction = input;
    player.vx = approach(player.vx, input * WALK_SPEED, ACCELERATION * dt);
  } else {
    player.vx = approach(player.vx, 0, DECELERATION * dt);
  }

  player.x = Math.max(0.055, Math.min(0.945, player.x + player.vx * dt));

  if (!player.onGround) {
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
      player.state = 'idle';
      player.frame = IDLE_FRAME;
      player.frameTimer = 0;
    }
  } else {
    player.y = GROUND_Y;
    player.state = Math.abs(player.vx) > 0.012 ? 'walk' : 'idle';
  }

  if (player.state === 'walk') {
    player.frameTimer += dt;
    while (player.frameTimer >= WALK_FRAME_TIME) {
      player.frameTimer -= WALK_FRAME_TIME;
      player.frame = (player.frame + 1) % WALK_FRAMES;
    }
  } else {
    player.frame = IDLE_FRAME;
    player.frameTimer = 0;
  }
}

function drawKnight() {
  const width = world.clientWidth;
  const height = world.clientHeight;
  if (!width || !height || !sheetReady) return;

  const targetHeight = Math.max(155, Math.min(205, height * 0.225));
  const scale = targetHeight / CELL_H;
  const spriteW = CELL_W * scale;
  const spriteH = CELL_H * scale;
  const left = player.x * width - spriteW / 2;
  const top = player.y * height - spriteH;

  knight.style.width = `${spriteW}px`;
  knight.style.height = `${spriteH}px`;
  knight.style.left = `${left}px`;
  knight.style.top = `${top}px`;

  ctx.clearRect(0, 0, knightCanvas.width, knightCanvas.height);
  ctx.save();
  if (player.direction < 0) {
    ctx.translate(knightCanvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(normalizedFrames[player.frame], 0, 0, knightCanvas.width, knightCanvas.height);
  ctx.restore();
}

window.addEventListener('keydown', event => {
  if (['KeyA', 'KeyD', 'KeyW', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);

  if (event.code === 'KeyW' && !player.jumpLock) {
    player.jumpLock = true;
    if (player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.state = 'jump';
      player.frame = IDLE_FRAME;
      player.frameTimer = 0;
    }
  }
});

window.addEventListener('keyup', event => {
  keys.delete(event.code);
  if (event.code === 'KeyW') player.jumpLock = false;
});

window.addEventListener('resize', drawKnight);

prepareKnightSprite();
drawKnight();

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  updatePlayer(dt);
  drawKnight();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
