// ChatGames - Camera Management & Face Tracking with Game Loop
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ====== FIREBASE CONFIG ======
const firebaseConfig = {
    apiKey: "AIzaSyBJqIfScXLNKWiaVylgKHlvuVbeT1rEOk8",
    authDomain: "chatgames-4b61b.firebaseapp.com",
    projectId: "chatgames-4b61b",
    storageBucket: "chatgames-4b61b.firebasestorage.app",
    messagingSenderId: "832676453422",
    appId: "1:832676453422:web:92fb35a2c7dbf73cad13bf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Screen elements
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');

// Game elements
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const startButton = document.getElementById('startButton');
const videoOverlay = document.getElementById('videoOverlay');
const scoreDisplay = document.getElementById('scoreDisplay');
const scoreValue = document.getElementById('scoreValue');
const livesDisplay = document.getElementById('livesDisplay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreValue = document.getElementById('finalScoreValue');
const restartButton = document.getElementById('restartButton');
const menuButton = document.getElementById('menuButton');
const menuButtonGameOver = document.getElementById('menuButtonGameOver');

// Leaderboard elements
const openLeaderboardBtn = document.getElementById('openLeaderboardBtn');
const leaderboardBackBtn = document.getElementById('leaderboardBackBtn');
const leaderboardList = document.getElementById('leaderboardList');
const saveScoreBtn = document.getElementById('saveScoreBtn');
const usernameInput = document.getElementById('usernameInput');
const saveMessage = document.getElementById('saveMessage');

const canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });

let stream = null;
let isStreamActive = false;
let faceMesh = null;
let camera = null;

// ===== GAME STATE =====
const gameState = {
    score: 0,
    lives: 3,
    maxLives: 3,
    isGameActive: false,
    fallingObjects: [],
    nosePosition: { x: 0, y: 0 },
    noseRadius: 20,
    lastSpawnTime: 0,
    spawnInterval: 1500,
    speedMultiplier: 1.0,
    floatingTexts: [],
    animationFrameId: null
};

/**
 * Falling Object Class
 */
class FallingObject {
    constructor(canvasWidth, speedMultiplier = 1.0) {
        this.x = Math.random() * (canvasWidth - 60) + 30; // Random x position with padding
        this.y = -30; // Start above canvas
        this.radius = 15 + Math.random() * 10; // Random radius between 15-25
        this.type = Math.random() < 0.2 ? 'bad' : 'good';
        this.color = this.type === 'good' ? this.getRandomGoodColor() : this.getBadColor();
        this.speed = (2 + Math.random() * 2) * speedMultiplier;
    }

    getRandomGoodColor() {
        const goodColors = ['#10b981', '#3b82f6', '#8b5cf6', '#14b8a6', '#06b6d4'];
        return goodColors[Math.floor(Math.random() * goodColors.length)];
    }

    getBadColor() {
        const badColors = ['#991b1b', '#7f1d1d', '#1f2937'];
        return badColors[Math.floor(Math.random() * badColors.length)];
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        if (this.type === 'bad') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, 2 * Math.PI);
            ctx.fillStyle = this.color + '40';
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.color;
        ctx.fill();

