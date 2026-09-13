// CUTTING RHYTHM - Knight movement prototype
// Existing background code is intentionally left untouched.

const world = document.querySelector('.game-world');
const actorsLayer = document.querySelector('#actors-layer');

// Knight is rendered above the background, at the bridge position marked in the reference screenshot.
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

const knightSheet = new Image();
knightSheet.decoding = 'async';
knightSheet.src = './assets/knight-sheet.png?v=4';

const IDLE_FRAMES = [
  {x:7,y:6,w:49,h:84},{x:69,y:6,w:53,h:84},{x:134,y:6,w:51,h:84},
  {x:198,y:6,w:51,h:84},{x:263,y:6,w:49,h:84},{x:327,y:6,w:48,h:84}
];
const WALK_FRAMES = [
  {x:4,y:102,w:56,h:85},{x:69,y:102,w:54,h:85},{x:132,y:102,w:55,h:85},{x:196,y:102,w:55,h:85},
  {x:260,y:102,w:55,h:85},{x:325,y:102,w:53,h:85},{x:388,y:102,w:55,h:85},{x:452,y:102,w:55,h:85}
];

// Reference screenshot: knight is on the left bridge, roughly x=26% and feet at 95% of viewport height.
const player = {
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
const keys = new Set();

window.addEventListener('keydown', event => {
  if (['KeyA','KeyD','KeyW','Space'].includes(event.code)) event.preventDefault();
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

  if (player.state === 'jump' || player.state === 'fall') return;
  const frames = player.state === 'walk' ? WALK_FRAMES : IDLE_FRAMES;
  const frameTime = player.state === 'walk' ? WALK_FRAME_TIME : IDLE_FRAME_TIME;
  player.frameTimer += dt;
  while (player.frameTimer >= frameTime) {
    player.frameTimer -= frameTime;
    player.frame = (player.frame + 1) % frames.length;
  }
}

function drawKnight() {
  const width = world.clientWidth;
  const height = world.clientHeight;
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  if (!knightSheet.complete || !knightSheet.naturalWidth) return;

  const frames = player.state === 'walk' ? WALK_FRAMES : IDLE_FRAMES;
  const frame = frames[player.frame % frames.length];
  const targetHeight = Math.max(120, Math.min(175, height * 0.18));
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
