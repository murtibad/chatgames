// v1.1.3 UX POLISH & ANTI-CHEAT - app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === FIREBASE CONFIG ===
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
    console.error("Firebase initialization failed:", e);
}

// === AUDIO SYSTEM ===
const AudioManager = {
    ctx: null,
    masterGain: null,
    muted: false,
    volume: 1.0,

    init() {
        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            if (!this.masterGain) {
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);
                this.masterGain.gain.value = this.volume;
            }
        } catch (e) {
            console.error("AudioManager init failed:", e);
        }
    },

    setVolume(value) {
        this.volume = clamp(parseFloat(value) || 0.5, 0, 1);
        if (this.masterGain) this.masterGain.gain.value = this.volume;
    },

    playGem() {
        if (!this.ctx || this.muted) return;
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(); osc.stop(this.ctx.currentTime + 0.2);
        } catch (e) { }
    },

    playBomb() {
        if (!this.ctx || this.muted) return;
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(); osc.stop(this.ctx.currentTime + 0.35);
        } catch (e) { }
    },

    playGold() {
        if (!this.ctx || this.muted) return;
        try {
            this.init();
            const notes = [523.25, 659.25, 783.99];
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                    osc.connect(gain); gain.connect(this.masterGain);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.35);
                }, i * 50);
            });
        } catch (e) { }
    }
};

// === CONSTANTS ===
const DISTANCE = {
    TOO_FAR: 0.15,
    TOO_CLOSE: 0.45,
    TOO_HIGH: 0.3,
    TOO_LOW: 0.7,
    HOLD_DURATION: 1500,
    PENALTY_THRESHOLD: 2000 // 2 seconds in warning = penalty
};

const MAX_PLAY_WIDTH = 600;

function getPlayArea() {
    const playWidth = Math.min(window.innerWidth, MAX_PLAY_WIDTH);
    const playXStart = (window.innerWidth - playWidth) / 2;
    return { playWidth, playXStart };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// === LOCALSTORAGE ===
const STORAGE_KEY = 'chatgames_data';

function loadPlayerData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error("localStorage load error:", e);
    }
    return {
        totalCoins: 0,
        inventory: ['default'],
        equippedSkin: 'default',
        lastUsername: '',
        volume: 1.0
    };
}

function savePlayerData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("localStorage save error:", e);
    }
}

const PlayerData = loadPlayerData();

// === SHOP ITEMS ===
const SHOP_ITEMS = [
    { id: 'default', name: 'Neon Dot', price: 0, color: '#00f2ea', type: 'circle', hitboxMultiplier: 1.0, ability: null, description: 'Classic cyan glow' },
    { id: 'clown', name: 'Clown Nose', price: 500, color: '#ff0050', type: 'circle', hitboxMultiplier: 1.3, ability: 'shield', description: '10% bomb shield' },
    { id: 'cyborg', name: 'Cyborg', price: 1000, color: '#00ff00', type: 'square', hitboxMultiplier: 1.6, ability: null, description: 'Tech precision' },
    { id: 'gold', name: 'Golden Touch', price: 2000, color: '#FFD700', type: 'circle', hitboxMultiplier: 2.0, ability: 'multiplier', description: '1.2x score boost' }
];

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

// === DOM ELEMENTS ===
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
    shop: getEl('shop-screen'),
    settings: getEl('settings-modal'),
    scoreHud: getEl('score-hud'),
    scoreVal: getEl('score-val'),
    livesDisplay: getEl('lives-display'),
    overlay: getEl('countdown-overlay'),
    countText: getEl('countdown-text'),
    distanceOverlay: getEl('distance-check-overlay'),
    distanceMessage: getEl('distance-message'),
    holdProgress: getEl('hold-progress'),
    progressRing: getEl('progress-ring'),
    proximityWarning: getEl('proximity-warning'),
    dangerZone: getEl('danger-zone'),
    username: getEl('username-input'),
    saveMsg: getEl('save-msg'),
    saveBtn: getEl('btn-save'),
    shareBtn: getEl('btn-share'),
    snapshotBtn: getEl('btn-snapshot'),
    volumeSlider: getEl('volume-slider'),
    volumePercentage: getEl('volume-percentage'),
    muteToggle: getEl('mute-toggle'),
    settingsBtn: getEl('settings-btn'),
    list: getEl('leaderboard-list'),
    coinCount: getEl('coin-count'),
    shopItems: getEl('shop-items'),
    shopBtn: getEl('btn-shop'),
    leaderboardBtn: getEl('btn-leaderboard')
};

