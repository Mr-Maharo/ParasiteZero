const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let players = {};

let x = 100;
let y = 100;

// CONTROL (mouse move simple)
document.addEventListener("mousemove", (e) => {
  x = e.clientX;
  y = e.clientY;

  socket.emit("move", { x, y });
});

// receive players
socket.on("players", (data) => {
  players = data;
});

// DRAW LOOP
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let id in players) {
    ctx.fillStyle = id === socket.id ? "blue" : "red";
    ctx.fillRect(players[id].x, players[id].y, 30, 30);
  }

  requestAnimationFrame(draw);
}

draw();