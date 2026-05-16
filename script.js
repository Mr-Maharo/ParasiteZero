const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// PLAYER
let player = {
  x: 100,
  y: 100,
  size: 30,
  speed: 4
};

// ENEMY
let enemy = {
  x: 400,
  y: 300,
  size: 30,
  speed: 2
};

// 🧱 WALLS (MAP SIMPLE)
let walls = [
  { x: 200, y: 200, w: 200, h: 20 },
  { x: 500, y: 300, w: 20, h: 200 },
  { x: 300, y: 500, w: 300, h: 20 }
];

// KEYS
let keys = {};

document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

function collide(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.size > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.y + rect1.size > rect2.y
  );
}

// PLAYER MOVE + COLLISION
function updatePlayer() {
  let oldX = player.x;
  let oldY = player.y;

  if (keys["w"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["a"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;

  // collision walls
  for (let wall of walls) {
    if (collide(player, wall)) {
      player.x = oldX;
      player.y = oldY;
    }
  }
}

// ENEMY AI + COLLISION
function updateEnemy() {
  let oldX = enemy.x;
  let oldY = enemy.y;

  let dx = player.x - enemy.x;
  let dy = player.y - enemy.y;
  let dist = Math.sqrt(dx*dx + dy*dy);

  enemy.x += (dx / dist) * enemy.speed;
  enemy.y += (dy / dist) * enemy.speed;

  // wall collision enemy
  for (let wall of walls) {
    if (collide(enemy, wall)) {
      enemy.x = oldX;
      enemy.y = oldY;
    }
  }
}

// DRAW MAP
function drawWalls() {
  ctx.fillStyle = "gray";
  for (let wall of walls) {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  }
}

// DRAW GAME
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  drawWalls();

  ctx.fillStyle = "blue";
  ctx.fillRect(player.x, player.y, player.size, player.size);

  ctx.fillStyle = "red";
  ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
}

// LOOP
function loop() {
  updatePlayer();
  updateEnemy();
  draw();
  requestAnimationFrame(loop);
}

loop();