// === GAME STATE ===
const State = {
    isGameActive: false,
    isCountingDown: false,
    countdownTimer: null,
    score: 0,
    lives: 3,
    combo: 0,
    isFeverMode: false,
    speedMultiplier: 1.0,
    lastSpeedNotification: 0,
    bombChance: 0.35,
    lastSpawnTime: 0,
    spawnInterval: 1200,
    gameStartTime: 0,
    fallingObjects: [],
    particles: [],
    floatingTexts: [],
    noseX: 0.5,
    noseY: 0.5,
    faceScale: 0.1,
    lastKnownNose: { x: 0, y: 0 },
    noseStyle: PlayerData.equippedSkin,
    nosePulse: 0,
    waitingForIdealDistance: false,
    isDistanceIdeal: false,
    distanceHoldTime: 0,
    lastDistanceCheckTime: 0,
    scoreSaved: false,
    // ANTI-CHEAT: Bomb Rain
    warningTime: 0,
    isPenaltyMode: false,
    lastPenaltyCheck: 0
};

AudioManager.muted = false;
AudioManager.volume = PlayerData.volume;

// === PROXIMITY SYSTEM ===
function checkDistance(faceWidth, noseY) {
    if (noseY < DISTANCE.TOO_HIGH) return 'TOO_HIGH';
    if (noseY > DISTANCE.TOO_LOW) return 'TOO_LOW';
    if (faceWidth < DISTANCE.TOO_FAR) return 'TOO_FAR';
    if (faceWidth > DISTANCE.TOO_CLOSE) return 'TOO_CLOSE';
    return 'IDEAL';
}

function updateDistanceUI(status) {
    if (!D.distanceOverlay || !D.distanceMessage) return;
    const frame = D.distanceOverlay.querySelector('.distance-frame');
    if (!frame) return;

    if (status === 'IDEAL') {
        frame.classList.add('ideal');
        frame.classList.remove('warning');
        D.distanceMessage.innerText = '✓ Perfect Distance';
        D.distanceMessage.style.color = '#00f2ea';
        State.isDistanceIdeal = true;
    } else {
        frame.classList.remove('ideal');
        frame.classList.add('warning');
        State.isDistanceIdeal = false;

        if (status === 'TOO_FAR') D.distanceMessage.innerText = '🔭 Move Closer';
        else if (status === 'TOO_CLOSE') D.distanceMessage.innerText = '✋ Move Back';
        else if (status === 'TOO_HIGH') D.distanceMessage.innerText = '🔽 Move Down';
        else if (status === 'TOO_LOW') D.distanceMessage.innerText = '🔼 Move Up';

        D.distanceMessage.style.color = '#ff0050';
    }
}

function updateHoldProgress(progress) {
    if (!D.progressRing) return;
    const circumference = 283;
    const offset = circumference - (progress * circumference);
    D.progressRing.style.strokeDashoffset = offset;
}

function showProximityWarning(show) {
    if (!D.proximityWarning) return;
    if (show) D.proximityWarning.classList.remove('hidden');
    else D.proximityWarning.classList.add('hidden');
}

function showDangerZone(show) {
    if (!D.dangerZone) return;
    if (show) D.dangerZone.classList.remove('hidden');
    else D.dangerZone.classList.add('hidden');
}

// === CLASSES ===
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 5 + 2;
        this.speedX = (Math.random() - 0.5) * 10;
        this.speedY = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }
    update() {
        this.x += this.speedX; this.y += this.speedY;
        this.life -= this.decay; this.size *= 0.95;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill(); ctx.restore();
    }
}

