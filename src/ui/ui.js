// UI System - DOM manipulation, overlays, shop, leaderboard, settings
// All UI-related functions centralized here

import { State, Config, SHOP_ITEMS } from '../core/state.js';
import { AudioManager } from '../systems/audioManager.js';
import { clamp } from '../core/utils.js';

// LocalStorage
const STORAGE_KEY = 'chatgames_data';

export function loadPlayerData() {
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
        volume: 1.0,
        hasSeenTutorial: false
    };
}

export function savePlayerData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("localStorage save error:", e);
    }
}

export const PlayerData = loadPlayerData();

// Initialize from saved data
State.noseStyle = PlayerData.equippedSkin;
AudioManager.muted = false;
AudioManager.volume = PlayerData.volume;

// DOM helper
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`Missing: #${id}`);
    return el;
};

export const D = {
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
    tutorialOverlay: getEl('tutorial-overlay'),
    penaltyNotification: getEl('penalty-notification'),
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

// Distance checking with hysteresis
export function checkDistance(faceWidth, noseY) {
    const buffer = Config.DISTANCE.HYSTERESIS_BUFFER;

    if (noseY < Config.DISTANCE.TOO_HIGH) return 'TOO_HIGH';
    if (noseY > Config.DISTANCE.TOO_LOW) return 'TOO_LOW';

    if (State.isInWarningZone) {
        if (faceWidth >= Config.DISTANCE.TOO_FAR + buffer &&
            faceWidth <= Config.DISTANCE.TOO_CLOSE - buffer) {
            return 'IDEAL';
        }
    } else {
        if (faceWidth >= Config.DISTANCE.TOO_FAR &&
            faceWidth <= Config.DISTANCE.TOO_CLOSE) {
            return 'IDEAL';
        }
    }

    if (faceWidth < Config.DISTANCE.TOO_FAR) return 'TOO_FAR';
    if (faceWidth > Config.DISTANCE.TOO_CLOSE) return 'TOO_CLOSE';

    return 'IDEAL';
}

export function updateDistanceUI(status) {
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

export function updateHoldProgress(progress) {
    if (!D.progressRing) return;
    const circumference = 283;
    const offset = circumference - (progress * circumference);
    D.progressRing.style.strokeDashoffset = offset;
}

export function showProximityWarning(show) {
    if (!D.proximityWarning) return;
    if (show) D.proximityWarning.classList.remove('hidden');
    else D.proximityWarning.classList.add('hidden');
}

export function showDangerZone(show) {
    if (!D.dangerZone) return;
    if (show) D.dangerZone.classList.remove('hidden');
    else D.dangerZone.classList.add('hidden');
}

export function showPenaltyNotification(show) {
    if (!D.penaltyNotification) return;
    if (show) D.penaltyNotification.classList.remove('hidden');
    else D.penaltyNotification.classList.add('hidden');
}

export function updateUI() {
    if (D.scoreVal) D.scoreVal.innerText = State.score;
    if (D.livesDisplay) {
        let hearts = '';
        for (let i = 0; i < 3; i++) {
            hearts += i < State.lives ? '❤️' : '🖤';
        }
        D.livesDisplay.textContent = hearts;
    }
    updateCoinDisplay();
}

export function updateCoinDisplay() {
    if (D.coinCount) D.coinCount.innerText = PlayerData.totalCoins;
}

export function triggerVisualEffect(type) {
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

export function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export function endGame() {
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

// Shop system
export function renderShop() {
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

// Export for window binding (used by HTML)
export const uiHandlers = {
    openShop() {
        D.menu.classList.add('hidden');
        D.shop.classList.remove('hidden');
        renderShop();
    },
    closeShop() {
        D.shop.classList.add('hidden');
        D.menu.classList.remove('hidden');
    },
    openSettings() {
        if (D.settings) {
            D.settings.classList.remove('hidden');
            if (D.menu) D.menu.style.pointerEvents = 'none';
            if (D.gameOver) D.gameOver.style.pointerEvents = 'none';
        }
    },
    closeSettings() {
        if (D.settings) {
            D.settings.classList.add('hidden');
            if (D.menu) D.menu.style.pointerEvents = 'auto';
            if (D.gameOver) D.gameOver.style.pointerEvents = 'auto';
        }
    },
    closeTutorial() {
        if (D.tutorialOverlay) D.tutorialOverlay.classList.add('hidden');
        PlayerData.hasSeenTutorial = true;
        savePlayerData(PlayerData);

        if (D.distanceOverlay) D.distanceOverlay.classList.remove('hidden');
        State.waitingForIdealDistance = true;
        State.isDistanceIdeal = false;
        State.distanceHoldTime = 0;
        State.lastDistanceCheckTime = performance.now();

        if (D.holdProgress) D.holdProgress.classList.add('hidden');
        if (D.progressRing) updateHoldProgress(0);
    }
};