        if (this.type === 'bad') {
            ctx.fillStyle = '#ef4444';
            ctx.font = `bold ${this.radius}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', this.x, this.y);
        } else {
            ctx.beginPath();
            ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.3, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }
    }

    isOffScreen(canvasHeight) {
        return this.y - this.radius > canvasHeight;
    }
}

/**
 * Floating Text Class
 */
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.opacity = 1.0;
        this.lifetime = 60;
        this.age = 0;
    }

    update() {
        this.y -= 2;
        this.age++;
        this.opacity = 1.0 - (this.age / this.lifetime);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }

    isDead() {
        return this.age >= this.lifetime;
    }
}

// MediaPipe Functions
function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceMeshResults);
}

function onFaceMeshResults(results) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    if (!canvasElement.height || canvasElement.height === 0) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const noseTip = landmarks[4];

        const x = noseTip.x * canvasElement.width;
        const y = noseTip.y * canvasElement.height;

        gameState.nosePosition.x = x;
        gameState.nosePosition.y = y;

        if (gameState.isGameActive) {
            drawGameElements();
        } else {
            drawNoseDot(x, y);
        }
    }

    canvasCtx.restore();
}

function drawNoseDot(x, y) {
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, gameState.noseRadius, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    canvasCtx.fill();

    canvasCtx.beginPath();
    canvasCtx.arc(x, y, gameState.noseRadius * 0.6, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#ef4444';
    canvasCtx.fill();

    canvasCtx.beginPath();
    canvasCtx.arc(x, y, gameState.noseRadius * 0.3, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#fca5a5';
    canvasCtx.fill();
}

// Game Functions
function spawnFallingObject() {
    const newObject = new FallingObject(canvasElement.width, gameState.speedMultiplier);
    gameState.fallingObjects.push(newObject);
}

function gameLoop(timestamp) {
    if (!gameState.isGameActive) return;

    if (timestamp - gameState.lastSpawnTime > gameState.spawnInterval) {
        spawnFallingObject();
        gameState.lastSpawnTime = timestamp;
    }

    gameState.fallingObjects.forEach(obj => obj.update());

    gameState.fallingObjects = gameState.fallingObjects.filter(obj => {
        if (obj.isOffScreen(canvasElement.height)) {
            if (obj.type === 'good') {
                gameState.lives--;
                updateLivesDisplay();

                if (gameState.lives <= 0) {
                    gameOver();
                }
            }
            return false;
        }

        const distance = Math.hypot(
            gameState.nosePosition.x - obj.x,
            gameState.nosePosition.y - obj.y
        );

        if (distance < (gameState.noseRadius + obj.radius)) {
            if (obj.type === 'good') {
                gameState.score++;
                updateScoreDisplay();

                const floatingText = new FloatingText(obj.x, obj.y, '+1', '#10b981');
                gameState.floatingTexts.push(floatingText);

                if (gameState.score % 10 === 0 && gameState.score > 0) {
                    gameState.speedMultiplier *= 1.1;
                    const levelUpText = new FloatingText(
                        canvasElement.width / 2,
                        canvasElement.height / 2,
                        'SPEED UP!',
                        '#f59e0b'
                    );
                    gameState.floatingTexts.push(levelUpText);
                }

                console.log(`💯 Score: ${gameState.score}`);
            } else {
                gameState.lives -= 2;
                updateLivesDisplay();

                const floatingText = new FloatingText(obj.x, obj.y, '-2 HP', '#ef4444');
                gameState.floatingTexts.push(floatingText);

                if (gameState.lives <= 0) {
                    gameOver();
                }
            }
            return false;
        }
        return true;
    });

    gameState.floatingTexts.forEach(text => text.update());
    gameState.floatingTexts = gameState.floatingTexts.filter(text => !text.isDead());

    gameState.animationFrameId = requestAnimationFrame(gameLoop);
}

function drawGameElements() {
    gameState.fallingObjects.forEach(obj => obj.draw(canvasCtx));
    gameState.floatingTexts.forEach(text => text.draw(canvasCtx));
    drawNoseDot(gameState.nosePosition.x, gameState.nosePosition.y);
}

function updateScoreDisplay() {
    scoreValue.textContent = gameState.score;
}

function updateLivesDisplay() {
    const hearts = livesDisplay.querySelectorAll('.heart');
    hearts.forEach((heart, index) => {
        if (index >= gameState.lives) {
            heart.classList.add('lost');
        } else {
            heart.classList.remove('lost');
        }
    });
}

function startGame() {
    if (videoElement.readyState < 2) {
        setTimeout(startGame, 100);
        return;
    }

    gameState.score = 0;
    gameState.lives = gameState.maxLives;
    gameState.isGameActive = true;
    gameState.fallingObjects = [];
    gameState.floatingTexts = [];
    gameState.speedMultiplier = 1.0;
    gameState.lastSpawnTime = performance.now();

    updateScoreDisplay();
    updateLivesDisplay();
    scoreDisplay.style.display = 'flex'; // Changed to flex to fix layout

    // Reset save score form
    if (saveScoreBtn) saveScoreBtn.disabled = false;
    if (usernameInput) usernameInput.value = '';
    if (saveMessage) {
        saveMessage.textContent = '';
        saveMessage.className = 'save-message';
    }

    gameState.animationFrameId = requestAnimationFrame(gameLoop);
}

function stopGame() {
    gameState.isGameActive = false;
    gameState.fallingObjects = [];
    gameState.floatingTexts = [];

    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    scoreDisplay.style.display = 'none';
}

function gameOver() {
    gameState.isGameActive = false;
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    finalScoreValue.textContent = gameState.score;
    gameOverOverlay.classList.add('active');
}

function restartGame() {
    gameOverOverlay.classList.remove('active');
    gameState.score = 0;
    gameState.lives = gameState.maxLives;
    gameState.fallingObjects = [];
    gameState.floatingTexts = [];
    gameState.speedMultiplier = 1.0;
    gameState.lastSpawnTime = performance.now();

    updateScoreDisplay();
    updateLivesDisplay();
    startGame();
}

async function startCamera() {
    try {
        startButton.disabled = true;
        startButton.textContent = 'Starting Camera...';

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        });

        videoElement.srcObject = stream;
        await videoElement.play();
        videoOverlay.classList.add('hidden');
        isStreamActive = true;

        if (!faceMesh) {
            initializeFaceMesh();
        }

        camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });
        camera.start();

        updateButtonState();
        startGame();

    } catch (error) {
        console.error('❌ Camera start error:', error);
        handleCameraError(error);
    }
}

function stopCamera() {
    stopGame();

    if (camera) {
        camera.stop();
        camera = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        stream = null;
    }

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    videoOverlay.classList.remove('hidden');
    isStreamActive = false;
    updateButtonState();
}

function updateButtonState() {
    // Button content logic is handled in HTML/CSS now primarily, 
    // but we ensure it's enabled
    startButton.disabled = false;
    startButton.textContent = isStreamActive ? 'Stop Game' : 'Start Game';

    // We recreate the inner HTML for the icon
    if (isStreamActive) {
        startButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            Stop Game
        `;
    } else {
        startButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
            </svg>
            Start Game
        `;
    }
}

function handleCameraError(error) {
    let errorMessage = 'Failed to start camera. ';
    // ... error handling logic same as before ...
    alert(errorMessage + error.message);
    startButton.disabled = false;
    updateButtonState();
}

// ===== FIREBASE LEADERBOARD FUNCTIONS =====

/**
 * Saves the user score to Firestore
 */
async function saveScore(username, score) {
    if (!username || username.trim() === '') {
        showSaveMessage('Please enter a name!', 'error');
        return;
    }

    try {
        saveScoreBtn.disabled = true;
        showSaveMessage('Saving...', 'neutral');

        await addDoc(collection(db, "scores"), {
            username: username.trim(),
            score: score,
            timestamp: new Date()
        });

        showSaveMessage('Score stored successfully!', 'success');

        // Wait a bit then return to menu
        setTimeout(() => {
            returnToMenu();
            // Automatically open leaderboard
            openLeaderboard();
        }, 1500);

    } catch (error) {
        console.error("Error saving score: ", error);
        showSaveMessage('Error saving score. Try again.', 'error');
        saveScoreBtn.disabled = false;
    }
}

function showSaveMessage(message, type) {
    saveMessage.textContent = message;
    saveMessage.className = `save-message ${type}`;
}

/**
 * Loads leaderboard data from Firestore
 */
async function loadLeaderboard() {
    leaderboardList.innerHTML = `
        <div class="loading-spinner">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Loading...
        </div>
    `;

    try {
        const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        leaderboardList.innerHTML = '';

        if (querySnapshot.empty) {
            leaderboardList.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">No scores yet. Be the first!</div>';
            return;
        }

        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleDateString() : '';

            const item = document.createElement('div');
            item.className = 'leaderboard-item';

            let rankIcon = rank;
            if (rank === 1) rankIcon = '🥇';
            if (rank === 2) rankIcon = '🥈';
            if (rank === 3) rankIcon = '🥉';

            item.innerHTML = `
                <div class="rank">${rankIcon}</div>
                <div class="player-info">
                    <span class="player-name">${data.username}</span>
                    <span class="player-date">${date}</span>
                </div>
                <div class="player-score">${data.score}</div>
            `;

            leaderboardList.appendChild(item);
            rank++;
        });

    } catch (error) {
        console.error("Error loading leaderboard: ", error);
        leaderboardList.innerHTML = '<div style="text-align: center; color: var(--accent-pink);">Failed to load leaderboard.</div>';
    }
}

// ===== NAVIGATION FUNCTIONS =====

// Expose functions to window (since we are a module now)
window.initGame = function (gameName) {
    menuScreen.style.display = 'none';
    leaderboardScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    startCamera();
};

window.openLeaderboard = function () {
    menuScreen.style.display = 'none';
    leaderboardScreen.style.display = 'flex';
    loadLeaderboard();
};

function returnToMenu() {
    stopCamera();
    gameOverOverlay.classList.remove('active');
    gameScreen.style.display = 'none';
    leaderboardScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
}

// Event Listeners
startButton.addEventListener('click', () => {
    if (isStreamActive) stopCamera();
    else startCamera();
});

restartButton.addEventListener('click', restartGame);
menuButton.addEventListener('click', returnToMenu);
menuButtonGameOver.addEventListener('click', returnToMenu);

// Leaderboard Event Listeners
openLeaderboardBtn.addEventListener('click', window.openLeaderboard);
leaderboardBackBtn.addEventListener('click', returnToMenu);

saveScoreBtn.addEventListener('click', () => {
    saveScore(usernameInput.value, gameState.score);
});

// Video Error
videoElement.addEventListener('error', (e) => {
    console.error('Video element error:', e);
});

console.log('🎮 ChatGames Platform loaded - v0.4.0 (Firebase Integrated)');