class FallingObject {
    constructor(w, h, type, speedMult, spawnWidthRatio) {
        this.type = type;
        const { playWidth, playXStart } = getPlayArea();
        this.radius = Math.max(20, playWidth * 0.12);
        const range = playWidth * spawnWidthRatio;
        const minX = playXStart + (playWidth - range) / 2;
        this.x = minX + Math.random() * range;
        this.y = -this.radius * 2;

        const gameTime = (performance.now() - State.gameStartTime) / 1000;
        const speedRamp = 0.6 + (gameTime * 0.02);
        const baseSpeed = h * 0.004;
        this.speed = (Math.random() * baseSpeed + baseSpeed) * speedMult * speedRamp;

        this.color = type === 'gem' ? '#00f2ea' : (type === 'gold' ? '#FFD700' : '#ff0050');
    }
    update() { this.y += this.speed; }
    draw(ctx) {
        let sprite = bombSprite;
        if (this.type === 'gem') sprite = diamondSprite;
        if (this.type === 'gold') sprite = goldDiamondSprite;
        ctx.drawImage(sprite, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

// === UTILITY FUNCTIONS ===
function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) State.particles.push(new Particle(x, y, color));
}

function createFloatingText(text, x, y, isJackpot = false) {
    const el = document.createElement('div');
    el.className = 'floating-text' + (isJackpot ? ' jackpot' : '');
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function updateUI() {
    if (D.scoreVal) D.scoreVal.innerText = State.score;
    if (D.livesDisplay) {
        D.livesDisplay.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            D.livesDisplay.innerHTML += i < State.lives ? '❤' : '🖤';
        }
    }
    updateCoinDisplay();
}

function updateCoinDisplay() {
    if (D.coinCount) D.coinCount.innerText = PlayerData.totalCoins;
}

function triggerVisualEffect(type) {
    if (type === 'score') {
        const scoreEl = D.scoreVal;
        if (scoreEl) {
            scoreEl.classList.remove('score-flash');
            void scoreEl.offsetWidth;
            scoreEl.classList.add('score-flash');
            setTimeout(() => scoreEl.classList.remove('score-flash'), 300);
        }
    } else if (type === 'damage') {
        if (D.uiLayer) {
            D.uiLayer.classList.remove('damage-effect');
            void D.uiLayer.offsetWidth;
            D.uiLayer.classList.add('damage-effect');
        }
        if (D.livesDisplay) {
            D.livesDisplay.classList.add('hearts-shake');
            setTimeout(() => D.livesDisplay.classList.remove('hearts-shake'), 300);
        }
    }
}

function updateFeverMode() {
    if (State.combo >= 10 && !State.isFeverMode) {
        State.isFeverMode = true;
        document.body.classList.add('fever-mode');
        createFloatingText("FEVER MODE! 2x", window.innerWidth / 2, window.innerHeight / 2);
    } else if (State.combo < 10 && State.isFeverMode) {
        State.isFeverMode = false;
        document.body.classList.remove('fever-mode');
    }
}

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// === UI EVENTS ===
window.openSettings = function () {
    if (D.settings) {
        D.settings.classList.remove('hidden');
        if (D.menu) D.menu.style.pointerEvents = 'none';
        if (D.gameOver) D.gameOver.style.pointerEvents = 'none';
    }
};

window.closeSettings = function () {
    if (D.settings) {
        D.settings.classList.add('hidden');
        if (D.menu) D.menu.style.pointerEvents = 'auto';
        if (D.gameOver) D.gameOver.style.pointerEvents = 'auto';
    }
};

// BACKDROP CLICK
if (D.settings) {
    D.settings.addEventListener('click', (e) => {
        if (e.target === D.settings) window.closeSettings();
    });
}

// === SHOP SYSTEM ===
function renderShop() {
    if (!D.shopItems) return;
    D.shopItems.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
        const owned = PlayerData.inventory.includes(item.id);
        const equipped = PlayerData.equippedSkin === item.id;

        const div = document.createElement('div');
        div.className = 'shop-item';
        if (owned) div.classList.add('owned');
        if (equipped) div.classList.add('equipped');

        const preview = document.createElement('div');
        preview.className = 'shop-item-preview';
        preview.style.border = `2px solid ${item.color}`;

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 40; previewCanvas.height = 40;
        const ctx = previewCanvas.getContext('2d');

        if (item.type === 'circle') {
            const radius = item.id === 'clown' ? 18 : 15;
            if (item.id === 'clown') {
                const grad = ctx.createRadialGradient(15, 15, 0, 20, 20, radius);
                grad.addColorStop(0, '#FF9999'); grad.addColorStop(0.4, item.color); grad.addColorStop(1, '#8B0000');
                ctx.fillStyle = grad; ctx.shadowBlur = 15; ctx.shadowColor = item.color;
                ctx.beginPath(); ctx.arc(20, 20, radius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath(); ctx.arc(15, 15, 5, 0, Math.PI * 2); ctx.fill();
            } else if (item.id === 'gold') {
                const grad = ctx.createRadialGradient(20, 15, 0, 20, 20, radius);
                grad.addColorStop(0, '#FFEB3B'); grad.addColorStop(0.5, item.color); grad.addColorStop(1, '#B8860B');
                ctx.fillStyle = grad; ctx.shadowBlur = 15; ctx.shadowColor = item.color;
                ctx.beginPath(); ctx.arc(20, 20, radius, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = item.color; ctx.shadowBlur = 15; ctx.shadowColor = item.color;
                ctx.beginPath(); ctx.arc(20, 20, radius, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.strokeStyle = item.color; ctx.lineWidth = 3; ctx.shadowBlur = 10; ctx.shadowColor = item.color;
            ctx.setLineDash([3, 3]); ctx.strokeRect(7, 7, 26, 26); ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(20, 10); ctx.lineTo(20, 30); ctx.moveTo(10, 20); ctx.lineTo(30, 20); ctx.stroke();
        }

        preview.appendChild(previewCanvas);

        const name = document.createElement('div');
        name.className = 'shop-item-name';
        name.innerText = item.name;

        const price = document.createElement('div');
        price.className = 'shop-item-price';
        price.innerText = item.price === 0 ? 'FREE' : `${item.price} 🪙`;

        const bonus = document.createElement('div');
        bonus.style.fontSize = '0.75rem';
        bonus.style.color = '#00f2ea';
        bonus.style.marginBottom = '5px';
        if (item.ability === 'shield') {
            bonus.innerText = `🛡️ ${item.description}`;
        } else if (item.ability === 'multiplier') {
            bonus.innerText = `⭐ ${item.description}`;
        } else {
            bonus.innerText = `${item.hitboxMultiplier}x Reach`;
        }

        const btn = document.createElement('button');
        btn.className = 'shop-item-btn';

        if (equipped) {
            btn.innerText = 'EQUIPPED';
            btn.classList.add('equipped-btn');
            btn.disabled = true;
        } else if (owned) {
            btn.innerText = 'EQUIP';
            btn.onclick = () => equipSkin(item.id);
        } else {
            btn.innerText = 'BUY';
            btn.disabled = PlayerData.totalCoins < item.price;
            btn.onclick = () => buySkin(item.id, item.price);
        }

        div.appendChild(preview); div.appendChild(name); div.appendChild(bonus); div.appendChild(price); div.appendChild(btn);
        D.shopItems.appendChild(div);
    });
}

function buySkin(id, price) {
    if (PlayerData.totalCoins >= price) {
        PlayerData.totalCoins -= price;
        PlayerData.inventory.push(id);
        savePlayerData(PlayerData);
        updateCoinDisplay();
        renderShop();
        showToast(`Purchased! 🎉`);
        AudioManager.playGold();
    }
}

function equipSkin(id) {
    PlayerData.equippedSkin = id;
    State.noseStyle = id;
    savePlayerData(PlayerData);
    renderShop();
    showToast(`Equipped! ✨`);
    AudioManager.playGem();
}

window.openShop = function () {
    D.menu.classList.add('hidden');
    D.shop.classList.remove('hidden');
    renderShop();
};

window.closeShop = function () {
    D.shop.classList.add('hidden');
    D.menu.classList.remove('hidden');
};

// === GAME FLOW ===
window.startGame = function () {
    AudioManager.init();

    D.menu.classList.add('hidden');
    D.gameOver.classList.add('hidden');
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    if (D.shop) D.shop.classList.add('hidden');
    if (D.settings) D.settings.classList.add('hidden');
    if (D.settingsBtn) D.settingsBtn.classList.add('hidden');

    if (D.distanceOverlay) D.distanceOverlay.classList.remove('hidden');
    State.waitingForIdealDistance = true;
    State.isDistanceIdeal = false;
    State.distanceHoldTime = 0;
    State.lastDistanceCheckTime = performance.now();

    if (D.holdProgress) D.holdProgress.classList.add('hidden');
    if (D.progressRing) updateHoldProgress(0);

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

function beginCountdown() {
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
            requestAnimationFrame(gameLoop);
        }
    }, 1000);
}

function endGame() {
    State.isGameActive = false;
    D.scoreHud.classList.add('hidden');
    D.gameOver.classList.remove('hidden');
    document.body.classList.remove('fever-mode');
    showProximityWarning(false);
    showDangerZone(false);
    if (D.settingsBtn) D.settingsBtn.classList.remove('hidden');

    PlayerData.totalCoins += State.score;
    savePlayerData(PlayerData);
    updateCoinDisplay();

    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.innerText = State.score;

    if (D.saveBtn) D.saveBtn.disabled = false;
    if (D.saveMsg) D.saveMsg.innerText = "";
    if (D.username) D.username.value = PlayerData.lastUsername || "";

    AudioManager.playBomb();
}

// === GAME LOOP ===
function gameLoop() {
    if (!State.isGameActive) return;

    const ctx = D.canvas.getContext('2d');
    ctx.clearRect(0, 0, D.canvas.width, D.canvas.height);

    const noseXPx = State.lastKnownNose.x;
    const noseYPx = State.lastKnownNose.y;

    State.nosePulse += 0.05;
    const pulseScale = 1 + Math.sin(State.nosePulse) * 0.05;

    ctx.save();
    const skinData = SHOP_ITEMS.find(s => s.id === State.noseStyle) || SHOP_ITEMS[0];
    ctx.translate(noseXPx, noseYPx);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-noseXPx, -noseYPx);

