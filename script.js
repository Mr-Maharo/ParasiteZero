const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// STATE
let gameOver = false;

// PLAYER
let player = {
  x: 100,
  y: 100,
  size: 30,
  speed: 4,
  hp: 100,
  infected: false,
  parasite: false
};

// ENEMY
let enemy = {
  x: 400,
  y: 300,
  size: 30,
  speed: 2
};

// KEYS
let keys = {};

document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// MOVE PLAYER
function updatePlayer() {
  if (player.parasite) return;

  if (keys["w"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["a"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;
}

// ENEMY AI
function updateEnemy() {
  let dx = player.x - enemy.x;
  let dy = player.y - enemy.y;
  let dist = Math.sqrt(dx*dx + dy*dy);

  enemy.x += (dx / dist) * enemy.speed;
  enemy.y += (dy / dist) * enemy.speed;

  // infection
  if (dist < 30 && !player.parasite) {
    player.infected = true;
    player.hp -= 0.4;
  }
}

// CHECK TRANSFORMATION
function checkState() {
  if (player.hp <= 0 && !player.parasite) {
    player.parasite = true;
    player.infected = false;

    // 🔥 transformation: player becomes new enemy AI
    enemy = {
      x: player.x,
      y: player.y,
      size: 30,
      speed: 2.5
    };
  }
}

// DRAW
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // PLAYER / PARASITE
  if (player.parasite) {
    ctx.fillStyle = "red";
  } else {
    ctx.fillStyle = player.infected ? "purple" : "blue";
  }

  ctx.fillRect(player.x, player.y, player.size, player.size);

  // ENEMY
  ctx.fillStyle = "red";
  ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);

  // UI
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText("HP: " + Math.floor(player.hp), 20, 30);

  if (player.infected) {
    ctx.fillText("INFECTED 😈", 20, 60);
  }

  if (player.parasite) {
    ctx.fillText("YOU ARE NOW THE PARASITE 💀", 20, 90);
  }
}

// LOOP
function loop() {
  updatePlayer();
  updateEnemy();
  checkState();
  draw();
  requestAnimationFrame(loop);
}

loop();