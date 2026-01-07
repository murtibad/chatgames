// Main game loop

import { State, SHOP_ITEMS } from '../core/state.js';
import { FallingObject, createExplosion, createFloatingText, updateFeverMode } from './gameplay.js';
import { drawNose } from './render.js';
import { triggerVisualEffect, updateUI, endGame } from '../ui/ui.js';
import { AudioManager } from '../systems/audioManager.js';
import { getPlayArea } from '../core/utils.js';

export function gameLoop(canvas, ctx) {
    if (!State.isGameActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const noseXPx = State.lastKnownNose.x;
    const noseYPx = State.lastKnownNose.y;

    // Draw player nose/reticle
    drawNose(ctx, canvas.width, canvas.height);

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

        const obj = new FallingObject(canvas.width, canvas.height, type, State.speedMultiplier, safeWidthRatio);
        State.fallingObjects.push(obj);
        State.lastSpawnTime = now;
    }

    const skinData = SHOP_ITEMS.find(s => s.id === State.noseStyle) || SHOP_ITEMS[0];
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

        if (obj.y > canvas.height + obj.radius + 100) {
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

    requestAnimationFrame(() => gameLoop(canvas, ctx));
}
