// v0.9.5 JUICY UPDATE - app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("💎 JUICY MODE v0.9.5 INITIALIZED (REFINED)");

// --- 1. FIREBASE CONFIG ---
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
    console.log("Firebase initialized.");
} catch (e) {
    console.warn("Firebase Offline Mode:", e);
}

// --- 2. DOM & UTILS ---
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`Missing: #${id}`);
    return el;
};

const D = {
    video: getEl('videoElement'),
    canvas: getEl('canvasElement'),
    uiLayer: getEl('ui-layer'),
    menu: getEl('menu-screen'),
    gameOver: getEl('game-over-screen'),
    leaderboard: getEl('leaderboard-screen'),
    scoreHud: getEl('score-hud'),
    scoreVal: getEl('score-val'),
    livesDisplay: document.getElementById('lives-display') || { innerText: '' }, // Fail-safe
    overlay: getEl('countdown-overlay'),
    countText: getEl('countdown-text'),
    username: getEl('username-input'),
    saveMsg: getEl('save-msg'),
    saveBtn: getEl('btn-save'),
    muteBtn: getEl('mute-btn'),
    list: getEl('leaderboard-list')
};

// --- 3. GAME STATE ---
const gameState = {
    isGameActive: false,
    score: 0,
    lives: 3,
    speedMultiplier: 1.0,
    lastSpawnTime: 0,
    spawnInterval: 1200,
    fallingObjects: [],
    particles: [],
    noseX: 0.5,
    noseY: 0.5,
    faceScale: 0.1,
    lastKnownNose: { x: 0, y: 0 },
    muted: false
};

// --- 4. CLASSES ---

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 2;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.95;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class FallingObject {
    constructor(w, h, type, speedMult, spawnWidthRatio) {
        this.type = type; // 'gem' or 'bomb'
        this.radius = 25;

        // --- CONE LOGIC ---
        // Range depends on face distance (faceScale)
        const range = w * spawnWidthRatio;
        const minX = (w - range) / 2;
        this.x = minX + Math.random() * range;

        this.y = -50;
        this.speed = (Math.random() * 3 + 4) * speedMult;

        this.color = type === 'gem' ? '#00f2ea' : '#ff0050';
        this.glowColor = type === 'gem' ? 'rgba(0, 242, 234, 0.6)' : 'rgba(255, 0, 80, 0.6)';
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.glowColor;
        ctx.fillStyle = this.color;
        ctx.beginPath();

        if (this.type === 'gem') {
            // Diamond Shape
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y);
            ctx.lineTo(this.x, this.y + this.radius);
            ctx.lineTo(this.x - this.radius, this.y);
        } else {
            // Bomb Shape
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            if (Math.floor(Date.now() / 100) % 2 === 0) {
                ctx.fillStyle = '#ffcccc'; // Blink
            }
        }
        ctx.fill();

        // Emoji Overlay
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.type === 'gem' ? "💎" : "💣", this.x, this.y);

        ctx.restore();
    }
}

// --- 5. AUDIO & FX ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioCtx();

const beep = (freq, type = 'sine') => {
    if (gameState.muted) return;
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

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}

function updateUI() {
    if (D.scoreVal) D.scoreVal.innerText = gameState.score;

    if (D.livesDisplay) {
        D.livesDisplay.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            D.livesDisplay.innerHTML += i < gameState.lives ? '❤️' : '🖤';
        }
    }
}

function triggerVisualEffect(type) {
    if (type === 'score') {
        const hud = D.scoreHud;
        hud.classList.remove('score-pulse-anim');
        void hud.offsetWidth;
        hud.classList.add('score-pulse-anim');
    } else if (type === 'damage') {
        D.uiLayer.classList.remove('damage-effect');
        void D.uiLayer.offsetWidth;
        D.uiLayer.classList.add('damage-effect');

        D.livesDisplay.classList.add('hearts-shake');
        setTimeout(() => D.livesDisplay.classList.remove('hearts-shake'), 300);
    }
}

// --- 6. FLOW CONTROL ---

window.startGame = function () {
    D.menu.classList.add('hidden');
    D.gameOver.classList.add('hidden');
    D.scoreHud.classList.remove('hidden'); // Ensure HUD is visible

    // Reset
    gameState.score = 0;
    gameState.lives = 3;
    gameState.speedMultiplier = 1.0;
    gameState.fallingObjects = [];
    gameState.particles = [];
    gameState.isGameActive = false;

    updateUI();
    showCountdown();

    // Watchdog
    setTimeout(() => {
        if (!gameState.isGameActive && D.overlay.style.display !== 'none') {
            console.log("Watchdog: Forced Start");
            D.overlay.style.display = 'none';
            gameState.isGameActive = true;
            gameLoop();
        }
    }, 4500);
}

function showCountdown() {
    D.overlay.style.display = 'flex';
    D.overlay.classList.remove('hidden');
    let count = 3;
    D.countText.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            D.countText.innerText = count;
        } else if (count === 0) {
            D.countText.innerText = "GO!";
            beep(1200, 'square');
        } else {
            clearInterval(timer);
            D.overlay.style.display = 'none';
            gameState.isGameActive = true;
            gameState.lastSpawnTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }, 1000);
}

