// Background-first prototype.
// Player, enemies, collision and occlusion will be added on top of these layers.
const world = document.querySelector('.game-world');

// Keep the scene responsive without drawing the artwork into a canvas.
function resizeWorld() {
  world.style.aspectRatio = '16 / 9';
}
window.addEventListener('resize', resizeWorld);
resizeWorld();
