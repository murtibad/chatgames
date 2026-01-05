/**
 * v0.9.3 REFRACTOR - app.js
 * "The Great Refactor"
 * Clean, Robust, Defensive Implementation
 */

// 1. IMPORTS & CONFIG
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBJqIfScXLNKWiaVylgKHlvuVbeT1rEOk8",
    authDomain: "chatgames-4b61b.firebaseapp.com",
    projectId: "chatgames-4b61b",
    storageBucket: "chatgames-4b61b.firebasestorage.app",
    messagingSenderId: "832676453422",
    appId: "1:832676453422:web:92fb35a2c7dbf73cad13bf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. DOM SELECTION (STRICT & DEFENSIVE)
const DOM = {
    // Screens
    menuScreen: document.getElementById('menu-screen'),
    gameScreen: document.getElementById('game-screen'),
    leaderboardScreen: document.getElementById('leaderboard-screen'),

    // Core Elements
    videoElement: document.getElementById('videoElement'),
    canvasElement: document.getElementById('canvasElement'),

    // Buttons
    muteBtn: document.getElementById('mute-btn'),
    btnStartGame: document.getElementById('btn-start-game'),
    btnOpenLeaderboard: document.getElementById('btn-open-leaderboard'),
    btnCloseLeaderboard: document.getElementById('btn-close-leaderboard'),
    btnSaveScore: document.getElementById('btn-save-score'),
    btnShareScore: document.getElementById('btn-share-score'),
    btnRestartGame: document.getElementById('btn-restart-game'),
    btnHome: document.getElementById('btn-home'),

    // HUD & Overlays
    scoreValue: document.getElementById('score-value'),
    livesDisplay: document.getElementById('lives-display'),
    countdownOverlay: document.getElementById('countdown-overlay'),
    countdownText: document.getElementById('countdown-text'),
    gameOverModal: document.getElementById('game-over-modal'),
    finalScoreValue: document.getElementById('final-score-value'),
    usernameInput: document.getElementById('username-input'),
    saveMessage: document.getElementById('save-message'),
    leaderboardList: document.getElementById('leaderboard-list')
};

// Validate DOM - Halt if critical elements missing
Object.entries(DOM).forEach(([key, element]) => {
    if (!element) console.error(`CRITICAL: DOM Element '${key}' not found! Check HTML IDs.`);
});

// 3. STATE MANAGEMENT
const GameState = {
    isActive: false,
    score: 0,
    lives: 3,
    maxLives: 3,
    fallingObjects: [],
    lastSpawnTime: 0,
    spawnInterval: 1000,
    speedMultiplier: 1.0,
    isStreamReady: false,
    animationFrameId: null
};

// 4. SOUND MANAGER
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.muted = false;
    }

    playTone(freq, duration, type = 'sine') {
        if (this.muted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playScore() { this.playTone(880, 0.1, 'sine'); } // A5
    playDamage() { this.playTone(150, 0.3, 'sawtooth'); } // Low buzz
    playGameOver() {
        this.playTone(300, 0.5, 'triangle');
        setTimeout(() => this.playTone(250, 0.5, 'triangle'), 400);
    }
}
const soundManager = new SoundManager();

// 5. CAMERA & MEDIAPIPE SETUP
let faceMesh;
let camera;

async function initCamera() {
    if (DOM.btnStartGame) DOM.btnStartGame.innerText = "Loading Camera...";
    if (DOM.btnStartGame) DOM.btnStartGame.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });

        DOM.videoElement.srcObject = stream;
        await new Promise(resolve => DOM.videoElement.onloadedmetadata = resolve);

        GameState.isStreamReady = true;

        // Initialize MediaPipe
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onFaceResults);

        camera = new Camera(DOM.videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: DOM.videoElement });
            },
            width: 1280,
            height: 720
        });

        camera.start();

        // Setup resizing
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Start Flow
        startCountdown();

    } catch (error) {
        console.error("Camera Init Error:", error);
        alert("Camera access denied or error. Please allow camera permissions.");
        resetUI();
    }
}

function resizeCanvas() {
    DOM.canvasElement.width = window.innerWidth;
    DOM.canvasElement.height = window.innerHeight;
}

