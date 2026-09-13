// CUTTING RHYTHM - Knight movement prototype
// The existing background layer is intentionally left untouched.

const world = document.querySelector('.game-world');
const actorsLayer = document.querySelector('#actors-layer');

function resizeWorld() {
  world.style.aspectRatio = '16 / 9';
  resizeActorCanvas();
}
window.addEventListener('resize', resizeWorld);

// --------------------------------------------------
// Knight actor canvas
// --------------------------------------------------
const actorCanvas = document.createElement('canvas');
actorCanvas.id = 'knight-actor-canvas';
actorCanvas.setAttribute('aria-hidden', 'true');
Object.assign(actorCanvas.style, {
  position: 'absolute',
  inset: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  imageRendering: 'pixelated'
});
actorsLayer.appendChild(actorCanvas);

const ctx = actorCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resizeActorCanvas() {
  const rect = world.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  actorCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  actorCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

// The supplied 512x384 knight sheet is kept as-is.
// Row 1: 6 standing/idle poses
// Row 2: 8 walking poses
const knightSheet = new Image();
knightSheet.src = './assets/knight-sheet.png';

const IDLE_FRAMES = [
  { x: 7, y: 6, w: 49, h: 84 },
  { x: 69, y: 6, w: 53, h: 84 },
  { x: 134, y: 6, w: 51, h: 84 },
  { x: 198, y: 6, w: 51, h: 84 },
  { x: 263, y: 6, w: 49, h: 84 },
  { x: 327, y: 6, w: 48, h: 84 }
];

const WALK_FRAMES = [
  { x: 4, y: 102, w: 56, h: 85 },
  { x: 69, y: 102, w: 54, h: 85 },
  { x: 132, y: 102, w: 55, h: 85 },
  { x: 196, y: 102, w: 55, h: 85 },
  { x: 260, y: 102, w: 55, h: 85 },
  { x: 325, y: 102, w: 53, h: 85 },
  { x: 388, y: 102, w: 55, h: 85 },
  { x: 452, y: 102, w: 55, h: 85 }
];

const player = {
  x: 0.50,
  y: 0.78,
  vx: 0,
  vy: 0,
  direction: 1,
  onGround: true,
  state: 'idle',
  frame: 0,
  frameTimer: 0,
  jumpLock: false
};

const keys = new Set();
const WALK_SPEED = 0.27;       // world-widths per second
const GROUND_Y = 0.78;
const GRAVITY = 1.85;          // world-heights per second squared
const JUMP_VELOCITY = -0.72;
const ACCELERATION = 7.5;
const DECELERATION = 10.0;
const WALK_FRAME_TIME = 0.095;
const IDLE_FRAME_TIME = 0.22;

window.addEventListener('keydown', (event) => {
  if (['KeyA', 'KeyD', 'KeyW', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);

  if (event.code === 'KeyW' && !player.jumpLock) {
    player.jumpLock = true;
    if (player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.state = 'jump';
    }
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'KeyW') player.jumpLock = false;
});

function approach(current, target, amount) {
  if (current < target) return Math.min(current + amount, target);
  if (current > target) return Math.max(current - amount, target);
  return target;
}

function updatePlayer(dt) {
  const left = keys.has('KeyA');
  const right = keys.has('KeyD');
  const input = (right ? 1 : 0) - (left ? 1 : 0);

  if (input !== 0) {
    player.direction = input;
    player.vx = approach(player.vx, input * WALK_SPEED, ACCELERATION * dt);
  } else {
    player.vx = approach(player.vx, 0, DECELERATION * dt);
  }

  player.x += player.vx * dt;
  player.x = Math.max(0.055, Math.min(0.945, player.x));

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
  } else if (Math.abs(player.vx) > 0.012) {
    player.state = 'walk';
  } else {
    player.state = 'idle';
  }

  const frames = player.state === 'walk' ? WALK_FRAMES : IDLE_FRAMES;
  const frameTime = player.state === 'walk' ? WALK_FRAME_TIME : IDLE_FRAME_TIME;

  if (player.state === 'jump' || player.state === 'fall') {
    player.frame = 0;
    player.frameTimer = 0;
    return;
  }

  player.frameTimer += dt;
  while (player.frameTimer >= frameTime) {
    player.frameTimer -= frameTime;
    player.frame = (player.frame + 1) % frames.length;
  }
}

function drawKnight() {
  if (!knightSheet.complete || !knightSheet.naturalWidth) return;

  const width = world.clientWidth;
  const height = world.clientHeight;
  const frames = player.state === 'walk' ? WALK_FRAMES : IDLE_FRAMES;
  const frame = frames[player.frame % frames.length];

  // Keep the feet locked to the same world-space anchor on every frame.
  const pixelScale = Math.max(1, Math.floor(Math.min(width / 960, height / 540) * 1.35));
  const drawScale = Math.max(2, pixelScale);
  const dw = frame.w * drawScale;
  const dh = frame.h * drawScale;
  const dx = player.x * width - dw / 2;
  const dy = player.y * height - dh;

  ctx.clearRect(0, 0, width, height);
  ctx.save();

  if (player.direction < 0) {
    ctx.translate(dx + dw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(knightSheet, frame.x, frame.y, frame.w, frame.h, 0, dy, dw, dh);
  } else {
    ctx.drawImage(knightSheet, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
  }

  ctx.restore();
}

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  updatePlayer(dt);
  drawKnight();
  requestAnimationFrame(gameLoop);
}

knightSheet.addEventListener('load', drawKnight);
resizeWorld();
requestAnimationFrame(gameLoop);
