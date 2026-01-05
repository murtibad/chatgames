// v0.9.5 JUICY UPDATE - app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("💎 JUICY MODE v0.9.5 INITIALIZED");

// === 1. DOM & CONFIG ===
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.error(`MISSING: #${id}`);
    return el;
};

const D = {
    video: getEl('videoElement'),
    canvas: getEl('canvasElement'),
    menu: getEl('menu-screen'),
    gameOver: getEl('game-over-screen'),
    leaderboard: getEl('leaderboard-screen'),
    scoreHud: getEl('score-hud'),
    scoreVal: getEl('score-val'),
    livesDisplay: getEl('lives-display'),
    overlay: getEl('countdown-overlay'),
    countText: getEl('countdown-text'),
    username: getEl('username-input'),
    saveMsg: getEl('save-msg'),
    saveBtn: getEl('btn-save'),
    muteBtn: getEl('mute-btn'),
    list: getEl('leaderboard-list')
};

const CONFIG = {
    apiKey: "AIzaSyBJqIfScXLNKWiaVylgKHlvuVbeT1rEOk8",
    authDomain: "chatgames-4b61b.firebaseapp.com",
    projectId: "chatgames-4b61b",
    storageBucket: "chatgames-4b61b.firebasestorage.app",
    messagingSenderId: "832676453422",
    appId: "1:832676453422:web:92fb35a2c7dbf73cad13bf"
};

let db;
try {
    const app = initializeApp(CONFIG);
    db = getFirestore(app);
} catch (e) {
    console.warn("Firebase Offline Mode");
}

// === 2. STATE & PHYSICS ===
const State = {
    active: false,
    score: 0,
    lives: 3,
    objects: [],
    particles: [], // For explosions
    lastSpawn: 0,
    muted: false,
    baseSpeed: 5,
    speedMultiplier: 1.0,
    lastNose: { x: 0, y: 0, distinct: false } // Face loss protection
};

// === 3. SOUND & FX ===
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioCtx();

const beep = (freq, type) => {
    if (State.muted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
};

// FX: Visual Feedback
const pulseHUD = () => {
    if (D.scoreVal) {
        D.scoreVal.classList.remove('pulse-animation');
        void D.scoreVal.offsetWidth; // Trigger reflow
        D.scoreVal.classList.add('pulse-animation');
    }
};

const flashDamage = () => {
    document.body.classList.add('damage-flash');
    setTimeout(() => document.body.classList.remove('damage-flash'), 300);
};

// === 4. CAMERA & MEDIAPIPE ===
let faceMesh, camera;

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        D.video.srcObject = stream;

        faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onResults);

        camera = new Camera(D.video, {
            onFrame: async () => { await faceMesh.send({ image: D.video }); },
            width: 1280, height: 720
        });
        camera.start();

        window.addEventListener('resize', resize);
        resize();
    } catch (e) {
        console.error(e);
        alert("Camera required for gameplay.");
    }
}

function resize() {
    D.canvas.width = window.innerWidth;
    D.canvas.height = window.innerHeight;
}

// === 5. GAME ENGINE (JUICY EDITION) ===
function onResults(results) {
    const ctx = D.canvas.getContext('2d');
    ctx.clearRect(0, 0, D.canvas.width, D.canvas.height);

    // 1. Face Tracking & Protection
    let nx, ny, faceWidth = 0;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const lm = results.multiFaceLandmarks[0];
        nx = lm[4].x * D.canvas.width;
        ny = lm[4].y * D.canvas.height;

        // Calculate Face Width for Cone Logic (Left Cheek 234 - Right Cheek 454)
        const leftX = lm[234].x * D.canvas.width;
        const rightX = lm[454].x * D.canvas.width;
        faceWidth = Math.abs(rightX - leftX) / D.canvas.width; // 0.0 to 1.0

        State.lastNose = { x: nx, y: ny, distinct: true };
    } else if (State.lastNose.distinct) {
        // Ghost Mode (Loss Protection)
        nx = State.lastNose.x;
        ny = State.lastNose.y;
        ctx.globalAlpha = 0.5; // Visual cue for tracking loss
    }

    // Draw Neon Nose with Glow
    if (nx !== undefined) {
        ctx.beginPath();
        ctx.arc(nx, ny, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2ea';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00f2ea';
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
        ctx.globalAlpha = 1.0;
    }

    if (State.active) {
        gameLoop(ctx, nx, ny, faceWidth);
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        State.particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: color
        });
    }
}

