const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1200;
canvas.height = 800;

// ============================================
// CONSTANTS
// ============================================

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 200;
const FRICTION = 0.85;
const WALL_WIDTH = 40;
const SURVIVAL_TIME = 120;
const INFECTION_SPREAD_RADIUS = 30;
const INFECTION_DELAY = 0.3;

// ============================================
// SEEDED RANDOM FOR MAP GENERATION
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
// MAP GENERATION
// ============================================

class MapGenerator {
    constructor(seed) {
        this.seed = seed;
        this.rng = new SeededRandom(seed);
        this.gridSize = 20;
        this.gridWidth = Math.floor(GAME_WIDTH / this.gridSize);
        this.gridHeight = Math.floor(GAME_HEIGHT / this.gridSize);
        this.grid = [];
        this.walls = [];
        this.spawnPoints = [];
    }

    generate() {
        this.initGrid();
        this.carveMaze();
        this.generateWalls();
        this.generateSpawns();
        return {
            walls: this.walls,
            spawnPoints: this.spawnPoints
        };
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

            if (!carved) {
                stack.pop();
            }
        }
    }

    generateWalls() {
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x] === 1) {
                    this.walls.push({
                        x: x * this.gridSize,
                        y: y * this.gridSize,
                        w: this.gridSize,
                        h: this.gridSize
                    });
                }
            }
        }
    }

    generateSpawns() {
        const attempts = 20;
        for (let i = 0; i < attempts; i++) {
            const x = this.rng.int(100, GAME_WIDTH - 100);
            const y = this.rng.int(100, GAME_HEIGHT - 100);
            if (!this.hasWallAtPosition(x, y, PLAYER_SIZE)) {
                this.spawnPoints.push({ x, y });
                if (this.spawnPoints.length >= 4) break;
            }
        }
        if (this.spawnPoints.length === 0) {
            this.spawnPoints.push({ x: 100, y: 100 }, { x: GAME_WIDTH - 100, y: GAME_HEIGHT - 100 });
        }
    }

    hasWallAtPosition(x, y, size) {
        for (const wall of this.walls) {
            if (!(x + size < wall.x || x > wall.x + wall.w || y + size < wall.y || y > wall.y + wall.h)) {
                return true;
            }
        }
        return false;
    }
}

// ============================================
// PLAYER CLASS
// ============================================

