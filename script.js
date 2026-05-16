const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let players = {};
let myId = null;
let walls = [];
let mapSize = {w: 1200, h: 800};
let camera = {x: 0, y: 0};
let gameActive = true;
let heartbeatAudio = null;

const keys = {w: false, a: false, s: false, d: false};
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room') || 'public';
document.getElementById('roomCode').textContent = roomCode;

// Join room
socket.emit('joinRoom', roomCode);

// Socket events
socket.on('init', (data) => {
    myId = data.id;
    walls = data.walls;
    mapSize = data.mapSize;
});

socket.on('state', (serverPlayers) => {
    players = serverPlayers;
    updateUI();
    checkProximity();
});

socket.on('timer', (time) => {
    let min = Math.floor(time / 60);
    let sec = time % 60;
    document.getElementById('timer').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
});

socket.on('gameOver', (data) => {
    gameActive = false;
    const gameOverDiv = document.getElementById('gameOver');
    const winnerText = document.getElementById('winnerText');
    const winReason = document.getElementById('winReason');

    if(data.winner === 'INFECTED') {
        winnerText.textContent = 'INFECTED WIN';
        winnerText.style.color = '#ff0000';
        winReason.textContent = 'Nisy namadika ny rehetra ho parasite!';
    } else {
        winnerText.textContent = 'SURVIVORS WIN';
        winnerText.style.color = '#00ff00';
        winReason.textContent = 'Misy tafavoaka velona!';
    }
    gameOverDiv.style.display = 'block';
});

socket.on('infected', (data) => {
    if(data.id === myId) {
        document.body.style.animation = 'glitch 0.3s';
        setTimeout(() => document.body.style.animation = '', 300);
        playSound('glitch');
    }
});

// UI Update
function updateUI() {
    let surv = Object.values(players).filter(p =>!p.infected).length;
    let inf = Object.values(players).filter(p => p.infected).length;
    document.getElementById('survCount').textContent = surv;
    document.getElementById('infCount').textContent = inf;

    if(players[myId]) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = players[myId].infected? 'INFECTED' : 'SURVIVOR';
        statusEl.style.color = players[myId].infected? '#ff0000' : '#00ff00';
    }
}

// Proximity heartbeat
function checkProximity() {
    if(!players[myId] || players[myId].infected) return;

    let nearInfected = false;
    for(let id in players) {
        if(players[id].infected && id!== myId) {
            let dx = players[id].x - players[myId].x;
            let dy = players[id].y - players[myId].y;
            if(Math.sqrt(dx*dx + dy*dy) < 150) {
                nearInfected = true;
                break;
            }
        }
    }

    if(nearInfected &&!heartbeatAudio) {
        // Azonao soloina URL feo tena izy eto
        // heartbeatAudio = new Audio('heartbeat.mp3');
        // heartbeatAudio.loop = true;
        // heartbeatAudio.play();
    } else if(!nearInfected && heartbeatAudio) {
        // heartbeatAudio.pause();
        heartbeatAudio = null;
    }
}

function playSound(type) {
    // Azonao ampiana feo eto: new Audio('glitch.mp3').play();
}

// Controls PC
window.addEventListener('keydown', e => {
    if(keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', e => {
    if(keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Controls Mobile Joystick
let joystickActive = false;
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

joystick.addEventListener('touchstart', e => {
    joystickActive = true;
    handleJoystick(e.touches[0]);
});

joystick.addEventListener('touchmove', e => {
    if(joystickActive) handleJoystick(e.touches[0]);
});

joystick.addEventListener('touchend', () => {
    joystickActive = false;
    stick.style.transform = 'translate(-50%, -50%)';
    keys.w = keys.a = keys.s = keys.d = false;
});

function handleJoystick(touch) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const centerY = rect.top + rect.height/2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let maxDist = rect.width/2 - 25;

    if(dist > maxDist) {
        dx = dx / dist * maxDist;
        dy = dy / dist * maxDist;
    }

    stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    keys.w = dy < -20;
    keys.s = dy > 20;
    keys.a = dx < -20;
    keys.d = dx > 20;
}

// Send movement
setInterval(() => {
    if(gameActive) socket.emit('move', keys);
}, 1000/30);

// Play Again button
document.getElementById('playAgain').onclick = () => {
    window.location.reload();
};

// Render Loop
function draw() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera follow
    if(players[myId]) {
        camera.x = players[myId].x - canvas.width/2;
        camera.y = players[myId].y - canvas.height/2;
    }

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Map background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, mapSize.w, mapSize.h);

    // Draw walls
    ctx.fillStyle = '#003300';
    walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Draw players
    Object.values(players).forEach(p => {
        ctx.save();

        if(p.infected) {
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 15;
            ctx.fillStyle = `rgb(255, ${Math.random()*50}, ${Math.random()*50})`;
        } else {
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#00ff00';
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI*2);
        ctx.fill();

        if(p.id === myId) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();
    });

    ctx.restore();

    // Fog vignette
    let gradient = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 100,
        canvas.width/2, canvas.height/2, canvas.width/1.3
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    requestAnimationFrame(draw);
}
draw();

// Resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});