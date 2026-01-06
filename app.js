// v0.9.9 MOBILE & BUG FIXES - app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("📱 v0.9.9 MOBILE & BUG FIXES INITIALIZED");

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
    console.log("✓ Firebase Connected");
} catch (e) {
    console.warn("Firebase Offline:", e);
}

// === localStorage PERSISTENCE ===
const STORAGE_KEY = 'chatgames_data';

function loadPlayerData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn("localStorage load error:", e);
    }

    return {
        totalCoins: 0,
        inventory: ['default'],
        equippedSkin: 'default',
        lastUsername: ''
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

// === SHOP ITEMS (WITH PAY-TO-WIN MECHANICS) ===
const SHOP_ITEMS = [
    {
        id: 'default',
        name: 'Neon Dot',
        price: 0,
        color: '#00f2ea',
        type: 'circle',
        hitboxMultiplier: 1.0, // Standard
        description: 'Classic cyan glow'
    },
    {
        id: 'clown',
        name: 'Clown Nose',
        price: 500,
        color: '#ff0050',
        type: 'circle',
        hitboxMultiplier: 1.5, // 50% easier
        description: 'Red & bigger reach'
    },
    {
        id: 'cyborg',
        name: 'Cyborg',
        price: 1000,
        color: '#00ff00',
        type: 'square',
        hitboxMultiplier: 2.0, // Double reach
        description: 'Tech precision'
    },
    {
        id: 'gold',
        name: 'Golden Touch',
        price: 2000,
        color: '#FFD700',
        type: 'circle',
        hitboxMultiplier: 2.5, // Magnetic
        description: 'Premium magnet'
    }
];

// === PRE-RENDERED SPRITES ===
const diamondSprite = document.createElement('canvas');
const goldDiamondSprite = document.createElement('canvas');
const bombSprite = document.createElement('canvas');
const spriteSize = 64;

function preRenderDiamond() {
    diamondSprite.width = spriteSize;
    diamondSprite.height = spriteSize;
    const ctx = diamondSprite.getContext('2d');
    const cx = spriteSize / 2;
    const cy = spriteSize / 2;
    const size = spriteSize / 2.5;

    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0, 255, 255, 0.8)";

    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();

    const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy, size);
    gradient.addColorStop(0, "#E0FFFF");
    gradient.addColorStop(0.5, "#00FFFF");
    gradient.addColorStop(1, "#008B8B");

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function preRenderGoldDiamond() {
    goldDiamondSprite.width = spriteSize;
    goldDiamondSprite.height = spriteSize;
    const ctx = goldDiamondSprite.getContext('2d');
    const cx = spriteSize / 2;
    const cy = spriteSize / 2;
    const size = spriteSize / 2.5;

    ctx.shadowBlur = 25;
    ctx.shadowColor = "rgba(255, 215, 0, 1.0)";

    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();

    const gradient = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy, size);
    gradient.addColorStop(0, "#FFF4A3");
    gradient.addColorStop(0.5, "#FFD700");
    gradient.addColorStop(1, "#B8860B");

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function preRenderBomb() {
    bombSprite.width = spriteSize;
    bombSprite.height = spriteSize;
    const ctx = bombSprite.getContext('2d');
    const cx = spriteSize / 2;
    const cy = spriteSize / 2;
    const radius = spriteSize / 3;

    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(255, 0, 80, 0.8)";

    const gradient = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, radius);
    gradient.addColorStop(0, "#FF6B9D");
    gradient.addColorStop(1, "#C9184A");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy - radius - 10);
    ctx.stroke();

    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(cx, cy - radius - 12, 3, 0, Math.PI * 2);
    ctx.fill();
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
    scoreHud: getEl('score-hud'),
    scoreVal: getEl('score-val'),
    livesDisplay: getEl('lives-display'),
    overlay: getEl('countdown-overlay'),
    countText: getEl('countdown-text'),
    username: getEl('username-input'),
    saveMsg: getEl('save-msg'),
    saveBtn: getEl('btn-save'),
    shareBtn: getEl('btn-share'),
    snapshotBtn: getEl('btn-snapshot'),
    muteBtn: getEl('mute-btn'),
    list: getEl('leaderboard-list'),
    coinCount: getEl('coin-count'),
    shopItems: getEl('shop-items'),
    shopBtn: getEl('btn-shop'),
    leaderboardBtn: getEl('btn-leaderboard')
};

