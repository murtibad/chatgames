// v0.9.4 PHOENIX PROTOCOL - app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("🔥 Phoenix Protocol Initiated...");

// === 1. DEFENSIVE DOM SELECTION ===
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.error(`CRITICAL: #${id} missing from HTML!`);
    return el;
};

const D = {
    video: getEl('videoElement'),
    canvas: getEl('canvasElement'),
    // Screens
    menu: getEl('menu-screen'),
    gameOver: getEl('game-over-screen'),
    leaderboard: getEl('leaderboard-screen'),
    // HUD
    scoreHud: getEl('score-hud'),
    scoreVal: getEl('score-val'),
    livesDisplay: getEl('lives-display'),
    // Overlay
    overlay: getEl('countdown-overlay'),
    countText: getEl('countdown-text'),
    // Inputs
    username: getEl('username-input'),
    saveMsg: getEl('save-msg'),
    saveBtn: getEl('btn-save'),
    muteBtn: getEl('mute-btn'),
    list: getEl('leaderboard-list')
};

// === 2. CONFIG & STATE ===
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
    console.warn("Firebase Offline:", e);
}

const State = {
    active: false,
    score: 0,
    lives: 3,
    objects: [],
    lastSpawn: 0,
    muted: false,
    speed: 5
};

// === 3. SOUND SYSTEM (Synthesized) ===
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioCtx();

const beep = (freq = 600, type = 'sine') => {
    if (State.muted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
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

        // MediaPipe
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
        console.error("Cam Check Failed:", e);
        alert("Camera Access Denied. Please enable it.");
    }
}

function resize() {
    D.canvas.width = window.innerWidth;
    D.canvas.height = window.innerHeight;
}

// === 5. GAME ENGINE ===
function onResults(results) {
    const ctx = D.canvas.getContext('2d');
    ctx.clearRect(0, 0, D.canvas.width, D.canvas.height);

    let nx, ny; // Nose Coords

    // Draw Face/Nose
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const lm = results.multiFaceLandmarks[0];
        nx = lm[4].x * D.canvas.width;
        ny = lm[4].y * D.canvas.height;

        // Neon Nose Dot
        ctx.beginPath();
        ctx.arc(nx, ny, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2ea';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2ea';
        ctx.fill();
    }

    if (State.active) {
        gameLoop(ctx, nx, ny);
    }
}

function gameLoop(ctx, nx, ny) {
    // Spawn Logic
    if (performance.now() - State.lastSpawn > 1000) {
        State.objects.push({
            x: Math.random() * (D.canvas.width - 40) + 20,
            y: -50,
            type: Math.random() > 0.3 ? 'good' : 'bad' // 70% Good
        });
        State.lastSpawn = performance.now();
    }

    // Object Logic
    State.objects.forEach((o, i) => {
        o.y += State.speed;

        // Draw
        ctx.beginPath();
        ctx.textAlign = "center";

        // Glow Effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = o.type === 'good' ? '#00f2ea' : '#ff0050';

        ctx.font = "30px Arial";
        ctx.fillText(o.type === 'good' ? '💎' : '💣', o.x, o.y);
        ctx.shadowBlur = 0; // Reset

        // Collision
        if (nx && Math.hypot(nx - o.x, ny - o.y) < 30) {
            State.objects.splice(i, 1);
            if (o.type === 'good') {
                State.score += 10;
                beep(800, 'sine');
            } else {
                State.lives--;
                beep(150, 'sawtooth');
                if (State.lives <= 0) endGame();
            }
            updateHud();
        }

        // Cleanup
        if (o.y > D.canvas.height) State.objects.splice(i, 1);
    });
}

function updateHud() {
    D.scoreVal.innerText = State.score;
    let hearts = "";
    for (let i = 0; i < State.lives; i++) hearts += "❤️";
    D.livesDisplay.innerText = hearts;
}

// === 6. FLOW CONTROL (CRITICAL) ===

window.startGame = function () {
    // 1. Hide Menu
    if (D.menu) D.menu.classList.add('hidden');
    if (D.gameOver) D.gameOver.classList.add('hidden');
    if (D.scoreHud) D.scoreHud.classList.remove('hidden');

    // 2. Reset Logic
    State.score = 0;
    State.lives = 3;
    State.objects = [];
    State.active = false;
    updateHud();

    // 3. Start Sequence
    showCountdown();

    // 4. WATCHDOG (Safety Net)
    setTimeout(() => {
        if (!State.active && D.menu.classList.contains('hidden')) {
            console.warn("Watchdog: Forcing Game Start!");
            D.overlay.classList.add('hidden');
            State.active = true;
            State.lastSpawn = performance.now();
        }
    }, 4500);
}

function showCountdown() {
    D.overlay.classList.remove('hidden');
    D.countText.innerText = "3";
    let n = 3;

    const iv = setInterval(() => {
        n--;
        if (n > 0) {
            D.countText.innerText = n;
        } else if (n === 0) {
            D.countText.innerText = "GO!";
        } else {
            clearInterval(iv);
            D.overlay.classList.add('hidden'); // CRITICAL: Hide Overlay
            State.active = true; // START ENGINE
            State.lastSpawn = performance.now();
        }
    }, 1000);
}

function endGame() {
    State.active = false;
    D.scoreHud.classList.add('hidden');
    D.gameOver.classList.remove('hidden');
    document.getElementById('final-score').innerText = State.score;

    // Reset Save UI
    D.saveBtn.disabled = false;
    D.saveMsg.innerText = "";
    D.username.value = "";

    beep(100, 'square');
    setTimeout(() => beep(80, 'square'), 200);
}

// === 7. BINDINGS & ACTIONS ===

window.restartGame = function () {
    window.startGame();
}

window.goHome = function () {
    D.gameOver.classList.add('hidden');
    D.menu.classList.remove('hidden');
    D.scoreHud.classList.remove('hidden');
}

// Global Mute Toggle
D.muteBtn.addEventListener('click', () => {
    State.muted = !State.muted;
    D.muteBtn.style.opacity = State.muted ? 0.5 : 1;
});

// Save Function with Error Handling
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
        console.error("Save Error:", e);
        D.saveMsg.innerText = "ERROR SAVING";
        D.saveMsg.style.color = "#ff0050";
        alert("Database connection failed. Please try again.");
        D.saveBtn.disabled = false;
    }
});

D.list.addEventListener('click', () => {
    // Placeholder logic for share
});

// Leaderboard Logic
const openStats = document.getElementById('btn-leaderboard');
const closeStats = document.querySelector('#leaderboard-screen button');

if (openStats) openStats.onclick = async () => {
    D.menu.classList.add('hidden');
    D.leaderboard.classList.remove('hidden');
    D.list.innerHTML = "Loading...";

    try {
        const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(10));
        const snap = await getDocs(q);
        D.list.innerHTML = "";

        snap.forEach(doc => {
            const d = doc.data();
            D.list.innerHTML += `<div style="display:flex; justify-content:space-between; margin:10px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding:5px;">
                <span>${d.name}</span> <span style="color:#00f2ea">${d.score}</span>
            </div>`;
        });
    } catch (e) {
        D.list.innerHTML = "Leaderboard Offline.";
    }
};

window.closeLeaderboard = function () {
    D.leaderboard.classList.add('hidden');
    D.menu.classList.remove('hidden');
}

// === STARTUP ===
initCamera();
console.log("PHOENIX PROTOCOL ACTIVE v0.9.4");
