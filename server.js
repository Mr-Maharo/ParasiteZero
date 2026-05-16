const express = require('express');
app.use(express.static('public')); // Ity no tena important
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static('public'));

const TICK_RATE = 30;
const MAP_W = 2000, MAP_H = 2000;
const PLAYER_SPEED = 3.5;
const INFECT_DISTANCE = 28;
const GAME_TIME = 180; // 3 minitra

let rooms = {}; // Mitahiry ny state isaky ny room

const walls = [
    // Outer walls
    {x: 0, y: 0, w: MAP_W, h: 20},
    {x: 0, y: MAP_H-20, w: MAP_W, h: 20},
    {x: 0, y: 0, w: 20, h: MAP_H},
    {x: MAP_W-20, y: 0, w: 20, h: MAP_H},
    // Lab rooms
    {x: 200, y: 200, w: 400, h: 20},
    {x: 200, y: 200, w: 20, h: 300},
    {x: 800, y: 400, w: 20, h: 500},
    {x: 400, y: 700, w: 600, h: 20},
    {x: 1200, y: 200, w: 20, h: 400},
    {x: 1200, y: 600, w: 500, h: 20},
    {x: 1500, y: 900, w: 20, h: 400},
    {x: 300, y: 1100, w: 800, h: 20},
    {x: 1300, y: 1300, w: 20, h: 400},
];

function createRoom(roomCode) {
    return {
        players: {},
        gameTime: GAME_TIME,
        gameActive: false,
        gameStarted: false,
        winner: null
    }
}

function spawnPlayer() {
    return {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        infected: false,
        id: null,
        lastMove: Date.now()
    }
}

function checkWallCollision(x, y, size = 12) {
    for(let wall of walls) {
        if(x + size > wall.x &&
           x - size < wall.x + wall.w &&
           y + size > wall.y &&
           y - size < wall.y + wall.h) {
            return true;
        }
    }
    return false;
}

function startGame(roomCode) {
    const room = rooms[roomCode];
    if(!room || Object.keys(room.players).length < 2) return;

    room.gameActive = true;
    room.gameStarted = true;
    room.gameTime = GAME_TIME;
    room.winner = null;

    // Ovaina random 1 ho infected voalohany
    const playerIds = Object.keys(room.players);
    const firstInfected = playerIds[Math.floor(Math.random() * playerIds.length)];
    room.players[firstInfected].infected = true;

    io.to(roomCode).emit('gameStart');
    console.log(`Game started in room ${roomCode}`);
}

function endGame(roomCode, winner) {
    const room = rooms[roomCode];
    if(!room) return;

    room.gameActive = false;
    room.winner = winner;
    io.to(roomCode).emit('gameOver', { winner: winner });
    console.log(`Game ended in room ${roomCode}. Winner: ${winner}`);

    // Reset after 5s
    setTimeout(() => {
        if(rooms[roomCode]) {
            rooms[roomCode].gameStarted = false;
            rooms[roomCode].gameTime = GAME_TIME;
            Object.values(rooms[roomCode].players).forEach(p => {
                p.infected = false;
                p.x = 100 + Math.random() * 200;
                p.y = 100 + Math.random() * 200;
            });
            io.to(roomCode).emit('reset');
        }
    }, 5000);
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinRoom', (roomCode) => {
        roomCode = roomCode || 'public';
        socket.join(roomCode);
        socket.roomCode = roomCode;

        if(!rooms[roomCode]) {
            rooms[roomCode] = createRoom(roomCode);
        }

        const room = rooms[roomCode];
        room.players[socket.id] = spawnPlayer();
        room.players[socket.id].id = socket.id;

        socket.emit('init', {
            id: socket.id,
            walls: walls,
            mapSize: {w: MAP_W, h: MAP_H},
            roomCode: roomCode
        });

        // Auto start rehefa 2+ ny player
        if(Object.keys(room.players).length >= 2 &&!room.gameStarted) {
            setTimeout(() => startGame(roomCode), 3000);
        }

        console.log(`Player ${socket.id} joined room ${roomCode}`);
    });

    socket.on('move', (keys) => {
        const roomCode = socket.roomCode;
        if(!roomCode ||!rooms[roomCode]) return;

        const room = rooms[roomCode];
        const p = room.players[socket.id];
        if(!p ||!room.gameActive) return;

        let newX = p.x, newY = p.y;
        if(keys.w) newY -= PLAYER_SPEED;
        if(keys.s) newY += PLAYER_SPEED;
        if(keys.a) newX -= PLAYER_SPEED;
        if(keys.d) newX += PLAYER_SPEED;

        if(!checkWallCollision(newX, newY) &&
           newX > 20 && newX < MAP_W-20 &&
           newY > 20 && newY < MAP_H-20) {
            p.x = newX;
            p.y = newY;
            p.lastMove = Date.now();
        }
    });

    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if(roomCode && rooms[roomCode]) {
            delete rooms[roomCode].players[socket.id];
            console.log(`Player ${socket.id} left room ${roomCode}`);

            // Fafana ny room raha foana
            if(Object.keys(rooms[roomCode].players).length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted`);
            }
        }
    });
});

// Game Loop isaky ny room
setInterval(() => {
    Object.keys(rooms).forEach(roomCode => {
        const room = rooms[roomCode];
        if(!room.gameActive) return;

        // Timer
        room.gameTime--;
        if(room.gameTime <= 0) {
            endGame(roomCode, 'SURVIVORS');
            return;
        }

        // Infection system
        let infectedPlayers = Object.values(room.players).filter(p => p.infected);
        let survivors = Object.values(room.players).filter(p =>!p.infected);

        if(survivors.length === 0) {
            endGame(roomCode, 'INFECTED');
            return;
        }

        for(let infected of infectedPlayers) {
            for(let surv of survivors) {
                let dx = infected.x - surv.x;
                let dy = infected.y - surv.y;
                let dist = Math.sqrt(dx*dx + dy*dy);

                if(dist < INFECT_DISTANCE) {
                    room.players[surv.id].infected = true;
                    io.to(roomCode).emit('infected', { id: surv.id });
                }
            }
        }

        // Alefa ny state
        io.to(roomCode).emit('state', {
            players: room.players,
            gameTime: room.gameTime,
            gameActive: room.gameActive
        });
    });
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`PARASITE ZERO server mandeha amin'ny port ${PORT}`));