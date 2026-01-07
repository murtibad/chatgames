// Game classes and entities

import { getPlayArea } from '../core/utils.js';
import { State, SHOP_ITEMS } from '../core/state.js';

export class Particle {
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

export class FallingObject {
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
        let sprite = window.bombSprite;
        if (this.type === 'gem') sprite = window.diamondSprite;
        if (this.type === 'gold') sprite = window.goldDiamondSprite;
        if (sprite) {
            ctx.drawImage(sprite, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        }
    }
}

export function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) State.particles.push(new Particle(x, y, color));
}

export function createFloatingText(text, x, y, isJackpot = false) {
    const el = document.createElement('div');
    el.className = 'floating-text' + (isJackpot ? ' jackpot' : '');
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

export function updateFeverMode() {
    if (State.combo >= 10 && !State.isFeverMode) {
        State.isFeverMode = true;
        document.body.classList.add('fever-mode');
        createFloatingText("FEVER MODE! 2x", window.innerWidth / 2, window.innerHeight / 2);
    } else if (State.combo < 10 && State.isFeverMode) {
        State.isFeverMode = false;
        document.body.classList.remove('fever-mode');
    }
}