function endGame() {
    gameState.isGameActive = false;
    D.scoreHud.classList.add('hidden'); // Hide HUD on Game Over? User prompt said keep screens in UI layer.
    // Actually user prompt didn't say hide HUD but standard flow usually masks it.
    // Let's keep it consistent with previous logic.
    D.gameOver.classList.remove('hidden');
    document.getElementById('final-score').innerText = gameState.score;

    D.saveBtn.disabled = false;
    D.saveMsg.innerText = "";
    D.username.value = "";
    beep(150, 'sawtooth');
}

// --- 7. GAME LOOP ---

function gameLoop() {
    if (!gameState.isGameActive) return;

    const ctx = D.canvas.getContext('2d');
    ctx.clearRect(0, 0, D.canvas.width, D.canvas.height);

    // 1. Draw Nose (Last Known)
    const noseXPx = gameState.lastKnownNose.x;
    const noseYPx = gameState.lastKnownNose.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(noseXPx, noseYPx, 10, 0, 2 * Math.PI);
    ctx.fillStyle = "#00f2ea";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00f2ea";
    ctx.fill();
    ctx.restore();

    // 2. Logic & Spawning
    const now = performance.now();

    // Speed Progression
    const speedLevel = 1.0 + Math.floor(gameState.score / 50) * 0.1;
    gameState.speedMultiplier = speedLevel;

    // Cone Logic
    // Safe Width Ratio: 1.0 - FaceScale. 
    // FaceScale 0.1 (Far) -> Ratio 0.9 (Wide)
    // FaceScale 0.4 (Close) -> Ratio 0.6 (Narrower)
    let safeWidthRatio = 1.0 - gameState.faceScale;
    if (safeWidthRatio < 0.4) safeWidthRatio = 0.4;
    if (safeWidthRatio > 0.95) safeWidthRatio = 0.95;

    const currentInterval = gameState.spawnInterval / speedLevel;

    if (now - gameState.lastSpawnTime > currentInterval) {
        const type = Math.random() > 0.25 ? 'gem' : 'bomb';
        const obj = new FallingObject(D.canvas.width, D.canvas.height, type, gameState.speedMultiplier, safeWidthRatio);
        gameState.fallingObjects.push(obj);
        gameState.lastSpawnTime = now;
    }

    // 3. Updates & Collision
    for (let i = gameState.fallingObjects.length - 1; i >= 0; i--) {
        const obj = gameState.fallingObjects[i];
        obj.update();
        obj.draw(ctx);

        const dx = obj.x - noseXPx;
        const dy = obj.y - noseYPx;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Hit
        if (distance < (obj.radius + 15)) {
            gameState.fallingObjects.splice(i, 1);
            if (obj.type === 'gem') {
                gameState.score += 10;
                triggerVisualEffect('score');
                createExplosion(obj.x, obj.y, '#00f2ea');
                beep(600 + (gameState.score), 'sine');
            } else {
                gameState.lives--;
                triggerVisualEffect('damage');
                createExplosion(obj.x, obj.y, '#ff0050');
                beep(150, 'sawtooth');
            }
            updateUI();
            if (gameState.lives <= 0) { endGame(); return; }
            continue;
        }

        // Miss check
        if (obj.y > D.canvas.height) {
            // Fix Immortality: Missing a gem hurts
            if (obj.type === 'gem') {
                gameState.lives--;
                triggerVisualEffect('damage');
                beep(100, 'square');
            }
            gameState.fallingObjects.splice(i, 1);
            updateUI();
            if (gameState.lives <= 0) { endGame(); return; }
        }
    }

    // 4. Particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.update();
        p.draw(ctx);
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

// --- 8. MEDIAPIPE ---
function onResults(results) {
    if (D.canvas.width !== window.innerWidth) {
        D.canvas.width = window.innerWidth;
        D.canvas.height = window.innerHeight;
    }

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[4];

        // Mirror X
        gameState.noseX = 1 - nose.x;
        gameState.noseY = nose.y;

        gameState.lastKnownNose.x = gameState.noseX * D.canvas.width;
        gameState.lastKnownNose.y = gameState.noseY * D.canvas.height;

        // Face Scale (Cheek to Cheek)
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        const dx = (1 - leftCheek.x) - (1 - rightCheek.x);
        gameState.faceScale = Math.abs(dx);
    }
}

// Init MediaPipe
let faceMesh, camera;
async function initSystem() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false });
        D.video.srcObject = stream;

        faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onResults);

        camera = new Camera(D.video, {
            onFrame: async () => { await faceMesh.send({ image: D.video }); },
            width: 1280, height: 720
        });
        camera.start();

    } catch (e) {
        console.error("Camera Init Error:", e);
        alert("Camera required!");
    }
}

// --- 9. BINDINGS ---
window.restartGame = window.startGame;
window.returnToMenu = () => { /* ... */ };
window.goHome = () => {
    D.gameOver.classList.add('hidden');
    D.menu.classList.remove('hidden');
};

D.muteBtn.onclick = () => {
    gameState.muted = !gameState.muted;
    D.muteBtn.style.opacity = gameState.muted ? 0.5 : 1.0;
};

D.saveBtn.onclick = async () => {
    const name = D.username.value.trim() || 'Anonymous';
    D.saveBtn.innerText = "SAVING...";
    try {
        await addDoc(collection(db, 'scores'), { name: name, score: gameState.score, date: new Date() });
        D.saveBtn.innerText = "SAVED!";
    } catch (e) {
        D.saveBtn.innerText = "ERROR";
    }
};

initSystem();