    if (skinData.type === 'circle') {
        let radius = 10, blur = 15;
        if (skinData.id === 'clown') {
            radius = 18;
            const grad = ctx.createRadialGradient(noseXPx - 5, noseYPx - 5, 0, noseXPx, noseYPx, radius);
            grad.addColorStop(0, '#FF9999'); grad.addColorStop(0.4, skinData.color); grad.addColorStop(1, '#8B0000');
            ctx.fillStyle = grad; ctx.shadowBlur = 20; ctx.shadowColor = skinData.color;
            ctx.beginPath(); ctx.arc(noseXPx, noseYPx, radius, 0, 2 * Math.PI); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(noseXPx - 5, noseYPx - 5, 4, 0, 2 * Math.PI); ctx.fill();
        } else if (skinData.id === 'gold') {
            blur = 25;
            const grad = ctx.createRadialGradient(noseXPx, noseYPx - 5, 0, noseXPx, noseYPx, 12);
            grad.addColorStop(0, '#FFEB3B'); grad.addColorStop(0.5, skinData.color); grad.addColorStop(1, '#B8860B');
            ctx.fillStyle = grad; ctx.shadowBlur = blur; ctx.shadowColor = skinData.color;
            ctx.beginPath(); ctx.arc(noseXPx, noseYPx, 12, 0, 2 * Math.PI); ctx.fill();
        } else {
            ctx.fillStyle = skinData.color; ctx.shadowBlur = blur; ctx.shadowColor = skinData.color;
            ctx.beginPath(); ctx.arc(noseXPx, noseYPx, radius, 0, 2 * Math.PI); ctx.fill();
        }
        if (skinData.id !== 'clown') {
            ctx.shadowBlur = 0; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(noseXPx, noseYPx, radius, 0, 2 * Math.PI); ctx.stroke();
        }
    } else {
        const rotation = (State.nosePulse * 2) % (Math.PI * 2);
        ctx.translate(noseXPx, noseYPx); ctx.rotate(rotation); ctx.translate(-noseXPx, -noseYPx);
        ctx.strokeStyle = skinData.color; ctx.lineWidth = 3; ctx.shadowBlur = 20; ctx.shadowColor = skinData.color;
        ctx.setLineDash([5, 5]); ctx.strokeRect(noseXPx - 15, noseYPx - 15, 30, 30); ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(noseXPx, noseYPx - 20); ctx.lineTo(noseXPx, noseYPx + 20);
        ctx.moveTo(noseXPx - 20, noseYPx); ctx.lineTo(noseXPx + 20, noseYPx);
        ctx.stroke();
        ctx.strokeRect(noseXPx - 18, noseYPx - 18, 5, 5); ctx.strokeRect(noseXPx + 13, noseYPx - 18, 5, 5);
        ctx.strokeRect(noseXPx - 18, noseYPx + 13, 5, 5); ctx.strokeRect(noseXPx + 13, noseYPx + 13, 5, 5);
    }
    ctx.restore();