class Player {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.speed = PLAYER_SPEED;
        this.size = PLAYER_SIZE;
        this.infected = false;
        this.infectionTime = 0;
        this.flickerPhase = 0;
        this.glowIntensity = 0;
    }

    handleInput(keys) {
        const acc = this.speed * 3;
        if (keys['w'] || keys['ArrowUp']) this.vy -= acc;
        if (keys['s'] || keys['ArrowDown']) this.vy += acc;
        if (keys['a'] || keys['ArrowLeft']) this.vx -= acc;
        if (keys['d'] || keys['ArrowRight']) this.vx += acc;
    }

    update(dt, walls) {
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        let newX = this.x + this.vx * dt;
        let newY = this.y + this.vy * dt;

        if (!this.checkWallCollision(newX, newY, walls)) {
            this.x = newX;
            this.y = newY;
        } else {
            if (!this.checkWallCollision(newX, this.y, walls)) {
                this.x = newX;
            } else if (!this.checkWallCollision(this.x, newY, walls)) {
                this.y = newY;
            }
        }

        this.x = Math.max(0, Math.min(GAME_WIDTH - this.size, this.x));
        this.y = Math.max(0, Math.min(GAME_HEIGHT - this.size, this.y));

        if (this.infected) {
            this.infectionTime += dt;
            this.flickerPhase += dt * 8;
            this.glowIntensity = 0.5 + Math.sin(this.flickerPhase) * 0.5;
        }
    }

    checkWallCollision(x, y, walls) {
        for (const wall of walls) {
            if (!(x + this.size < wall.x || x > wall.x + wall.w || y + this.size < wall.y || y > wall.y + wall.h)) {
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        if (this.infected) {
            ctx.shadowColor = `rgba(255, 0, 0, ${this.glowIntensity})`;
            ctx.shadowBlur = 20;
            ctx.fillStyle = `rgba(255, ${Math.floor(50 * this.glowIntensity)}, ${Math.floor(50 * this.glowIntensity)}, 0.9)`;
        } else {
            ctx.shadowColor = 'rgba(0, 0, 255, 0.5)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#0080FF';
        }

        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowBlur = 0;
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// ============================================
// ENEMY AI CLASS
// ============================================

class EnemyAI {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.speed = 120;
        this.size = PLAYER_SIZE;
        this.infected = true;
        this.targetId = null;
        this.detectionRadius = 300;
        this.flickerPhase = 0;
        this.glowIntensity = 0;
        this.moveTimer = 0;
    }

    update(dt, players, walls) {
        this.flickerPhase += dt * 8;
        this.glowIntensity = 0.5 + Math.sin(this.flickerPhase) * 0.5;

        let nearestDist = this.detectionRadius;
        let target = null;

        for (const player of players) {
            if (!player.infected) {
                const dist = this.distanceTo(player);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    target = player;
                }
            }
        }

        if (target) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                this.vx = nx * this.speed;
                this.vy = ny * this.speed;
            }
        } else {
            this.vx *= 0.95;
            this.vy *= 0.95;
        }

        let newX = this.x + this.vx * dt;
        let newY = this.y + this.vy * dt;

        if (!this.checkWallCollision(newX, newY, walls)) {
            this.x = newX;
            this.y = newY;
        } else {
            if (!this.checkWallCollision(newX, this.y, walls)) {
                this.x = newX;
            } else if (!this.checkWallCollision(this.x, newY, walls)) {
                this.y = newY;
            }
        }

        this.x = Math.max(0, Math.min(GAME_WIDTH - this.size, this.x));
        this.y = Math.max(0, Math.min(GAME_HEIGHT - this.size, this.y));
    }

    checkWallCollision(x, y, walls) {
        for (const wall of walls) {
            if (!(x + this.size < wall.x || x > wall.x + wall.w || y + this.size < wall.y || y > wall.y + wall.h)) {
                return true;
            }
        }
        return false;
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    draw(ctx) {
        ctx.shadowColor = `rgba(255, 0, 0, ${this.glowIntensity})`;
        ctx.shadowBlur = 25;
        ctx.fillStyle = `rgba(255, 0, 0, ${0.7 + this.glowIntensity * 0.3})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowBlur = 0;
    }
}

// ============================================
// PARTICLE SYSTEM
// ============================================

class Particle {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1;
        this.maxLife = 0.5;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 200 * dt;
        this.life -= dt / this.maxLife;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life);
        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================
// EFFECTS SYSTEM
// ============================================

class EffectsManager {
    constructor() {
        this.particles = [];
        this.shakeIntensity = 0;
        this.shakeTime = 0;
        this.flashAlpha = 0;
        this.flashTime = 0;
    }

    burst(x, y, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 100 + Math.random() * 150;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            this.particles.push(new Particle(x, y, vx, vy));
        }
    }

    shake(intensity = 10) {
        this.shakeIntensity = intensity;
        this.shakeTime = 0.3;
    }

    flash() {
        this.flashAlpha = 1;
        this.flashTime = 0.2;
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        this.shakeTime -= dt;
        if (this.shakeTime < 0) this.shakeIntensity = 0;

        this.flashTime -= dt;
        if (this.flashTime < 0) this.flashAlpha = 0;
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }

    getShakeOffset() {
        if (this.shakeIntensity > 0) {
            return {
                x: (Math.random() - 0.5) * this.shakeIntensity,
                y: (Math.random() - 0.5) * this.shakeIntensity
            };
        }
        return { x: 0, y: 0 };
    }

    drawFlash(ctx) {
        if (this.flashAlpha > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.flashAlpha * 0.7})`;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
    }
}

// ============================================
// GAME STATE
// ============================================

