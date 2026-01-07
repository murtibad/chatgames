// Canvas rendering functions

import { State, SHOP_ITEMS } from '../core/state.js';

export function drawNose(ctx, canvasWidth, canvasHeight) {
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
}
