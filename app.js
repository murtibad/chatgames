// v1.2.0 - MODULAR + ONE EURO FILTER
// Main application orchestrator - ties all modules together

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { State, Config } from './src/core/state.js';
import { AudioManager } from './src/systems/audioManager.js';
import { initTracking } from './src/systems/tracking.js';
import { gameLoop } from './src/game/loop.js';
import { D, PlayerData, savePlayerData, updateUI, updateCoinDisplay, renderShop, showToast, uiHandlers } from './src/ui/ui.js';

// === FIREBASE CONFIG ===
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
    console.error("Firebase initialization failed:", e);
}

// === SECURITY HELPERS ===
function sanitizeName(name) {
    if (!name || typeof name !== 'string') return 'Anonymous';
    const trimmed = name.trim().slice(0, 24);
    return trimmed || 'Anonymous';
}

function isValidScore(score) {
    return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 500000;
}

// === PRE-RENDERED SPRITES ===
const diamondSprite = document.createElement('canvas');
const goldDiamondSprite = document.createElement('canvas');
const bombSprite = document.createElement('canvas');
const spriteSize = 128;

function preRenderDiamond() {
    diamondSprite.width = spriteSize; diamondSprite.height = spriteSize;
    const ctx = diamondSprite.getContext('2d');
    const cx = spriteSize / 2, cy = spriteSize / 2, size = spriteSize / 5;
    ctx.shadowBlur = 20; ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size, cy); ctx.closePath();
    const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy, size);
    gradient.addColorStop(0, "#E0FFFF"); gradient.addColorStop(0.5, "#00FFFF"); gradient.addColorStop(1, "#008B8B");
    ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.stroke();
}

function preRenderGoldDiamond() {
    goldDiamondSprite.width = spriteSize; goldDiamondSprite.height = spriteSize;
    const ctx = goldDiamondSprite.getContext('2d');
    const cx = spriteSize / 2, cy = spriteSize / 2, size = spriteSize / 5;
    ctx.shadowBlur = 30; ctx.shadowColor = "rgba(255, 215, 0, 1.0)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size, cy); ctx.closePath();
    const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy, size);
    gradient.addColorStop(0, "#FFF4A3"); gradient.addColorStop(0.5, "#FFD700"); gradient.addColorStop(1, "#B8860B");
    ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2; ctx.stroke();
}

function preRenderBomb() {
    bombSprite.width = spriteSize; bombSprite.height = spriteSize;
    const ctx = bombSprite.getContext('2d');
    const cx = spriteSize / 2, cy = spriteSize / 2, radius = spriteSize / 6;
    ctx.shadowBlur = 20; ctx.shadowColor = "rgba(255, 0, 80, 0.8)";
    const gradient = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, radius);
    gradient.addColorStop(0, "#FF6B9D"); gradient.addColorStop(1, "#C9184A");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy - radius - 10); ctx.stroke();
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.arc(cx, cy - radius - 12, 3, 0, Math.PI * 2); ctx.fill();
}

preRenderDiamond();
preRenderGoldDiamond();
preRenderBomb();

// Make sprites globally accessible for FallingObject
window.diamondSprite = diamondSprite;
window.goldDiamondSprite = goldDiamondSprite;
window.bombSprite = bombSprite;

// === GAME FLOW FUNCTIONS ===
window.startGame = function () {
    AudioManager.init();

    D.menu.classList.add('hidden');
    D.gameOver.classList.add('hidden');
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    if (D.shop) D.shop.classList.add('hidden');
    if (D.settings) D.settings.classList.add('hidden');
    if (D.settingsBtn) D.settingsBtn.classList.add('hidden');

    // Tutorial or distance check flow
    if (!PlayerData.hasSeenTutorial) {
        if (D.tutorialOverlay) D.tutorialOverlay.classList.remove('hidden');
    } else {
        if (D.distanceOverlay) D.distanceOverlay.classList.remove('hidden');
        State.waitingForIdealDistance = true;
        State.isDistanceIdeal = false;
        State.distanceHoldTime = 0;
        State.lastDistanceCheckTime = performance.now();

        if (D.holdProgress) D.holdProgress.classList.add('hidden');
        const progressRing = document.getElementById('progress-ring');
        if (progressRing) progressRing.style.strokeDashoffset = 283;
    }

    State.score = 0;
    State.lives = 3;
    State.combo = 0;
    State.isFeverMode = false;
    State.speedMultiplier = 1.0;
    State.lastSpeedNotification = 0;
    State.bombChance = 0.35;
    State.fallingObjects = [];
    State.particles = [];
    State.isGameActive = false;
    State.isCountingDown = false;
    State.nosePulse = 0;
    State.gameStartTime = 0;
    State.scoreSaved = false;
    State.warningTime = 0;
    State.isPenaltyMode = false;
    State.lastPenaltyCheck = 0;

    document.body.classList.remove('fever-mode');
    updateUI();
};