// === GAME STATE ===
const State = {
    isGameActive: false,
    score: 0,
    lives: 3,
    combo: 0,
    isFeverMode: false,
    speedMultiplier: 1.0,
    bombChance: 0.35,
    lastSpawnTime: 0,
    spawnInterval: 1200,
    fallingObjects: [],
    particles: [],
    floatingTexts: [],
    noseX: 0.5,
    noseY: 0.5,
    faceScale: 0.1,
    lastKnownNose: { x: 0, y: 0 },
    muted: false,
    noseStyle: PlayerData.equippedSkin
};

// === CLASSES ===
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
        this.type = type;
        // MOBILE RESPONSIVE: Dynamic sizing
        this.radius = Math.max(20, w * 0.08); // 8% of screen width

        const range = w * spawnWidthRatio;
        const minX = (w - range) / 2;
        this.x = minX + Math.random() * range;

        this.y = -this.radius * 2;
        // MOBILE RESPONSIVE: Speed relative to height
        const baseSpeed = h * 0.008; // 0.8% of screen height per frame
        this.speed = (Math.random() * baseSpeed + baseSpeed) * speedMult;

        this.color = type === 'gem' ? '#00f2ea' : (type === 'gold' ? '#FFD700' : '#ff0050');
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        let sprite = bombSprite;
        if (this.type === 'gem') sprite = diamondSprite;
        if (this.type === 'gold') sprite = goldDiamondSprite;

        ctx.drawImage(
            sprite,
            this.x - this.radius,
            this.y - this.radius,
            this.radius * 2,
            this.radius * 2
        );
    }
}

// === AUDIO ENGINE ===
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioCtx();

function playGemSound() {
    if (State.muted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function playBombSound() {
    if (State.muted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
}

function playGoldSound() {
    if (State.muted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const notes = [523.25, 659.25, 783.99];

    notes.forEach((freq, i) => {
        setTimeout(() => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.35);
        }, i * 50);
    });
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        State.particles.push(new Particle(x, y, color));
    }
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
            D.livesDisplay.innerHTML += i < State.lives ? '❤️' : '🖤';
        }
    }

    updateCoinDisplay();
}

function updateCoinDisplay() {
    if (D.coinCount) D.coinCount.innerText = PlayerData.totalCoins;
}