// 6. GAME LOOP & LOGIC
function onFaceResults(results) {
    // Clear canvas
    const ctx = DOM.canvasElement.getContext('2d');
    ctx.clearRect(0, 0, DOM.canvasElement.width, DOM.canvasElement.height);

    // Draw Nose Tracking
    let noseX = null, noseY = null;
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        // Nose tip is index 4
        noseX = landmarks[4].x * DOM.canvasElement.width;
        noseY = landmarks[4].y * DOM.canvasElement.height;

        // Draw Dot
        ctx.beginPath();
        ctx.arc(noseX, noseY, 15, 0, 2 * Math.PI);
        ctx.fillStyle = "#00f2ea";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00f2ea";
        ctx.fill();
    }

    if (GameState.isActive) {
        updateGame(ctx, noseX, noseY);
    }
}

function updateGame(ctx, noseX, noseY) {
    // Spawn Objects
    if (performance.now() - GameState.lastSpawnTime > GameState.spawnInterval) {
        spawnObject();
        GameState.lastSpawnTime = performance.now();
    }

    // Update & Draw Objects
    GameState.fallingObjects.forEach((obj, index) => {
        obj.y += obj.speed * GameState.speedMultiplier;

        // Draw Object
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, 2 * Math.PI);
        ctx.fillStyle = obj.type === 'bad' ? '#ff0050' : '#00f2ea';
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();

        // Add icon/emoji inside
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(obj.type === 'bad' ? "💣" : "💎", obj.x, obj.y);

        // Collision
        if (noseX && Math.hypot(noseX - obj.x, noseY - obj.y) < obj.radius + 15) {
            handleCollision(index, obj.type);
        }

        // Remove Off-screen
        if (obj.y > DOM.canvasElement.height) {
            GameState.fallingObjects.splice(index, 1);
        }
    });
}

function spawnObject() {
    const type = Math.random() > 0.3 ? 'good' : 'bad';
    GameState.fallingObjects.push({
        x: Math.random() * (DOM.canvasElement.width - 50) + 25,
        y: -50,
        radius: 25,
        type: type,
        speed: Math.random() * 3 + 2
    });
}

function handleCollision(index, type) {
    GameState.fallingObjects.splice(index, 1);

    if (type === 'good') {
        GameState.score += 10;
        soundManager.playScore();
        updateHUD();

        // Increase difficulty
        if (GameState.score % 50 === 0) {
            GameState.speedMultiplier += 0.1;
            GameState.spawnInterval = Math.max(400, GameState.spawnInterval - 50);
        }
    } else {
        GameState.lives--;
        soundManager.playDamage();
        updateHUD();
        if (GameState.lives <= 0) endGame();
    }
}

function updateHUD() {
    DOM.scoreValue.textContent = GameState.score;
    // Update Hearts
    const hearts = DOM.livesDisplay.children;
    for (let i = 0; i < 3; i++) {
        hearts[i].style.opacity = i < GameState.lives ? "1" : "0.2";
    }
}

// 7. FLOW CONTROL FUNCTIONS
function startCountdown() {
    // Hide all menus, show game screen
    DOM.menuScreen.classList.add('hidden');
    DOM.gameOverModal.classList.add('hidden');
    DOM.leaderboardScreen.classList.add('hidden');
    DOM.gameScreen.classList.remove('hidden');

    DOM.countdownOverlay.classList.remove('hidden');
    DOM.countdownText.textContent = "3";

    let count = 3;
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            DOM.countdownText.textContent = count;
        } else if (count === 0) {
            DOM.countdownText.textContent = "GO!";
        } else {
            clearInterval(interval);
            DOM.countdownOverlay.classList.add('hidden');
            GameState.isActive = true;
            GameState.lastSpawnTime = performance.now();
        }
    }, 1000);
}

function endGame() {
    GameState.isActive = false;
    soundManager.playGameOver();

    DOM.finalScoreValue.textContent = GameState.score;
    DOM.gameOverModal.classList.remove('hidden');

    // Reset inputs
    if (DOM.saveScoreBtn) DOM.saveScoreBtn.disabled = false;
    if (DOM.saveMessage) DOM.saveMessage.textContent = "";
}