function gameLoop(ctx, nx, ny, faceWidth) {
    // A. Dynamic Spawner (Cone Logic)
    // Closer Face (High faceWidth) -> Narrower Spawn
    // Far Face (Low faceWidth) -> Wider Spawn
    let widthFactor = 1.0;
    if (faceWidth > 0) {
        // Clamp and Invert: Large Face = 0.4 spawn width, Small Face = 0.95
        widthFactor = Math.max(0.4, Math.min(0.95, 1.0 - (faceWidth * 1.5)));
    }

    if (performance.now() - State.lastSpawn > 1000 / State.speedMultiplier) {
        const safeZone = (1 - widthFactor) / 2;
        const randomX = (safeZone + Math.random() * widthFactor) * D.canvas.width;

        State.objects.push({
            x: randomX,
            y: -60,
            type: Math.random() > 0.35 ? 'good' : 'bad', // 65% Gems
            speed: (Math.random() * 2 + State.baseSpeed) * State.speedMultiplier
        });
        State.lastSpawn = performance.now();
    }

    // B. Object Physics & Logic
    for (let i = State.objects.length - 1; i >= 0; i--) {
        let o = State.objects[i];
        o.y += o.speed;

        // Draw Juicy Object
        ctx.shadowBlur = 25;
        ctx.shadowColor = o.type === 'good' ? '#00f2ea' : '#ff0050';
        ctx.fillStyle = "white";
        ctx.font = "32px Arial";
        ctx.fillText(o.type === 'good' ? '💎' : '💣', o.x, o.y);
        ctx.shadowBlur = 0;

        // Collision Detection
        if (nx && Math.hypot(nx - o.x, ny - o.y) < 40) {
            State.objects.splice(i, 1);
            if (o.type === 'good') {
                // Good Catch
                State.score += 10;
                // Progression
                if (State.score % 50 === 0) State.speedMultiplier += 0.1;

                beep(800 + (State.score), 'sine'); // Pitch rises
                pulseHUD();
                createExplosion(o.x, o.y, '#00f2ea');
            } else {
                // Bad Catch
                State.lives--;
                beep(150, 'sawtooth');
                flashDamage();
                createExplosion(o.x, o.y, '#ff0050');
                if (State.lives <= 0) endGame();
            }
            updateHud();
            continue;
        }

        // Missed Object Handling (Immortality Fix)
        if (o.y > D.canvas.height + 50) {
            if (o.type === 'good') {
                State.lives--; // Missed a gem!
                flashDamage();
                beep(100, 'square');
                if (State.lives <= 0) endGame();
            }
            State.objects.splice(i, 1);
            updateHud();
        }
    }

    // C. Particle Physics
    for (let i = State.particles.length - 1; i >= 0; i--) {
        let p = State.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;

        if (p.life <= 0) {
            State.particles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
}

function updateHud() {
    D.scoreVal.innerText = State.score;
    D.livesDisplay.innerText = "❤️".repeat(Math.max(0, State.lives));
}

// === 6. FLOW CONTROL ===

window.startGame = function () {
    D.menu.classList.add('hidden');
    D.gameOver.classList.add('hidden');
    D.scoreHud.classList.remove('hidden');

    State.score = 0;
    State.lives = 3;
    State.objects = [];
    State.particles = [];
    State.active = false;
    State.speedMultiplier = 1.0;
    State.lastNose = { x: 0, y: 0, distinct: false };

    updateHud();
    showCountdown();

    // Watchdog
    setTimeout(() => {
        if (!State.active && D.menu.classList.contains('hidden')) {
            D.overlay.classList.add('hidden');
            State.active = true;
            State.lastSpawn = performance.now();
        }
    }, 4500);
}

function showCountdown() {
    D.overlay.classList.remove('hidden');
    let n = 3;
    D.countText.innerText = n;

    const iv = setInterval(() => {
        n--;
        if (n > 0) D.countText.innerText = n;
        else if (n === 0) D.countText.innerText = "GO!";
        else {
            clearInterval(iv);
            D.overlay.classList.add('hidden');
            State.active = true;
            State.lastSpawn = performance.now();
        }
    }, 1000);
}

function endGame() {
    State.active = false;
    D.scoreHud.classList.add('hidden');
    D.gameOver.classList.remove('hidden');
    document.getElementById('final-score').innerText = State.score;

    D.saveBtn.disabled = false;
    D.saveMsg.innerText = "";
    D.username.value = "";
}

// === 7. ACTIONS ===
window.restartGame = () => window.startGame();

window.goHome = () => {
    D.gameOver.classList.add('hidden');
    D.menu.classList.remove('hidden');
    D.scoreHud.classList.remove('hidden'); // Optional
}

D.saveBtn.addEventListener('click', async () => {
    const name = D.username.value.trim() || 'Anonymous';
    D.saveBtn.disabled = true;
    D.saveBtn.innerText = "SAVING...";

    try {
        await addDoc(collection(db, 'scores'), {
            name: name, score: State.score, date: new Date()
        });
        D.saveMsg.innerText = "SAVED!";
        D.saveMsg.style.color = "#00f2ea";
    } catch (e) {
        D.saveMsg.innerText = "ERROR";
        D.saveMsg.style.color = "red";
        D.saveBtn.disabled = false;
    }
});

// Start
initCamera();