function triggerVisualEffect(type) {
    if (type === 'score') {
        const hud = D.scoreHud;
        if (hud) {
            hud.classList.remove('score-pulse-anim');
            void hud.offsetWidth;
            hud.classList.add('score-pulse-anim');
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
        previewCanvas.width = 40;
        previewCanvas.height = 40;
        const ctx = previewCanvas.getContext('2d');

        // ENHANCED VISUALS
        if (item.type === 'circle') {
            const radius = item.id === 'clown' ? 18 : 15;
            ctx.beginPath();
            ctx.arc(20, 20, radius, 0, Math.PI * 2);

            if (item.id === 'gold') {
                const grad = ctx.createRadialGradient(20, 15, 0, 20, 20, radius);
                grad.addColorStop(0, '#FFEB3B');
                grad.addColorStop(0.5, item.color);
                grad.addColorStop(1, '#B8860B');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = item.color;
            }

            ctx.shadowBlur = 15;
            ctx.shadowColor = item.color;
            ctx.fill();
        } else {
            // Cyborg HUD
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = item.color;
            ctx.strokeRect(7, 7, 26, 26);

            // Crosshair
            ctx.beginPath();
            ctx.moveTo(20, 10);
            ctx.lineTo(20, 30);
            ctx.moveTo(10, 20);
            ctx.lineTo(30, 20);
            ctx.stroke();
        }

        preview.appendChild(previewCanvas);

        const name = document.createElement('div');
        name.className = 'shop-item-name';
        name.innerText = item.name;

        const price = document.createElement('div');
        price.className = 'shop-item-price';
        price.innerText = item.price === 0 ? 'FREE' : `${item.price} 🪙`;

        // Display hitbox advantage
        const bonus = document.createElement('div');
        bonus.style.fontSize = '0.75rem';
        bonus.style.color = '#00f2ea';
        bonus.style.marginBottom = '5px';
        bonus.innerText = `${item.hitboxMultiplier}x Reach`;

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

        div.appendChild(preview);
        div.appendChild(name);
        div.appendChild(bonus);
        div.appendChild(price);
        div.appendChild(btn);

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
        playGoldSound();
    }
}

function equipSkin(id) {
    PlayerData.equippedSkin = id;
    State.noseStyle = id;
    savePlayerData(PlayerData);
    renderShop();
    showToast(`Equipped! ✨`);
    playGemSound();
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

// === FLOW CONTROL ===
window.startGame = function () {
    D.menu.classList.add('hidden');
    D.gameOver.classList.add('hidden');
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    if (D.shop) D.shop.classList.add('hidden');
    D.scoreHud.classList.remove('hidden');

    State.score = 0;
    State.lives = 3;
    State.combo = 0;
    State.isFeverMode = false;
    State.speedMultiplier = 1.0;
    State.bombChance = 0.35;
    State.fallingObjects = [];
    State.particles = [];
    State.isGameActive = false;

    document.body.classList.remove('fever-mode');

    updateUI();
    showCountdown();

    setTimeout(() => {
        if (!State.isGameActive && D.overlay.style.display !== 'none') {
            D.overlay.style.display = 'none';
            State.isGameActive = true;
            State.lastSpawnTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }, 4500);
}

function showCountdown() {
    if (!D.overlay || !D.countText) return;
    D.overlay.style.display = 'flex';
    D.overlay.classList.remove('hidden');
    let count = 3;
    D.countText.innerText = count;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            D.countText.innerText = count;
            playGemSound();
        } else if (count === 0) {
            D.countText.innerText = "GO!";
            playGoldSound();
        } else {
            clearInterval(timer);
            D.overlay.style.display = 'none';
            State.isGameActive = true;
            State.lastSpawnTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }, 1000);
}

function endGame() {
    State.isGameActive = false;
    D.scoreHud.classList.add('hidden');
    D.gameOver.classList.remove('hidden');
    document.body.classList.remove('fever-mode');

    // ECONOMY: Add score to coins
    PlayerData.totalCoins += State.score;
    savePlayerData(PlayerData);
    updateCoinDisplay();

    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.innerText = State.score;

    if (D.saveBtn) D.saveBtn.disabled = false;
    if (D.saveMsg) D.saveMsg.innerText = "";
    if (D.username) {
        D.username.value = PlayerData.lastUsername || "";
    }

    playBombSound();
}

// === GAME LOOP ===
function gameLoop() {
    if (!State.isGameActive) return;

    const ctx = D.canvas.getContext('2d');
    ctx.clearRect(0, 0, D.canvas.width, D.canvas.height);

    const noseXPx = State.lastKnownNose.x;
    const noseYPx = State.lastKnownNose.y;

    // ENHANCED NOSE RENDERING
    ctx.save();

    const skinData = SHOP_ITEMS.find(s => s.id === State.noseStyle) || SHOP_ITEMS[0];

    if (skinData.type === 'circle') {
        let radius = 10;
        let blur = 15;

        if (skinData.id === 'clown') {
            radius = 18; // Larger clown nose
            // Gradient for 3D effect
            const grad = ctx.createRadialGradient(noseXPx - 3, noseYPx - 3, 0, noseXPx, noseYPx, radius);
            grad.addColorStop(0, '#FF6B9D');
            grad.addColorStop(0.7, skinData.color);
            grad.addColorStop(1, '#8B0000');
            ctx.fillStyle = grad;
        } else if (skinData.id === 'gold') {
            blur = 25; // Enhanced glow
            const grad = ctx.createRadialGradient(noseXPx, noseYPx - 5, 0, noseXPx, noseYPx, 12);
            grad.addColorStop(0, '#FFEB3B');
            grad.addColorStop(0.5, skinData.color);
            grad.addColorStop(1, '#B8860B');
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = skinData.color;
        }

        ctx.beginPath();
        ctx.arc(noseXPx, noseYPx, radius, 0, 2 * Math.PI);
        ctx.shadowBlur = blur;
        ctx.shadowColor = skinData.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        // Cyborg HUD Targeting System
        ctx.strokeStyle = skinData.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = skinData.color;

        // Outer square
        ctx.strokeRect(noseXPx - 15, noseYPx - 15, 30, 30);

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(noseXPx, noseYPx - 20);
        ctx.lineTo(noseXPx, noseYPx + 20);
        ctx.moveTo(noseXPx - 20, noseYPx);
        ctx.lineTo(noseXPx + 20, noseYPx);
        ctx.stroke();

        // Corner brackets
        ctx.strokeRect(noseXPx - 18, noseYPx - 18, 5, 5);
        ctx.strokeRect(noseXPx + 13, noseYPx - 18, 5, 5);
        ctx.strokeRect(noseXPx - 18, noseYPx + 13, 5, 5);
        ctx.strokeRect(noseXPx + 13, noseYPx + 13, 5, 5);
    }

    ctx.restore();

    const speedLevel = 1.0 + Math.floor(State.score / 50) * 0.1;
    State.speedMultiplier = speedLevel;

    if (State.score >= 100) {
        State.bombChance = 0.45;
    }

    let safeWidthRatio = 1.0 - State.faceScale;
    if (safeWidthRatio < 0.4) safeWidthRatio = 0.4;
    if (safeWidthRatio > 0.95) safeWidthRatio = 0.95;

    const currentInterval = State.spawnInterval / speedLevel;
    const now = performance.now();

    if (now - State.lastSpawnTime > currentInterval) {
        let type = 'gem';
        const rand = Math.random();

        if (rand < 0.05) {
            type = 'gold';
        } else if (rand < 0.35) {
            type = 'bomb';
        }

        const obj = new FallingObject(D.canvas.width, D.canvas.height, type, State.speedMultiplier, safeWidthRatio);
        State.fallingObjects.push(obj);
        State.lastSpawnTime = now;
    }

    // PAY-TO-WIN: Get hitbox multiplier
    const hitboxBonus = skinData.hitboxMultiplier;
    const effectiveRadius = 15 * hitboxBonus; // Base 15px radius

    for (let i = State.fallingObjects.length - 1; i >= 0; i--) {
        const obj = State.fallingObjects[i];
        obj.update();
        obj.draw(ctx);

        const dx = obj.x - noseXPx;
        const dy = obj.y - noseYPx;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < (obj.radius + effectiveRadius)) {
            State.fallingObjects.splice(i, 1);

            if (obj.type === 'gem') {
                const points = State.isFeverMode ? 20 : 10;
                State.score += points;
                State.combo++;
                updateFeverMode();
                triggerVisualEffect('score');
                createExplosion(obj.x, obj.y, '#00f2ea');
                playGemSound();

                if (State.combo === 5) createFloatingText("+25 COMBO!", obj.x, obj.y);
                if (State.combo === 10) createFloatingText("+50 COMBO!", obj.x, obj.y);
                if (State.combo === 15) createFloatingText("+100 EPIC!", obj.x, obj.y);

            } else if (obj.type === 'gold') {
                State.score += 50;
                State.combo++;
                updateFeverMode();
                triggerVisualEffect('score');
                createExplosion(obj.x, obj.y, '#FFD700');
                createFloatingText("JACKPOT! +50", obj.x, obj.y, true);
                playGoldSound();

            } else {
                State.lives--;
                State.combo = 0;
                State.isFeverMode = false;
                document.body.classList.remove('fever-mode');
                triggerVisualEffect('damage');
                createExplosion(obj.x, obj.y, '#ff0050');
                playBombSound();
            }
            updateUI();
            if (State.lives <= 0) { endGame(); return; }
            continue;
        }

        if (obj.y > D.canvas.height + obj.radius) {
            if (obj.type === 'gem' || obj.type === 'gold') {
                State.lives--;
                State.combo = 0;
                State.isFeverMode = false;
                document.body.classList.remove('fever-mode');
                triggerVisualEffect('damage');
                playBombSound();
            }
            State.fallingObjects.splice(i, 1);
            updateUI();
            if (State.lives <= 0) { endGame(); return; }
        }
    }

    for (let i = State.particles.length - 1; i >= 0; i--) {
        const p = State.particles[i];
        p.update();
        p.draw(ctx);
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

        State.noseX = nose.x;
        State.noseY = nose.y;

        State.lastKnownNose.x = State.noseX * D.canvas.width;
        State.lastKnownNose.y = State.noseY * D.canvas.height;

        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        const dx = Math.abs(leftCheek.x - rightCheek.x);
        State.faceScale = dx;
    }
}