function resetGame() {
    GameState.score = 0;
    GameState.lives = GameState.maxLives;
    GameState.fallingObjects = [];
    GameState.speedMultiplier = 1.0;
    updateHUD();
    startCountdown();
}

function resetUI() {
    DOM.menuScreen.classList.remove('hidden');
    DOM.gameScreen.classList.add('hidden');
    DOM.leaderboardScreen.classList.add('hidden');
    DOM.gameOverModal.classList.add('hidden');

    if (DOM.btnStartGame) {
        DOM.btnStartGame.innerText = "PLAY NOW";
        DOM.btnStartGame.disabled = false;
    }
}

// 8. FIREBASE LEADERBOARD ACTIONS
async function saveScore() {
    const username = DOM.usernameInput.value.trim();
    if (!username) {
        alert("Please enter a name!");
        return;
    }

    DOM.btnSaveScore.disabled = true;
    DOM.btnSaveScore.innerText = "Saving...";

    try {
        await addDoc(collection(db, "scores"), {
            username: username,
            score: GameState.score,
            timestamp: new Date()
        });
        DOM.saveMessage.textContent = "Saved Successfully!";
        DOM.saveMessage.style.color = "#00f2ea";
    } catch (e) {
        console.warn("Firestore Error:", e);
        DOM.saveMessage.textContent = "Error Saving (Check Console)";
        DOM.saveMessage.style.color = "#ff0050";
    }
}

async function loadLeaderboard() {
    DOM.leaderboardList.innerHTML = '<div class="loading-spinner">Loading...</div>';

    try {
        const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(10));
        const snapshot = await getDocs(q);

        DOM.leaderboardList.innerHTML = "";
        let rank = 1;
        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = "leaderboard-item glass-pill";
            div.style.marginBottom = "10px";
            div.style.justifyContent = "space-between";
            div.innerHTML = `
                <span style="color:var(--color-cyan); font-weight:bold;">#${rank}</span>
                <span>${data.username}</span>
                <span style="font-weight:bold;">${data.score}</span>
            `;
            DOM.leaderboardList.appendChild(div);
            rank++;
        });

    } catch (e) {
        console.warn("Leaderboard Error:", e);
        DOM.leaderboardList.innerHTML = "Error loading scores.";
    }
}

// 9. EVENT LISTENERS
// Init Game
if (DOM.btnStartGame) DOM.btnStartGame.addEventListener('click', initCamera);

// Navigation
if (DOM.btnOpenLeaderboard) DOM.btnOpenLeaderboard.addEventListener('click', () => {
    DOM.menuScreen.classList.add('hidden');
    DOM.leaderboardScreen.classList.remove('hidden');
    loadLeaderboard();
});
if (DOM.btnCloseLeaderboard) DOM.btnCloseLeaderboard.addEventListener('click', () => {
    DOM.leaderboardScreen.classList.add('hidden');
    DOM.menuScreen.classList.remove('hidden');
});
if (DOM.btnRestartGame) DOM.btnRestartGame.addEventListener('click', resetGame);
if (DOM.btnHome) DOM.btnHome.addEventListener('click', () => {
    GameState.isActive = false;
    resetUI();
});

// Sound
if (DOM.muteBtn) DOM.muteBtn.addEventListener('click', () => {
    soundManager.muted = !soundManager.muted;
    DOM.muteBtn.innerHTML = soundManager.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
});

// Save & Share
if (DOM.btnSaveScore) DOM.btnSaveScore.addEventListener('click', saveScore);
if (DOM.btnShareScore) DOM.btnShareScore.addEventListener('click', async () => {
    const text = `I scored ${GameState.score} in ChatGames! Can you beat me? 🎮`;
    try {
        if (navigator.share) {
            await navigator.share({ title: 'ChatGames', text: text, url: window.location.href });
        } else {
            await navigator.clipboard.writeText(text);
            alert("Score copied to clipboard!");
        }
    } catch (e) {
        console.log("Share failed/cancelled");
    }
});

// Run once on load
console.log("ChatGames v0.9.3 Loaded (Refactor)");
