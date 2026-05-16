const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// ============================================
// GAME CONSTANTS
// ============================================

const GAME_CONFIG = {
    WIDTH: 1200,
    HEIGHT: 800,
    PLAYER_SIZE: 20,
    PLAYER_SPEED: 200,
    FRICTION: 0.85,
    INFECTION_SPREAD_RADIUS: 30,
    SURVIVAL_TIME: 120,
    TICK_RATE: 20,
    ROOM_CHECK_INTERVAL: 100
};

// ============================================
// SEEDED RANDOM
// ============================================

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }

    int(min, max) {
        return Math.floor(this.range(min, max));
    }
}

// ============================================
// MAP GENERATOR
// ============================================

class MapGenerator {
    constructor(seed) {
        this.seed = seed;
        this.rng = new SeededRandom(seed);
        this.gridSize = 20;
        this.gridWidth = Math.floor(GAME_CONFIG.WIDTH / this.gridSize);
        this.gridHeight = Math.floor(GAME_CONFIG.HEIGHT / this.gridSize);
        this.grid = [];
        this.walls = [];
        this.spawnPoints = [];
    }

    generate() {
        this.initGrid();
        this.carveMaze();
        this.generateWalls();
        this.generateSpawns();
        return { walls: this.walls, spawnPoints: this.spawnPoints };
    }

    initGrid() {
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y][x] = 1;
            }
        }
    }

    carveMaze() {
        const stack = [];
        const startX = 2;
        const startY = 2;
        this.grid[startY][startX] = 0;
        stack.push([startX, startY]);

        const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];

        while (stack.length > 0) {
            const [x, y] = stack[stack.length - 1];
            const shuffled = directions.sort(() => this.rng.next() - 0.5);
            let carved = false;

            for (const [dx, dy] of shuffled) {
                const nx = x + dx;
                const ny = y + dy;

                if (nx > 0 && nx < this.gridWidth - 1 && ny > 0 && ny < this.gridHeight - 1 && this.grid[ny][nx] === 1) {
                    this.grid[y + dy / 2][x + dx / 2] = 0;
                    this.grid[ny][nx] = 0;
                    stack.push([nx, ny]);
                    carved = true;
                    break;
                }
            }

            if (!carved) stack.pop();
        }
    }

    generateWalls() {
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 1) {
                    this.walls.push({ x: x * this.gridSize, y: y * this.gridSize, w: this.gridSize, h: this.gridSize });
                }
            }
        }
    }

    generateSpawns() {
        const attempts = 20;
        for (let i = 0; i < attempts; i++) {
            const x = this.rng.int(100, GAME_CONFIG.WIDTH - 100);
            const y = this.rng.int(100, GAME_CONFIG.HEIGHT - 100);
            if (!this.hasWallAtPosition(x, y)) {
                this.spawnPoints.push({ x, y });
                if (this.spawnPoints.length >= 4) break;
            }
        }
    }

    hasWallAtPosition(x, y, size = GAME_CONFIG.PLAYER_SIZE) {
        for (const wall of this.walls) {
            if (!(x + size < wall.x || x > wall.x + wall.w || y + size < wall.y || y > wall.y + wall.h)) return true;
        }
        return false;
    }
}

// ============================================
// GAME ROOM CLASS
// ============================================

class GameRoom {
    constructor(roomId, mapSeed) {
        this.id = roomId;
        this.mapSeed = mapSeed;
        this.players = {};
        this.gameState = 'waiting';
        this.time = 0;
        this.tick = 0;

        const mapGen = new MapGenerator(mapSeed);
        const mapData = mapGen.generate();
        this.walls = mapData.walls;
        this.spawnPoints = mapData.spawnPoints;
    }

    addPlayer(playerId, socketId) {
        const spawn = this.spawnPoints[Object.keys(this.players).length % this.spawnPoints.length];
        this.players[playerId] = {
            id: playerId,
            socketId,
            x: spawn.x,
            y: spawn.y,
            vx: 0,
            vy: 0,
            speed: GAME_CONFIG.PLAYER_SPEED,
            size: GAME_CONFIG.PLAYER_SIZE,
            infected: Math.random() < 0.2,
            infectionTime: 0
        };
    }

    removePlayer(playerId) {
        delete this.players[playerId];
    }

    updatePlayer(playerId, input) {
        const player = this.players[playerId];
        if (!player) return;

        const acc = player.speed * 3;
        if (input.up) player.vy -= acc;
        if (input.down) player.vy += acc;
        if (input.left) player.vx -= acc;
        if (input.right) player.vx += acc;
    }

