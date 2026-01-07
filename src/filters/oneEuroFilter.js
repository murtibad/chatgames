// One Euro Filter (Casiez et al. 2012)
// Adaptive low-pass filter for jitter reduction with minimal lag

class LowPassFilter {
    constructor() {
        this.y = null;
        this.s = null;
    }

    reset() {
        this.y = null;
        this.s = null;
    }

    filter(value, alpha) {
        if (this.y === null) {
            this.s = value;
            this.y = value;
        } else {
            this.s = alpha * value + (1.0 - alpha) * this.s;
            this.y = this.s;
        }
        return this.y;
    }
}

export class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;

        this.x = new LowPassFilter();
        this.dx = new LowPassFilter();

        this.lastTime = null;
    }

    reset(value = null, timestamp = null) {
        this.x.reset();
        this.dx.reset();
        this.lastTime = timestamp;

        if (value !== null && timestamp !== null) {
            this.x.filter(value, 1.0);
        }
    }

    filter(value, timestamp) {
        // First call - initialize
        if (this.lastTime === null) {
            this.lastTime = timestamp;
            return this.x.filter(value, 1.0);
        }

        // Calculate time delta and frequency
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Handle edge case: no time passed
        if (dt <= 0) {
            return this.x.y !== null ? this.x.y : value;
        }

        const freq = 1.0 / dt;

        // Estimate derivative
        const dValue = this.x.y !== null ? (value - this.x.y) * freq : 0.0;
        const edValue = this.dx.filter(dValue, this.alpha(this.dCutoff, freq));

        // Calculate adaptive cutoff
        const cutoff = this.minCutoff + this.beta * Math.abs(edValue);

        // Filter the value
        return this.x.filter(value, this.alpha(cutoff, freq));
    }

    alpha(cutoff, freq) {
        const tau = 1.0 / (2.0 * Math.PI * cutoff);
        const te = 1.0 / freq;
        return 1.0 / (1.0 + tau / te);
    }
}