window.beginCountdown = function () {
    if (!D.overlay || !D.countText) return;
    if (State.isCountingDown) return;

    State.isCountingDown = true;

    if (D.distanceOverlay) D.distanceOverlay.classList.add('hidden');
    D.scoreHud.classList.remove('hidden');

    D.overlay.style.display = 'flex';
    D.overlay.classList.remove('hidden');
    let count = 3;
    D.countText.innerText = count;

    if (State.countdownTimer) clearInterval(State.countdownTimer);

    State.countdownTimer = setInterval(() => {
        count--;
        if (count > 0) {
            D.countText.innerText = count;
            AudioManager.playGem();
        } else if (count === 0) {
            D.countText.innerText = "GO!";
            AudioManager.playGold();
        } else {
            clearInterval(State.countdownTimer);
            State.countdownTimer = null;
            D.overlay.style.display = 'none';
            State.isGameActive = true;
            State.waitingForIdealDistance = false;
            State.isCountingDown = false;
            State.gameStartTime = performance.now();
            State.lastSpawnTime = performance.now();
            State.lastPenaltyCheck = performance.now();
            requestAnimationFrame(() => gameLoop(D.canvas, D.canvas.getContext('2d')));
        }
    }, 1000);
};

window.restartGame = window.startGame;

window.goHome = () => {
    D.gameOver.classList.add('hidden');
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    if (D.shop) D.shop.classList.add('hidden');
    if (D.settings) D.settings.classList.add('hidden');
    if (D.distanceOverlay) D.distanceOverlay.classList.add('hidden');
    if (D.holdProgress) D.holdProgress.classList.add('hidden');
    if (D.tutorialOverlay) D.tutorialOverlay.classList.add('hidden');

    const proximityWarning = document.getElementById('proximity-warning');
    const dangerZone = document.getElementById('danger-zone');
    const penaltyNotification = document.getElementById('penalty-notification');
    if (proximityWarning) proximityWarning.classList.add('hidden');
    if (dangerZone) dangerZone.classList.add('hidden');
    if (penaltyNotification) penaltyNotification.classList.add('hidden');

    D.menu.classList.remove('hidden');
    document.body.classList.remove('fever-mode');
    if (D.settingsBtn) D.settingsBtn.classList.remove('hidden');
    State.waitingForIdealDistance = false;
    State.isCountingDown = false;
    if (State.countdownTimer) clearInterval(State.countdownTimer);
};

// Bind UI handlers to window for HTML onclick
window.openShop = uiHandlers.openShop;
window.closeShop = uiHandlers.closeShop;
window.openSettings = uiHandlers.openSettings;
window.closeSettings = uiHandlers.closeSettings;
window.closeTutorial = uiHandlers.closeTutorial;

// === LEADERBOARD ===
window.openLeaderboard = async function () {
    if (!db) { showToast("Database offline!"); return; }
    D.menu.classList.add('hidden');
    D.leaderboard.classList.remove('hidden');
    if (D.list) D.list.textContent = "Loading...";
    try {
        const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(10));
        const snap = await getDocs(q);
        if (D.list) D.list.textContent = "";
        let rank = 1;
        snap.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'leaderboard-item';

            // Güvenli DOM oluşturma - XSS koruması
            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = `${rank}. ${sanitizeName(data.name)}`;

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'score';
            scoreSpan.textContent = isValidScore(data.score) ? data.score : '—';

            item.appendChild(nameSpan);
            item.appendChild(scoreSpan);
            D.list.appendChild(item);
            rank++;
        });
        if (snap.empty && D.list) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.opacity = '0.5';
            emptyMsg.textContent = 'No scores yet!';
            D.list.appendChild(emptyMsg);
        }
    } catch (e) {
        console.error("Leaderboard Error:", e);
        if (D.list) D.list.textContent = "Error loading scores.";
    }
};

window.closeLeaderboard = function () {
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    D.menu.classList.remove('hidden');
};

// === SNAPSHOT ===
function saveSnapshot() {
    try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = D.canvas.width;
        tempCanvas.height = D.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(D.video, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
        tempCtx.drawImage(D.canvas, 0, 0);
        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `chatgames_${Date.now()}.png`;
        link.href = dataURL; link.click();
        showToast("Photo saved! 📸");
    } catch (e) {
        console.error("Snapshot error:", e);
        showToast("Error saving photo");
    }
}

