
const socket = io("https://parasitezero.onrender.com");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let players = {};

let x = 100;
let y = 100;

// 🧱 WALLS (MAP)
let walls = [
  { x: 200, y: 150, w: 200, h: 20 },
  { x: 500, y: 300, w: 20, h: 200 },
  { x: 300, y: 450, w: 250, h: 20 }
];

// MOVE
document.addEventListener("mousemove", (e) => {
  x = e.clientX;
  y = e.clientY;

  socket.emit("move", { x, y });
});

// RECEIVE PLAYERS
socket.on("players", (data) => {
  players = data;
});

// 🧱 WALL COLLISION CHECK (simple visual only)
function drawWalls() {
  ctx.fillStyle = "gray";
  for (let w of walls) {
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }
}

// 😈 INFECTION CHECK (distance based)
function checkInfection() {
  for (let id in players) {
    if (id === socket.id) continue;

    let dx = players[id].x - x;
    let dy = players[id].y - y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 40 && players[socket.id]?.infected) {
      socket.emit("infect", id);
    }
  }
}

// DRAW LOOP
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawWalls();

  checkInfection();

  for (let id in players) {
    ctx.fillStyle = players[id].infected ? "purple" : (id === socket.id ? "blue" : "red");
    ctx.fillRect(players[id].x, players[id].y, 30, 30);
  }

  requestAnimationFrame(draw);
}

function startGame() {
  document.getElementById("menu").style.display = "none";
}

draw()