const game = {
    state: 'menu',
    mapSeed: 42,
    players: [],
    enemies: [],
    walls: [],
    spawnPoints: [],
    time: 0,
    localPlayerId: null,
    effects: new EffectsManager(),
    keys: {},
    infectionQueue: [],
    lastInfectionTrigger: 0
};

// ============================================
// INPUT HANDLING
// ============================================

window.addEventListener('keydown', (e) => {
    game.keys[e.key.toLowerCase()] = true;
    game.keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    game.keys[e.key.toLowerCase()] = false;
    game.keys[e.key] = false;
});

// ============================================
// GAME INITIALIZATION
// ============================================

function initGame() {
    game.state = 'playing';
    game.time = 0;
    game.players = [];
    game.enemies = [];
    game.infectionQueue = [];
    game.effects = new EffectsManager();

    const mapGen = new MapGenerator(game.mapSeed);
    const mapData = mapGen.generate();
    game.walls = mapData.walls;
    game.spawnPoints = mapData.spawnPoints;

    const playerCount = 3;
    for (let i = 0; i < playerCount; i++) {
        const spawn = game.spawnPoints[i % game.spawnPoints.length];
        const player = new Player(i, spawn.x, spawn.y);
        if (i === 0) {
            game.localPlayerId = i;
            player.infected = Math.random() < 0.3;
        }
        game.players.push(player);
    }

    const enemyCount = 2;
    for (let i = 0; i < enemyCount; i++) {
        const spawn = game.spawnPoints[(playerCount + i) % game.spawnPoints.length];
        game.enemies.push(new EnemyAI(100 + i, spawn.x, spawn.y));
    }
}

// ============================================
// UPDATE LOGIC
// ============================================

function updateGame(dt) {
    if (game.state !== 'playing') return;

    game.time += dt;

    const localPlayer = game.players[game.localPlayerId];
    if (localPlayer) {
        localPlayer.handleInput(game.keys);
    }

    for (const player of game.players) {
        player.update(dt, game.walls);
    }

    for (const enemy of game.enemies) {
        enemy.update(dt, game.players, game.walls);
    }

    checkInfections();
    game.effects.update(dt);

    checkWinConditions();
}

function checkInfections() {
    for (const enemy of game.enemies) {
        for (const player of game.players) {
            if (!player.infected && enemy.distanceTo(player) < INFECTION_SPREAD_RADIUS) {
                if (game.infectionQueue.indexOf(player.id) === -1) {
                    game.infectionQueue.push(player.id);
                }
            }
        }
    }

    for (let i = 0; i < game.players.length; i++) {
        const p1 = game.players[i];
        if (p1.infected) {
            for (let j = i + 1; j < game.players.length; j++) {
                const p2 = game.players[j];
                if (!p2.infected && p1.distanceTo(p2) < INFECTION_SPREAD_RADIUS) {
                    if (game.infectionQueue.indexOf(p2.id) === -1) {
                        game.infectionQueue.push(p2.id);
                    }
                }
            }
        }
    }

    for (const playerId of game.infectionQueue) {
        const player = game.players[playerId];
        if (player && !player.infected) {
            player.infected = true;
            game.effects.burst(player.x + player.size / 2, player.y + player.size / 2, 20);
            game.effects.shake(15);
            game.effects.flash();
        }
    }
    game.infectionQueue = [];
}

function checkWinConditions() {
    const infectedCount = game.players.filter(p => p.infected).length;
    const survivorCount = game.players.length - infectedCount;

    if (survivorCount === 0) {
        game.state = 'gameover';
        game.winMessage = 'INFECTION COMPLETE - INFECTED WIN';
    } else if (game.time >= SURVIVAL_TIME) {
        game.state = 'gameover';
        game.winMessage = 'SURVIVORS WIN - YOU OUTLASTED THE PARASITE';
    }
}

// ============================================
// RENDERING
// ============================================

function drawGame() {
    const shake = game.effects.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (const wall of game.walls) {
        ctx.fillStyle = '#333333';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }

    for (const enemy of game.enemies) {
        enemy.draw(ctx);
    }

    for (const player of game.players) {
        player.draw(ctx);
    }

    game.effects.draw(ctx);

    ctx.restore();

    game.effects.drawFlash(ctx);

    drawHUD();
}

