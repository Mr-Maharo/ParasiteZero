const socket = io("https://parasitezero.onrender.com");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 🏠 ROOM
let roomId = "room1";
let room = null;

// PLAYER POSITION
let x = 100;
let y = 100;

// 🧱 JOIN ROOM
socket.emit("joinRoom", roomId);

// 📡 RECEIVE ROOM DATA (players + walls)
socket.on("roomData", (data) => {
  room = data;
});

// 🎮 MOVE (mouse control simple)
document.addEventListener("mousemove", (e) => {
  x = e.clientX;
  y = e.clientY;

  socket.emit("move", { roomId, x, y });
});

// 🖼️ DRAW GAME
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (room) {

    // 🧱 DRAW WALLS
    ctx.fillStyle = "gray";
    for (let w of room.walls) {
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }

    // 👾 DRAW PLAYERS
    for (let id in room.players) {
      const p = room.players[id];

      ctx.fillStyle = id === socket.id ? "blue" : "red";
      ctx.fillRect(p.x, p.y, 30, 30);
    }
  }

  requestAnimationFrame(draw);
}

draw();