// === SETTINGS UI ===
if (D.settings) {
    D.settings.addEventListener('click', (e) => {
        if (e.target === D.settings) window.closeSettings();
    });
}

if (D.settingsBtn) {
    D.settingsBtn.onclick = () => {
        if (D.settings.classList.contains('hidden')) {
            window.openSettings();
        } else {
            window.closeSettings();
        }
        D.settingsBtn.style.transform = 'rotate(90deg)';
        setTimeout(() => D.settingsBtn.style.transform = 'rotate(0deg)', 300);
    };
}

if (D.volumeSlider) {
    D.volumeSlider.value = AudioManager.volume * 100;
    D.volumeSlider.style.setProperty('--value', (AudioManager.volume * 100) + '%');

    D.volumeSlider.oninput = (e) => {
        const value = e.target.value;
        AudioManager.setVolume(value / 100);
        PlayerData.volume = AudioManager.volume;
        savePlayerData(PlayerData);
        e.target.style.setProperty('--value', value + '%');
        if (D.volumePercentage) D.volumePercentage.innerText = value + '%';

        if (AudioManager.muted) {
            AudioManager.muted = false;
            if (D.muteToggle) D.muteToggle.checked = true;
        }
    };

    function updateSliderState() {
        D.volumeSlider.disabled = AudioManager.muted;
        D.volumeSlider.style.opacity = AudioManager.muted ? '0.5' : '1';
    }
    updateSliderState();
}

if (D.muteToggle) {
    D.muteToggle.checked = !AudioManager.muted;
    D.muteToggle.onchange = (e) => {
        AudioManager.muted = !e.target.checked;
        if (D.volumeSlider) {
            D.volumeSlider.disabled = AudioManager.muted;
            D.volumeSlider.style.opacity = AudioManager.muted ? '0.5' : '1';
        }
    };
}

// === BUTTON BINDINGS ===
if (D.shopBtn) D.shopBtn.onclick = window.openShop;
if (D.leaderboardBtn) D.leaderboardBtn.onclick = window.openLeaderboard;
if (D.snapshotBtn) D.snapshotBtn.onclick = saveSnapshot;

if (D.saveBtn) {
    D.saveBtn.onclick = async () => {
        if (State.scoreSaved) return;
        if (!db) { showToast("Database offline!"); return; }

        // Input validation
        const rawName = D.username.value;
        const name = sanitizeName(rawName);
        const score = Math.trunc(State.score);

        if (!isValidScore(score)) {
            showToast("Invalid score!");
            return;
        }

        PlayerData.lastUsername = name;
        savePlayerData(PlayerData);

        D.saveBtn.innerText = "SAVING...";
        D.saveBtn.disabled = true;

        try {
            await addDoc(collection(db, 'scores'), {
                name: name,
                score: score,
                createdAt: serverTimestamp()
            });
            D.saveMsg.innerText = "SAVED!";
            D.saveMsg.style.color = "#00f2ea";
            D.saveBtn.innerText = "SAVED";
            State.scoreSaved = true;
            showToast("Score saved! 🎉");
        } catch (e) {
            console.error("Save Error:", e);
            D.saveMsg.innerText = "ERROR";
            D.saveMsg.style.color = "#ff0050";
            D.saveBtn.disabled = false;
            D.saveBtn.innerText = "SAVE SCORE";
        }
    };
}

if (D.shareBtn) {
    D.shareBtn.onclick = async () => {
        const shareData = { title: 'ChatGames', text: `Skorum: ${State.score}! 🔥 ChatGames'te beni geçebilir misin?`, url: window.location.href };
        if (navigator.share) {
            try { await navigator.share(shareData); } catch (err) { console.log('Share cancelled'); }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                showToast("Link copied! 📋");
            } catch (err) {
                showToast("Share failed");
            }
        }
    };
}

// === INITIALIZATION ===
updateCoinDisplay();
initTracking(D.video, D.canvas);

// === CSP-COMPLIANT EVENT BINDING ===
// DOM hazır olduktan sonra inline onclick yerine addEventListener kullan
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-play-now')?.addEventListener('click', window.startGame);
    document.getElementById('btn-restart')?.addEventListener('click', window.restartGame);
    document.getElementById('btn-home')?.addEventListener('click', window.goHome);
    document.getElementById('btn-close-leaderboard')?.addEventListener('click', window.closeLeaderboard);
    document.getElementById('btn-close-shop')?.addEventListener('click', window.closeShop);
    document.getElementById('btn-close-settings')?.addEventListener('click', window.closeSettings);
    document.getElementById('btn-close-tutorial')?.addEventListener('click', window.closeTutorial);
});
