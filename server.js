const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

let players = {};

io.on("connection", (socket) => {
  console.log("player connected:", socket.id);

  players[socket.id] = { x: 100, y: 100 };

  io.emit("players", players);

  socket.on("move", (data) => {
    players[socket.id] = data;
    io.emit("players", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

http.listen(3000, () => console.log("server running"));
