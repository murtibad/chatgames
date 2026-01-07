// Centralized game state and configuration

import { OneEuroFilter } from '../filters/oneEuroFilter.js';

export const Config = {
    DISTANCE: {
        TOO_FAR: 0.15,
        TOO_CLOSE: 0.45,
        TOO_HIGH: 0.3,
        TOO_LOW: 0.7,
        HOLD_DURATION: 1500,
        PENALTY_THRESHOLD: 2000,
        HYSTERESIS_BUFFER: 0.1
    },
    MAX_PLAY_WIDTH: 600,
    FILTER_PARAMS: {
        nose: { minCutoff: 1.2, beta: 0.8, dCutoff: 1.0 },
        scale: { minCutoff: 1.0, beta: 0.3, dCutoff: 1.0 }
    }
};

export const State = {
    // Game state
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

    // Collections
    fallingObjects: [],
    particles: [],
    floatingTexts: [],

    // Face tracking
    noseX: 0.5,
    noseY: 0.5,
    faceScale: 0.1,
    lastKnownNose: { x: 0, y: 0 },

    // Filters (initialized with One Euro Filter)
    filters: {
        noseX: new OneEuroFilter(
            Config.FILTER_PARAMS.nose.minCutoff,
            Config.FILTER_PARAMS.nose.beta,
            Config.FILTER_PARAMS.nose.dCutoff
        ),
        noseY: new OneEuroFilter(
            Config.FILTER_PARAMS.nose.minCutoff,
            Config.FILTER_PARAMS.nose.beta,
            Config.FILTER_PARAMS.nose.dCutoff
        ),
        faceScale: new OneEuroFilter(
            Config.FILTER_PARAMS.scale.minCutoff,
            Config.FILTER_PARAMS.scale.beta,
            Config.FILTER_PARAMS.scale.dCutoff
        )
    },
    filtersSeeded: false,

    // UI state
    noseStyle: 'default',
    nosePulse: 0,
    waitingForIdealDistance: false,
    isDistanceIdeal: false,
    distanceHoldTime: 0,
    lastDistanceCheckTime: 0,
    scoreSaved: false,

    // Anti-cheat
    warningTime: 0,
    isPenaltyMode: false,
    lastPenaltyCheck: 0,
    isInWarningZone: false,
    lastWarningChange: 0
};

export const SHOP_ITEMS = [
    { id: 'default', name: 'Neon Dot', price: 0, color: '#00f2ea', type: 'circle', hitboxMultiplier: 1.0, ability: null, description: 'Classic cyan glow' },
    { id: 'clown', name: 'Clown Nose', price: 500, color: '#ff0050', type: 'circle', hitboxMultiplier: 1.3, ability: 'shield', description: '10% bomb shield' },
    { id: 'cyborg', name: 'Cyborg', price: 1000, color: '#00ff00', type: 'square', hitboxMultiplier: 1.6, ability: null, description: 'Tech precision' },
    { id: 'gold', name: 'Golden Touch', price: 2000, color: '#FFD700', type: 'circle', hitboxMultiplier: 2.0, ability: 'multiplier', description: '1.2x score boost' }
];