    const now = performance.now();
    const minutesPlayed = (now - State.gameStartTime) / 60000;
    const dynamicSpeedBonus = 1.0 + (minutesPlayed * 0.5) + (State.score * 0.002);
    State.speedMultiplier = dynamicSpeedBonus;

    const speedTier = Math.floor(State.speedMultiplier * 2);
    if (speedTier > State.lastSpeedNotification) {
        State.lastSpeedNotification = speedTier;
        createFloatingText("SPEED UP! ⚡", window.innerWidth / 2, 100);
    }

    if (State.score >= 100) State.bombChance = 0.45;

    let safeWidthRatio = 1.0 - State.faceScale;
    if (safeWidthRatio < 0.4) safeWidthRatio = 0.4;
    if (safeWidthRatio > 0.95) safeWidthRatio = 0.95;

    // BOMB RAIN: Penalty mode spawn rate
    let effectiveInterval = State.spawnInterval / State.speedMultiplier;
    if (State.isPenaltyMode) {
        effectiveInterval = effectiveInterval / 3; // 3x faster spawns
    }

    if (now - State.lastSpawnTime > effectiveInterval) {
        let type = 'gem';
        const rand = Math.random();

        // BOMB RAIN: Increase bomb chance in penalty mode
        const bombThreshold = State.isPenaltyMode ? 0.70 : 0.35; // 70% bombs vs 35%

        if (rand < 0.05) type = 'gold';
        else if (rand < bombThreshold) type = 'bomb';

        const obj = new FallingObject(D.canvas.width, D.canvas.height, type, State.speedMultiplier, safeWidthRatio);
        State.fallingObjects.push(obj);
        State.lastSpawnTime = now;
    }

