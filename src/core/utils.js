// Pure utility functions

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

export function getPlayArea() {
    const MAX_PLAY_WIDTH = 600;
    const playWidth = Math.min(window.innerWidth, MAX_PLAY_WIDTH);
    const playXStart = (window.innerWidth - playWidth) / 2;
    return { playWidth, playXStart };
}