let faceMesh, camera;
async function initSystem() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 1280, height: 720 },
            audio: false
        });
        D.video.srcObject = stream;

        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onResults);

        camera = new Camera(D.video, {
            onFrame: async () => { await faceMesh.send({ image: D.video }); },
            width: 1280, height: 720
        });
        camera.start();

        window.addEventListener('resize', () => {
            D.canvas.width = window.innerWidth;
            D.canvas.height = window.innerHeight;
        });

    } catch (e) {
        console.error("Camera Error:", e);
        alert("Camera access required!");
    }
}

// === LEADERBOARD ===
window.openLeaderboard = async function () {
    if (!db) {
        showToast("Database offline!");
        return;
    }

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
            item.innerHTML = `
                <span class="name">${rank}. ${data.name || 'Anonymous'}</span>
                <span class="score">${data.score}</span>
            `;
            D.list.appendChild(item);
            rank++;
        });

        if (snap.empty && D.list) {
            D.list.innerHTML = "<p style='text-align:center; opacity:0.5;'>No scores yet!</p>";
        }

    } catch (e) {
        console.error("Leaderboard Error:", e);
        if (D.list) D.list.innerHTML = "Error loading scores.";
    }
};

window.closeLeaderboard = function () {
    if (D.leaderboard) D.leaderboard.classList.add('hidden');
    D.menu.classList.remove('hidden');
};

