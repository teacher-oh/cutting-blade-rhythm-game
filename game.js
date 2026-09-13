// CUTTING RHYTHM - Knight movement prototype
// Existing background code is intentionally left untouched.

const world = document.querySelector('.game-world');
const actorsLayer = document.querySelector('#actors-layer');

// Knight actor is rendered above the existing background.
const actorCanvas = document.createElement('canvas');
actorCanvas.id = 'knight-actor-canvas';
Object.assign(actorCanvas.style, {
  position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
  display: 'block', pointerEvents: 'none', imageRendering: 'pixelated', zIndex: '20'
});
actorsLayer.style.zIndex = '20';
actorsLayer.appendChild(actorCanvas);

const ctx = actorCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resizeActorCanvas() {
  const rect = world.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  actorCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  actorCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  actorCanvas.style.width = `${rect.width}px`;
  actorCanvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resizeActorCanvas);

// The new knight sheet is the 1536x1024 sheet uploaded to the repository root.
// It is arranged as 8 columns x 4 rows (the last row is unused/empty).
const knightSheet = new Image();
knightSheet.decoding = 'async';
knightSheet.src = './knight-sheet.png?v=6';

const CELL_W = 192;
const CELL_H = 256;
const SHEET_COLS = 8;

// Row 0: side-view movement frames. Used for A/D movement.
const WALK_FRAMES = Array.from({ length: SHEET_COLS }, (_, col) => ({
  x: col * CELL_W, y: 0, w: CELL_W, h: CELL_H
}));

// Row 0 first pose is also a stable side-view idle pose.
const IDLE_FRAME = { x: 0, y: 0, w: CELL_W, h: CELL_H };

// Row 1: front-facing poses. Used during jumping so the character has a distinct
// non-walking pose instead of freezing a walking frame.
const JUMP_FRAMES = Array.from({ length: SHEET_COLS }, (_, col) => ({
  x: col * CELL_W, y: CELL_H, w: CELL_W, h: CELL_H
}));

// Row 2: back-facing poses. Kept ready for future 8-direction controls.
const BACK_FRAMES = Array.from({ length: SHEET_COLS }, (_, col) => ({
  x: col * CELL_W, y: CELL_H * 2, w: CELL_W, h: CELL_H
}));

const player = {
  // Starting position matches the bridge location from the reference screenshot.
  x: 0.26,
  y: 0.947,
  vx: 0,
  vy: 0,
  direction: 1,
  onGround: true,
  state: 'idle',
  frame: 0,
  frameTimer: 0,
  jumpLock: false
};

const GROUND_Y = 0.947;
const WALK_SPEED = 0.27;
const GRAVITY = 1.85;
const JUMP_VELOCITY = -0.72;
const ACCELERATION = 7.5;
const DECELERATION = 10.0;
const WALK_FRAME_TIME = 0.095;
const IDLE_FRAME_TIME = 0.22;
const JUMP_FRAME_TIME = 0.12;
const keys = new Set();

window.addEventListener('keydown', event => {
  if (['KeyA', 'KeyD', 'KeyW', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);

  if (event.code === 'KeyW' && !player.jumpLock) {
    player.jumpLock = true;
    if (player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.state = 'jump';
      player.frame = 0;
      player.frameTimer = 0;
    }
  }
});

window.addEventListener('keyup', event => {
  keys.delete(event.code);
  if (event.code === 'KeyW') player.jumpLock = false;
});

function approach(current, target, amount) {
  if (current < target) return Math.min(current + amount, target);
  if (current > target) return Math.max(current - amount, target);
  return target;
}

function updatePlayer(dt) {
  const input = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);

  if (input) {
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
      player.frame = 0;
      player.frameTimer = 0;
    } else {
      player.state = player.vy < 0 ? 'jump' : 'fall';
    }
  } else {
    player.y = GROUND_Y;
    player.state = Math.abs(player.vx) > 0.012 ? 'walk' : 'idle';
  }

  if (player.state === 'walk') {
    player.frameTimer += dt;
    while (player.frameTimer >= WALK_FRAME_TIME) {
      player.frameTimer -= WALK_FRAME_TIME;
      player.frame = (player.frame + 1) % WALK_FRAMES.length;
    }
  } else if (player.state === 'idle') {
    player.frameTimer += dt;
    while (player.frameTimer >= IDLE_FRAME_TIME) {
      player.frameTimer -= IDLE_FRAME_TIME;
      player.frame = 0;
    }
  } else {
    player.frameTimer += dt;
    while (player.frameTimer >= JUMP_FRAME_TIME) {
      player.frameTimer -= JUMP_FRAME_TIME;
      player.frame = Math.min(player.frame + 1, JUMP_FRAMES.length - 1);
    }
  }
}

function drawKnight() {
  const width = world.clientWidth;
  const height = world.clientHeight;
  if (!width || !height) return;

  ctx.clearRect(0, 0, width, height);
  if (!knightSheet.complete || !knightSheet.naturalWidth) return;

  let frame;
  if (player.state === 'walk') frame = WALK_FRAMES[player.frame % WALK_FRAMES.length];
  else if (player.state === 'jump' || player.state === 'fall') frame = JUMP_FRAMES[player.frame % JUMP_FRAMES.length];
  else frame = IDLE_FRAME;

  // The artwork occupies most of each 192x256 cell. Keep the foot anchor stable.
  const targetHeight = Math.max(150, Math.min(205, height * 0.22));
  const scale = targetHeight / frame.h;
  const dw = frame.w * scale;
  const dh = frame.h * scale;
  const dx = player.x * width - dw / 2;
  const dy = player.y * height - dh;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (player.direction < 0) {
    ctx.translate(dx + dw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(knightSheet, frame.x, frame.y, frame.w, frame.h, 0, dy, dw, dh);
  } else {
    ctx.drawImage(knightSheet, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
  }

  ctx.restore();
}

knightSheet.addEventListener('load', drawKnight);
knightSheet.addEventListener('error', () => console.error('Knight sprite failed to load:', knightSheet.src));

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  updatePlayer(dt);
  drawKnight();
  requestAnimationFrame(gameLoop);
}

resizeActorCanvas();
requestAnimationFrame(gameLoop);