    const hitboxBonus = skinData.hitboxMultiplier * 0.8;
    const effectiveRadius = 15 * hitboxBonus;

    for (let i = State.fallingObjects.length - 1; i >= 0; i--) {
        const obj = State.fallingObjects[i];
        obj.update(); obj.draw(ctx);

        const dx = obj.x - noseXPx;
        const dy = obj.y - noseYPx;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (obj.radius + effectiveRadius)) {
            State.fallingObjects.splice(i, 1);

            if (obj.type === 'gem') {
                let points = State.isFeverMode ? 20 : 10;
                if (skinData.ability === 'multiplier') points = Math.floor(points * 1.2);

                State.score += points; State.combo++; updateFeverMode(); triggerVisualEffect('score');
                createExplosion(obj.x, obj.y, '#00f2ea'); AudioManager.playGem();
                if (State.combo === 5) createFloatingText("+25 COMBO!", obj.x, obj.y);
                if (State.combo === 10) createFloatingText("+50 COMBO!", obj.x, obj.y);
                if (State.combo === 15) createFloatingText("+100 EPIC!", obj.x, obj.y);
            } else if (obj.type === 'gold') {
                let points = 50;
                if (skinData.ability === 'multiplier') points = Math.floor(points * 1.2);

                State.score += points; State.combo++; updateFeverMode(); triggerVisualEffect('score');
                createExplosion(obj.x, obj.y, '#FFD700');
                createFloatingText(`JACKPOT! +${points}`, obj.x, obj.y, true);
                AudioManager.playGold();
            } else {
                if (skinData.ability === 'shield' && Math.random() < 0.1) {
                    createFloatingText("🛡️ SHIELDED!", obj.x, obj.y);
                    createExplosion(obj.x, obj.y, '#00f2ea');
                    AudioManager.playGem();
                } else {
                    State.lives--; State.combo = 0; State.isFeverMode = false;
                    document.body.classList.remove('fever-mode'); triggerVisualEffect('damage');
                    createExplosion(obj.x, obj.y, '#ff0050'); AudioManager.playBomb();
                }
            }
            updateUI();
            if (State.lives <= 0) { endGame(); return; }
            continue;
        }