function drawHUD() {
    const infectedCount = game.players.filter(p => p.infected).length;
    const survivorCount = game.players.length - infectedCount;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`TIME: ${Math.floor(game.time)}s / ${SURVIVAL_TIME}s`, 20, 30);
    ctx.fillText(`SURVIVORS: ${survivorCount}`, 20, 55);
    ctx.fillText(`INFECTED: ${infectedCount}`, 20, 80);

    const localPlayer = game.players[game.localPlayerId];
    if (localPlayer) {
        ctx.fillStyle = localPlayer.infected ? '#FF0000' : '#0080FF';
        ctx.fillText(localPlayer.infected ? 'STATUS: INFECTED' : 'STATUS: SURVIVOR', 20, 105);
    }
}

function drawMenu() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PARASITE ZERO', GAME_WIDTH / 2, 200);

    ctx.fillStyle = '#FF5555';
    ctx.font = '24px Arial';
    ctx.fillText('Survival Horror Infection Game', GAME_WIDTH / 2, 280);

    ctx.fillStyle = '#AAAAAA';
    ctx.font = '16px Arial';
    ctx.fillText('Survive 120 seconds or infect all players', GAME_WIDTH / 2, 350);
    ctx.fillText('Blue = Survivor | Red = Infected', GAME_WIDTH / 2, 380);
    ctx.fillText('WASD or Arrow Keys to move', GAME_WIDTH / 2, 410);

    ctx.fillStyle = '#FF0000';
    ctx.fillRect(GAME_WIDTH / 2 - 100, 480, 200, 60);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('START GAME', GAME_WIDTH / 2, 520);

    ctx.fillStyle = '#555555';
    ctx.font = '12px Arial';
    ctx.fillText('Press SPACE or click to start', GAME_WIDTH / 2, 600);
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.fillStyle = game.winMessage.includes('INFECTED') ? '#FF0000' : '#00FF00';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', GAME_WIDTH / 2, 200);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(game.winMessage, GAME_WIDTH / 2, 300);

    const infectedCount = game.players.filter(p => p.infected).length;
    const survivalTime = Math.floor(game.time);
    ctx.font = '18px Arial';
    ctx.fillText(`Time Survived: ${survivalTime}s`, GAME_WIDTH / 2, 380);
    ctx.fillText(`Infected Players: ${infectedCount}/${game.players.length}`, GAME_WIDTH / 2, 420);

    ctx.fillStyle = '#FF0000';
    ctx.fillRect(GAME_WIDTH / 2 - 120, 480, 240, 70);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('RESTART GAME', GAME_WIDTH / 2, 530);

    ctx.fillStyle = '#555555';
    ctx.font = '12px Arial';
    ctx.fillText('Press SPACE or click to restart', GAME_WIDTH / 2, 600);
}

// ============================================
// MOUSE CLICK HANDLING
// ============================================

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (game.state === 'menu') {
        if (x > GAME_WIDTH / 2 - 100 && x < GAME_WIDTH / 2 + 100 && y > 480 && y < 540) {
            initGame();
        }
    } else if (game.state === 'gameover') {
        if (x > GAME_WIDTH / 2 - 120 && x < GAME_WIDTH / 2 + 120 && y > 480 && y < 550) {
            game.state = 'menu';
        }
    }
});

// ============================================
// KEYBOARD START/RESTART
// ============================================

window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
        if (game.state === 'menu') {
            initGame();
        } else if (game.state === 'gameover') {
            game.state = 'menu';
        }
    }
});

// ============================================
// MAIN GAME LOOP
// ============================================

let lastTime = performance.now();

function gameLoop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.016);
    lastTime = currentTime;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (game.state === 'menu') {
        drawMenu();
    } else if (game.state === 'playing') {
        updateGame(dt);
        drawGame();
    } else if (game.state === 'gameover') {
        drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);