// v0.9.3 CLEAN SLATE - app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === 1. DEFENSIVE DOM SELECTION ===
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.error(`MISSING ELEMENT: #${id}`);
    return el;
};

const D = {
    video: getEl('videoElement'),
    canvas: getEl('canvasElement'),
    uiLayer: getEl('ui-layer'), // Wrapper
    menuScreen: getEl('menu-screen'),
    gameScreen: getEl('game-screen'),
    gameOverScreen: getEl('game-over-screen'),
    scoreHud: getEl('score-hud'),
    scoreVal: getEl('score-val'),
    livesVal: getEl('lives-val'),
    finalScore: getEl('final-score'),
    countdownOverlay: getEl('countdown-overlay'),
    countdownText: getEl('countdown-text'),
    // Inputs/Btns
    muteBtn: getEl('mute-btn'),
    btnStart: getEl('btn-start'),
    usernameInput: getEl('username-input'),
    btnSave: getEl('btn-save'),
    saveMsg: getEl('save-msg'),
    btnShare: getEl('btn-share'),
    btnRestart: getEl('btn-restart')
};

// === 2. CONFIG & STATE ===
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBJqIfScXLNKWiaVylgKHlvuVbeT1rEOk8",
    authDomain: "chatgames-4b61b.firebaseapp.com",
    projectId: "chatgames-4b61b",
    storageBucket: "chatgames-4b61b.firebasestorage.app",
    messagingSenderId: "832676453422",
    appId: "1:832676453422:web:92fb35a2c7dbf73cad13bf"
};

let db;
try {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Init Fail:", e);
}

const State = {
    active: false,
    score: 0,
    lives: 3,
    objects: [],
    lastSpawn: 0,
    muted: false
};

// === 3. SOUND SYSTEM ===
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx = new AudioCtx();

const playSound = (type) => {
    if (State.muted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'score') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'damage') {
        osc.frequency.setValueAtTime(150, now);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
};

// === 4. CAMERA & MEDIAPIPE ===
let faceMesh;
let camera;

async function initSystem() {
    if (D.btnStart) D.btnStart.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 1280, height: 720 },
            audio: false
        });
        D.video.srcObject = stream;
        await D.video.play();

        // MediaPipe
        faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onResults);

        camera = new Camera(D.video, {
            onFrame: async () => { await faceMesh.send({ image: D.video }); },
            width: 1280, height: 720
        });
        camera.start();

        // Bind Resize
        window.addEventListener('resize', resize);
        resize();

        startCountdown();

    } catch (e) {
        console.error("Camera/MP Error:", e);
        alert("Camera start failed.");
    }
}

function resize() {
    if (D.canvas) {
        D.canvas.width = window.innerWidth;
        D.canvas.height = window.innerHeight;
    }
}

// === 5. GAME LOGIC ===
function onResults(results) {
    const cvs = D.canvas;
    const cx = cvs.getContext('2d');
    cx.clearRect(0, 0, cvs.width, cvs.height);

    let nx, ny; // Nose coords

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const lm = results.multiFaceLandmarks[0];
        nx = lm[4].x * cvs.width;
        ny = lm[4].y * cvs.height;

        // Draw Player
        cx.beginPath();
        cx.arc(nx, ny, 15, 0, Math.PI * 2);
        cx.fillStyle = '#00f2ea';
        cx.shadowBlur = 15;
        cx.shadowColor = '#00f2ea';
        cx.fill();
    }

    if (State.active) {
        gameLoop(cx, nx, ny);
    }
}

