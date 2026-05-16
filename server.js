const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static(__dirname));

let players = {};

// CONNECTION
io.on("connection", (socket) => {
  console.log("player connected:", socket.id);

  // spawn player
  players[socket.id] = {
    x: 100,
    y: 100,
    hp: 100
  };

  // send all players
  io.emit("players", players);

  // receive movement
  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
    }

    io.emit("players", players);
  });

  // disconnect
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("server running on " + PORT));