        if (obj.y > D.canvas.height + obj.radius + 100) {
            if (obj.type === 'gem' || obj.type === 'gold') {
                State.lives--; State.combo = 0; State.isFeverMode = false;
                document.body.classList.remove('fever-mode'); triggerVisualEffect('damage');
                AudioManager.playBomb();
            }
            State.fallingObjects.splice(i, 1);
            updateUI();
            if (State.lives <= 0) { endGame(); return; }
        }
    }

    for (let i = State.particles.length - 1; i >= 0; i--) {
        const p = State.particles[i];
        p.update(); p.draw(ctx);
        if (p.life <= 0) State.particles.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

// === MEDIAPIPE ===
function onResults(results) {
    if (D.canvas.width !== window.innerWidth) {
        D.canvas.width = window.innerWidth;
        D.canvas.height = window.innerHeight;
    }

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[4];
        State.noseX = nose.x; State.noseY = nose.y;
        State.lastKnownNose.x = State.noseX * D.canvas.width;
        State.lastKnownNose.y = State.noseY * D.canvas.height;

        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
        State.faceScale = faceWidth;

        const distanceStatus = checkDistance(faceWidth, State.noseY);

        if (State.waitingForIdealDistance) {
            updateDistanceUI(distanceStatus);

            const now = performance.now();
            const deltaTime = now - State.lastDistanceCheckTime;
            State.lastDistanceCheckTime = now;

            if (distanceStatus === 'IDEAL') {
                if (D.holdProgress) D.holdProgress.classList.remove('hidden');
                State.distanceHoldTime += deltaTime;
                const progress = Math.min(State.distanceHoldTime / DISTANCE.HOLD_DURATION, 1);
                updateHoldProgress(progress);

                if (State.distanceHoldTime >= DISTANCE.HOLD_DURATION && !State.isCountingDown) {
                    beginCountdown();
                }
            } else {
                State.distanceHoldTime = 0;
                updateHoldProgress(0);
                if (D.holdProgress) D.holdProgress.classList.add('hidden');
            }
        } else if (State.isGameActive) {
            const now = performance.now();

            // ANTI-CHEAT: Track warning time
            if (distanceStatus !== 'IDEAL') {
                State.warningTime += (now - State.lastPenaltyCheck);
                showProximityWarning(true);

                // PENALTY MODE: 2s in warning = bomb rain
                if (State.warningTime >= DISTANCE.PENALTY_THRESHOLD && !State.isPenaltyMode) {
                    State.isPenaltyMode = true;
                    showDangerZone(true);
                }
            } else {
                State.warningTime = 0;
                if (State.isPenaltyMode) {
                    State.isPenaltyMode = false;
                    showDangerZone(false);
                }
                showProximityWarning(false);
            }

            State.lastPenaltyCheck = now;
        }
    }
}