function gameLoop(cx, nx, ny) {
    // Spawn
    if (performance.now() - State.lastSpawn > 1000) {
        State.objects.push({
            x: Math.random() * (cx.width - 50) + 25,
            y: -50,
            type: Math.random() > 0.3 ? 'good' : 'bad'
        });
        State.lastSpawn = performance.now();
    }

    // Update
    State.objects.forEach((o, i) => {
        o.y += 5; // Speed

        // Draw
        cx.beginPath();
        cx.arc(o.x, o.y, 20, 0, Math.PI * 2);
        cx.fillStyle = o.type === 'good' ? '#00f2ea' : '#ff0050';
        cx.fill();
        cx.fillStyle = 'white';
        cx.font = '20px Arial';
        cx.textAlign = 'center';
        cx.fillText(o.type === 'good' ? '💎' : '💣', o.x, o.y + 5);

        // Collision
        if (nx && Math.hypot(nx - o.x, ny - o.y) < 35) {
            State.objects.splice(i, 1);
            if (o.type === 'good') {
                State.score += 10;
                playSound('score');
            } else {
                State.lives--;
                playSound('damage');
                if (State.lives <= 0) endGame();
            }
            updateHud();
        }

        // Offscreen
        if (o.y > cx.height) State.objects.splice(i, 1);
    });
}

function updateHud() {
    if (D.scoreVal) D.scoreVal.innerText = State.score;
    if (D.livesVal) D.livesVal.innerText = State.lives;
}

// === 6. FLOW CONTROL ===
function startCountdown() {
    // UI Switch
    if (D.menuScreen) D.menuScreen.classList.add('hidden');
    if (D.gameOverScreen) D.gameOverScreen.classList.add('hidden');
    if (D.scoreHud) D.scoreHud.classList.remove('hidden');
    if (D.countdownOverlay) D.countdownOverlay.classList.remove('hidden');

    let n = 3;
    if (D.countdownText) D.countdownText.innerText = n;

    let iv = setInterval(() => {
        n--;
        if (n > 0) D.countdownText.innerText = n;
        else if (n === 0) D.countdownText.innerText = "GO!";
        else {
            clearInterval(iv);
            if (D.countdownOverlay) D.countdownOverlay.classList.add('hidden');
            State.active = true;
            State.score = 0;
            State.lives = 3;
            State.objects = [];
            updateHud();
        }
    }, 1000);
}

function endGame() {
    State.active = false;
    if (D.scoreHud) D.scoreHud.classList.add('hidden');
    if (D.gameOverScreen) D.gameOverScreen.classList.remove('hidden');
    if (D.finalScore) D.finalScore.innerText = State.score;
    if (D.saveMsg) D.saveMsg.innerText = "";
    if (D.btnSave) D.btnSave.disabled = false;
}

// === 7. ACTIONS ===
if (D.btnStart) D.btnStart.addEventListener('click', initSystem);

if (D.btnRestart) D.btnRestart.addEventListener('click', startCountdown);

if (D.btnSave) D.btnSave.addEventListener('click', async () => {
    const name = D.usernameInput.value;
    if (!name) { alert("Enter name!"); return; }

    D.btnSave.disabled = true;
    D.btnSave.innerText = "SAVING...";

    try {
        await addDoc(collection(db, "scores"), {
            name: name,
            score: State.score,
            date: new Date()
        });
        D.saveMsg.innerText = "SAVED!";
        D.saveMsg.style.color = "#00f2ea";
    } catch (e) {
        console.error(e);
        D.saveMsg.innerText = "ERROR!";
        D.saveMsg.style.color = "red";
    }
});

if (D.btnShare) D.btnShare.addEventListener('click', async () => {
    const txt = `Scored ${State.score} in ChatGames!`;
    try {
        if (navigator.share) await navigator.share({ title: 'ChatGames', text: txt });
        else {
            await navigator.clipboard.writeText(txt);
            alert("Copied to clipboard!");
        }
    } catch (e) { console.log("Share cancel"); }
});

if (D.muteBtn) D.muteBtn.addEventListener('click', () => {
    State.muted = !State.muted;
    D.muteBtn.style.opacity = State.muted ? "0.5" : "1";
});

console.log("APP v0.9.3 LOADED (CLEAN SLATE)");
