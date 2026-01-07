// Audio system with Web Audio API
// Preserves all setTimeout sequences for multi-note sounds

import { clamp } from '../core/utils.js';

class AudioManagerClass {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.muted = false;
        this.volume = 1.0;
    }

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
    }

    setVolume(value) {
        this.volume = clamp(parseFloat(value) || 0.5, 0, 1);
        if (this.masterGain) this.masterGain.gain.value = this.volume;
    }

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
    }

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
    }

    playGold() {
        if (!this.ctx || this.muted) return;
        try {
            this.init();
            const notes = [523.25, 659.25, 783.99];
            // IMPORTANT: Keep setTimeout for multi-note sequence (NOT for tracking debounce)
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
}

export const AudioManager = new AudioManagerClass();