    update(dt) {
        this.time += dt;

        for (const playerId in this.players) {
            const player = this.players[playerId];
            player.vx *= GAME_CONFIG.FRICTION;
            player.vy *= GAME_CONFIG.FRICTION;

            let newX = player.x + player.vx * dt;
            let newY = player.y + player.vy * dt;

            if (!this.checkWallCollision(newX, newY, player.size)) {
                player.x = newX;
                player.y = newY;
            }

            player.x = Math.max(0, Math.min(GAME_CONFIG.WIDTH - player.size, player.x));
            player.y = Math.max(0, Math.min(GAME_CONFIG.HEIGHT - player.size, player.y));
        }

        this.checkInfections();
        this.checkWinCondition();
    }

    checkWallCollision(x, y, size) {
        for (const wall of this.walls) {
            if (!(x + size < wall.x || x > wall.x + wall.w || y + size < wall.y || y > wall.y + wall.h)) {
                return true;
            }
        }
        return false;
    }

    checkInfections() {
        const playerIds = Object.keys(this.players);
        for (let i = 0; i < playerIds.length; i++) {
            const p1 = this.players[playerIds[i]];
            if (p1.infected) {
                for (let j = i + 1; j < playerIds.length; j++) {
                    const p2 = this.players[playerIds[j]];
                    if (!p2.infected) {
                        const dx = p1.x - p2.x;
                        const dy = p1.y - p2.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < GAME_CONFIG.INFECTION_SPREAD_RADIUS) {
                            p2.infected = true;
                        }
                    }
                }
            }
        }
    }

    checkWinCondition() {
        const infectedCount = Object.values(this.players).filter(p => p.infected).length;
        const survivorCount = Object.values(this.players).length - infectedCount;

        if (survivorCount === 0) {
            return { type: 'infected_win', infected: infectedCount, total: Object.values(this.players).length };
        } else if (this.time >= GAME_CONFIG.SURVIVAL_TIME) {
            return { type: 'survivor_win', time: this.time };
        }
        return null;
    }

    getState() {
        return {
            players: this.players,
            walls: this.walls,
            time: this.time,
            gameState: this.gameState
        };
    }
}

// ============================================
// GAME MANAGER
// ============================================

const rooms = new Map();
const playerToRoom = new Map();

function createRoom() {
    const roomId = Math.random().toString(36).substr(2, 9);
    const room = new GameRoom(roomId, Math.floor(Math.random() * 10000));
    rooms.set(roomId, room);
    return roomId;
}

// ============================================
// SOCKET EVENTS
// ============================================

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join_game', (data) => {
        const roomId = data.roomId || createRoom();
        const playerId = socket.id;

        socket.join(roomId);
        playerToRoom.set(playerId, roomId);

        let room = rooms.get(roomId);
        if (!room) {
            room = new GameRoom(roomId, Math.floor(Math.random() * 10000));
            rooms.set(roomId, room);
        }

        room.addPlayer(playerId, socket.id);

        socket.emit('room_joined', {
            roomId,
            playerId,
            mapSeed: room.mapSeed,
            walls: room.walls,
            spawnPoints: room.spawnPoints
        });

        io.to(roomId).emit('player_joined', {
            playerId,
            playerCount: Object.keys(room.players).length
        });

        console.log(`Player ${socket.id} joined room ${roomId}`);
    });

    socket.on('input', (data) => {
        const roomId = playerToRoom.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.updatePlayer(socket.id, data);
            }
        }
    });

    socket.on('disconnect', () => {
        const roomId = playerToRoom.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.removePlayer(socket.id);
                console.log(`Player ${socket.id} left room ${roomId}`);

                if (Object.keys(room.players).length === 0) {
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} deleted (empty)`);
                }
            }
        }
        playerToRoom.delete(socket.id);
        console.log(`Player disconnected: ${socket.id}`);
    });
});

// ============================================
// GAME TICK LOOP
// ============================================

setInterval(() => {
    for (const [roomId, room] of rooms) {
        if (room.gameState === 'playing') {
            room.update(1 / GAME_CONFIG.TICK_RATE);
            const winCondition = room.checkWinCondition();

            const state = room.getState();
            io.to(roomId).emit('game_state', state);

            if (winCondition) {
                io.to(roomId).emit('game_over', winCondition);
                room.gameState = 'finished';
            }
        }
    }
}, 1000 / GAME_CONFIG.TICK_RATE);

// ============================================
// EXPRESS ROUTES
// ============================================

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.send('PARASITE ZERO Server Online');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`PARASITE ZERO Server listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});