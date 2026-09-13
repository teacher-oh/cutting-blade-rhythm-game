// CUTTING RHYTHM - Knight movement prototype
// Background implementation is intentionally untouched.

const world = document.querySelector('.game-world');
const actorsLayer = document.querySelector('#actors-layer');

// Put the character on a dedicated layer that is always above the background.
actorsLayer.style.zIndex = '100';
actorsLayer.style.position = 'absolute';
actorsLayer.style.inset = '0';
p

const knight = document.createElement('div');
knight.id = 'knight-actor';
Object.assign(knight.style, {
  position: 'absolute',
  display: 'block',
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: '101',
  transformOrigin: 'bottom center'
});

const knightImage = document.createElement('img');
knightImage.alt = '';
knightImage.draggable = false;
Object.assign(knightImage.style, {
  position: 'absolute',
  display: 'block',
  maxWidth: 'none',
  maxHeight: 'none',
  imageRendering: 'pixelated',
  userSelect: 'none',
  pointerEvents: 'none'
});

knight.appendChild(knightImage);
actorsLayer.appendChild(knight);

// The user's new 1536x1024 knight sheet is 8 columns x 4 cells.
// The visible character poses occupy rows 0-2.
const SHEET_URL = './knight-sheet.png?v=7';
const CELL_W = 192;
const CELL_H = 256;
const COLS = 8;

knightImage.src = SHEET_URL;

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
      player.frame = (player.frame + 1) % COLS;
    }
  } else if (player.state === 'jump' || player.state === 'fall') {
    player.frameTimer += dt;
    while (player.frameTimer >= JUMP_FRAME_TIME) {
      player.frameTimer -= JUMP_FRAME_TIME;
      player.frame = Math.min(player.frame + 1, COLS - 1);
    }
  } else {
    player.frame = 0;
    player.frameTimer = 0;
  }
}

function drawKnight() {
  const width = world.clientWidth;
  const height = world.clientHeight;
  if (!width || !height) return;

  // Make the knight large enough to be clearly visible on the bridge.
  const targetHeight = Math.max(155, Math.min(225, height * 0.24));
  const scale = targetHeight / CELL_H;
  const spriteW = CELL_W * scale;
  const spriteH = CELL_H * scale;

  const left = player.x * width - spriteW / 2;
  const top = player.y * height - spriteH;

  knight.style.width = `${spriteW}px`;
  knight.style.height = `${spriteH}px`;
  knight.style.left = `${left}px`;
  knight.style.top = `${top}px`;

  // Crop one 192x256 cell from the full sheet.
  knightImage.style.width = `${1536 * scale}px`;
  knightImage.style.height = `${1024 * scale}px`;
  knightImage.style.left = `${-(player.frame * CELL_W * scale)}px`;

  const row = (player.state === 'jump' || player.state === 'fall') ? 1 : 0;
  knightImage.style.top = `${-(row * CELL_H * scale)}px`;
  knightImage.style.transform = player.direction < 0 ? 'scaleX(-1)' : 'scaleX(1)';
  knightImage.style.transformOrigin = 'center center';
}

knightImage.addEventListener('error', () => {
  console.error('Knight sprite failed to load:', SHEET_URL);
  knight.textContent = 'KNIGHT IMAGE ERROR';
  knight.style.color = 'white';
  knight.style.font = 'bold 14px sans-serif';
});

function resize() {
  drawKnight();
}
window.addEventListener('resize', resize);

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  updatePlayer(dt);
  drawKnight();
  requestAnimationFrame(gameLoop);
}

// Draw immediately, then keep the physics/animation loop running.
drawKnight();
requestAnimationFrame(gameLoop);
