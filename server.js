const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

let players = {};

io.on("connection", (socket) => {
  players[socket.id] = {
    x: 100,
    y: 100,
    infected: false
  };

  io.emit("players", players);

  socket.on("move", (data) => {
    if (!players[socket.id]) return;

    players[socket.id].x = data.x;
    players[socket.id].y = data.y;

    io.emit("players", players);
  });

  socket.on("infect", (targetId) => {
    if (players[targetId]) {
      players[targetId].infected = true;
    }
    io.emit("players", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("server running"));