let faceMesh, camera;
async function initSystem() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 1280, height: 720 }, audio: false
        });
        D.video.srcObject = stream;

        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onResults);

        camera = new Camera(D.video, {
            onFrame: async () => { await faceMesh.send({ image: D.video }); }, width: 1280, height: 720
        });
        camera.start();

        window.addEventListener('resize', () => {
            D.canvas.width = window.innerWidth;
            D.canvas.height = window.innerHeight;
        });
    } catch (e) {
        console.error("Camera Error:", e);
        showCameraError();
    }
}

function showCameraError() {
    const errorPanel = document.createElement('div');
    errorPanel.className = 'glass-panel';
    errorPanel.style.position = 'fixed';
    errorPanel.style.top = '50%';
    errorPanel.style.left = '50%';
    errorPanel.style.transform = 'translate(-50%, -50%)';
    errorPanel.style.zIndex = '10000';
    errorPanel.innerHTML = `
        <h2 style="color: #ff0050;">⚠️ Camera Required</h2>
        <p>Please allow camera access and refresh the page.</p>
        <button onclick="location.reload()" class="btn-primary">Reload Page</button>
    `;
    document.body.appendChild(errorPanel);
}

// === LEADERBOARD ===
window.openLeaderboard = async function () {
    if (!db) { showToast("Database offline!"); return; }
    D.menu.classList.add('hidden');
    D.leaderboard.classList.remove('hidden');
    if (D.list) D.list.innerHTML = "Loading...";
    try {
        const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(10));
        const snap = await getDocs(q);
        if (D.list) D.list.innerHTML = "";
        let rank = 1;
        snap.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `<span class="name">${rank}. ${data.name || 'Anonymous'}</span><span class="score">${data.score}</span>`;
            D.list.appendChild(item); rank++;
        });
        if (snap.empty && D.list) D.list.innerHTML = "<p style='text-align:center; opacity:0.5;'>No scores yet!</p>";
    } catch (e) {
        console.error("Leaderboard Error:", e);
        if (D.list) D.list.innerHTML = "Error loading scores.";
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

// === BINDINGS ===
window.restartGame = window.startGame;

window.goHome = () => {
    D.gameOver.classList.add('hidden');
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    if (D.shop) D.shop.classList.add('hidden');
    if (D.settings) D.settings.classList.add('hidden');
    if (D.distanceOverlay) D.distanceOverlay.classList.add('hidden');
    if (D.holdProgress) D.holdProgress.classList.add('hidden');
    showProximityWarning(false);
    showDangerZone(false);
    D.menu.classList.remove('hidden');
    document.body.classList.remove('fever-mode');
    if (D.settingsBtn) D.settingsBtn.classList.remove('hidden');
    State.waitingForIdealDistance = false;
    State.isCountingDown = false;
    if (State.countdownTimer) clearInterval(State.countdownTimer);
};

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

    // SMART SLIDER: Auto-enable sound when dragging
    D.volumeSlider.oninput = (e) => {
        const value = e.target.value;
        AudioManager.setVolume(value / 100);
        PlayerData.volume = AudioManager.volume;
        savePlayerData(PlayerData);
        e.target.style.setProperty('--value', value + '%');
        if (D.volumePercentage) D.volumePercentage.innerText = value + '%';

        // Auto-enable sound if user drags slider
        if (AudioManager.muted) {
            AudioManager.muted = false;
            if (D.muteToggle) D.muteToggle.checked = true;
        }
    };

    // Update disabled state based on mute toggle
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

if (D.shopBtn) D.shopBtn.onclick = window.openShop;
if (D.leaderboardBtn) D.leaderboardBtn.onclick = window.openLeaderboard;
if (D.snapshotBtn) D.snapshotBtn.onclick = saveSnapshot;

if (D.saveBtn) {
    D.saveBtn.onclick = async () => {
        if (State.scoreSaved) return;
        if (!db) { showToast("Database offline!"); return; }

        const name = D.username.value.trim() || 'Anonymous';
        PlayerData.lastUsername = name;
        savePlayerData(PlayerData);

        D.saveBtn.innerText = "SAVING...";
        D.saveBtn.disabled = true;

        try {
            await addDoc(collection(db, 'scores'), { name: name, score: State.score, date: new Date() });
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

updateCoinDisplay();
initSystem();
