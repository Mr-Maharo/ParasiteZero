const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

// 🏠 ROOMS DATA
let rooms = {};

// 🧱 CREATE ROOM IF NOT EXISTS
function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: {},
      walls: [
        { x: 200, y: 200, w: 200, h: 20 },
        { x: 500, y: 300, w: 20, h: 200 },
        { x: 300, y: 500, w: 250, h: 20 }
      ]
    };
  }
}

// 🔌 CONNECTION
io.on("connection", (socket) => {

  console.log("player connected:", socket.id);

  // 🏠 JOIN ROOM
  socket.on("joinRoom", (roomId) => {
    createRoom(roomId);

    socket.join(roomId);

    rooms[roomId].players[socket.id] = {
      x: 100,
      y: 100
    };

    io.to(roomId).emit("roomData", rooms[roomId]);
  });

  // 🎮 MOVE + REAL COLLISION CHECK
  socket.on("move", ({ roomId, x, y }) => {
    let room = rooms[roomId];
    if (!room) return;

    let player = room.players[socket.id];
    if (!player) return;

    const size = 30;

    // 🧱 COLLISION WITH WALLS
    for (let w of room.walls) {
      if (
        x < w.x + w.w &&
        x + size > w.x &&
        y < w.y + w.h &&
        y + size > w.y
      ) {
        return; // BLOCK MOVEMENT
      }
    }

    // UPDATE POSITION
    player.x = x;
    player.y = y;

    io.to(roomId).emit("roomData", room);
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit("roomData", rooms[roomId]);
      }
    }
  });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("server running on " + PORT));