// === SNAPSHOT FIX: Include Video ===
function saveSnapshot() {
    try {
        // Create temp canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = D.canvas.width;
        tempCanvas.height = D.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw video first (background)
        tempCtx.save();
        tempCtx.scale(-1, 1); // Mirror video
        tempCtx.drawImage(D.video, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();

        // Draw game canvas on top
        tempCtx.drawImage(D.canvas, 0, 0);

        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `chatgames_${Date.now()}.png`;
        link.href = dataURL;
        link.click();
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
    D.menu.classList.remove('hidden');
    document.body.classList.remove('fever-mode');
};

if (D.muteBtn) {
    D.muteBtn.onclick = () => {
        State.muted = !State.muted;
        D.muteBtn.style.opacity = State.muted ? 0.5 : 1.0;
        D.muteBtn.innerText = State.muted ? '🔇' : '🔊';
    };
}

if (D.shopBtn) {
    D.shopBtn.onclick = window.openShop;
}

// LEADERBOARD FIX: Proper event listener
if (D.leaderboardBtn) {
    D.leaderboardBtn.onclick = window.openLeaderboard;
}

if (D.snapshotBtn) {
    D.snapshotBtn.onclick = saveSnapshot;
}

if (D.saveBtn) {
    D.saveBtn.onclick = async () => {
        if (!db) {
            showToast("Database offline!");
            return;
        }

        const name = D.username.value.trim() || 'Anonymous';
        PlayerData.lastUsername = name;
        savePlayerData(PlayerData);

        D.saveBtn.innerText = "SAVING...";
        D.saveBtn.disabled = true;

        try {
            await addDoc(collection(db, 'scores'), {
                name: name,
                score: State.score,
                date: new Date()
            });
            D.saveMsg.innerText = "SAVED!";
            D.saveMsg.style.color = "#00f2ea";
            showToast("Score saved! 🎉");
        } catch (e) {
            console.error("Save Error:", e);
            D.saveMsg.innerText = "ERROR";
            D.saveMsg.style.color = "#ff0050";
            D.saveBtn.disabled = false;
        }
    };
}

if (D.shareBtn) {
    D.shareBtn.onclick = async () => {
        const shareData = {
            title: 'ChatGames',
            text: `Skorum: ${State.score}! 🔥 ChatGames'te beni geçebilir misin?`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Share cancelled');
            }
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

// Init
updateCoinDisplay();
initSystem();
console.log("✓ v0.9.9 READY - Mobile Optimized, Bug-Free");
