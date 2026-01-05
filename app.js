// ChatGames - Camera Management & Face Tracking with Game Loop
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const startButton = document.getElementById('startButton');
const videoOverlay = document.getElementById('videoOverlay');
const scoreDisplay = document.getElementById('scoreDisplay');
const scoreValue = document.getElementById('scoreValue');
const livesDisplay = document.getElementById('livesDisplay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreValue = document.getElementById('finalScoreValue');
const restartButton = document.getElementById('restartButton');

const canvasCtx = canvasElement.getContext('2d');

let stream = null;
let isStreamActive = false;
let faceMesh = null;
let camera = null;

// ===== GAME STATE =====
const gameState = {
    score: 0,
    lives: 3,
    maxLives: 3,
    isGameActive: false,
    fallingObjects: [],
    nosePosition: { x: 0, y: 0 },
    noseRadius: 20,
    lastSpawnTime: 0,
    spawnInterval: 1500, // Spawn new object every 1.5 seconds
    animationFrameId: null
};

/**
 * Falling Object Class
 */
class FallingObject {
    constructor(canvasWidth) {
        this.x = Math.random() * (canvasWidth - 60) + 30; // Random x position with padding
        this.y = -30; // Start above canvas
        this.radius = 15 + Math.random() * 10; // Random radius between 15-25
        this.speed = 2 + Math.random() * 2; // Random speed between 2-4
        this.color = this.getRandomColor();
    }

    /**
     * Gets a random vibrant color
     */
    getRandomColor() {
        const colors = [
            '#ef4444', // Red
            '#f59e0b', // Orange
            '#10b981', // Green
            '#3b82f6', // Blue
            '#8b5cf6', // Purple
            '#ec4899', // Pink
            '#14b8a6'  // Teal
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Updates object position
     */
    update() {
        this.y += this.speed;
    }

    /**
     * Draws the object on canvas
     */
    draw(ctx) {
        // Outer glow
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 5, 0, 2 * Math.PI);
        ctx.fillStyle = this.color + '40'; // Add transparency
        ctx.fill();

        // Main circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
    }

    /**
     * Checks if object is off-screen
     */
    isOffScreen(canvasHeight) {
        return this.y - this.radius > canvasHeight;
    }
}

/**
 * Initializes MediaPipe FaceMesh
 */
function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceMeshResults);

    console.log('🎭 MediaPipe FaceMesh initialized');
}

/**
 * Processes FaceMesh results
 */
function onFaceMeshResults(results) {
    // Set canvas dimensions
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // If face is detected
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Nose tip landmark (index 4 - nose tip)
        const noseTip = landmarks[4];

        // Get canvas coordinates and invert X for mirror mode
        // MediaPipe gives us 0-1 values, we invert X to match the mirrored display
        const x = (1 - noseTip.x) * canvasElement.width;
        const y = noseTip.y * canvasElement.height;

        // Update game state nose position
        gameState.nosePosition.x = x;
        gameState.nosePosition.y = y;

        // Draw game elements if game is active
        if (gameState.isGameActive) {
            drawGameElements();
        } else {
            // Just draw the nose tracking dot when game is not active
            drawNoseDot(x, y);
        }
    }

    canvasCtx.restore();
}

/**
 * Draws a red dot on the nose tip
 */
function drawNoseDot(x, y) {
    // Outer circle (glow effect)
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, gameState.noseRadius, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    canvasCtx.fill();

    // Inner circle (main dot)
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, gameState.noseRadius * 0.6, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#ef4444';
    canvasCtx.fill();

    // Center dot (highlight)
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, gameState.noseRadius * 0.3, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#fca5a5';
    canvasCtx.fill();
}

/**
 * Spawns a new falling object
 */
function spawnFallingObject() {
    const newObject = new FallingObject(canvasElement.width);
    gameState.fallingObjects.push(newObject);
}

/**
 * Main game loop - updates and renders game state
 */
function gameLoop(timestamp) {
    if (!gameState.isGameActive) return;

    // Spawn new objects at intervals
    if (timestamp - gameState.lastSpawnTime > gameState.spawnInterval) {
        spawnFallingObject();
        gameState.lastSpawnTime = timestamp;
    }

    // Update falling objects
    gameState.fallingObjects.forEach(obj => obj.update());

    // Check collisions and remove collected/off-screen objects
    gameState.fallingObjects = gameState.fallingObjects.filter(obj => {
        // Check if object is off screen
        if (obj.isOffScreen(canvasElement.height)) {
            // Object escaped! Lose a life
            gameState.lives--;
            updateLivesDisplay();
            console.log(`💔 Lost a life! Lives remaining: ${gameState.lives}`);

            // Check for game over
            if (gameState.lives <= 0) {
                gameOver();
            }

            return false; // Remove from array
        }

        // Calculate distance between nose and object using Euclidean distance
        const distance = Math.hypot(
            gameState.nosePosition.x - obj.x,
            gameState.nosePosition.y - obj.y
        );

        // Check collision
        if (distance < (gameState.noseRadius + obj.radius)) {
            // Collision detected! Increment score
            gameState.score++;
            updateScoreDisplay();
            console.log(`💯 Score: ${gameState.score}`);
            return false; // Remove collected object
        }

        return true; // Keep object in array
    });

    // Continue game loop
    gameState.animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Draws all game elements (nose tracker + falling objects)
 */
function drawGameElements() {
    // Draw all falling objects
    gameState.fallingObjects.forEach(obj => {
        obj.draw(canvasCtx);
    });

    // Draw nose tracker on top
    drawNoseDot(gameState.nosePosition.x, gameState.nosePosition.y);
}

/**
 * Updates the score display UI
 */
function updateScoreDisplay() {
    scoreValue.textContent = gameState.score;
}

/**
 * Updates the lives display UI
 */
function updateLivesDisplay() {
    const hearts = livesDisplay.querySelectorAll('.heart');
    hearts.forEach((heart, index) => {
        if (index >= gameState.lives) {
            heart.classList.add('lost');
        } else {
            heart.classList.remove('lost');
        }
    });
}

/**
 * Starts the game
 */
function startGame() {
    console.log('🎮 Starting game...');

    // Reset game state
    gameState.score = 0;
    gameState.isGameActive = true;
    gameState.fallingObjects = [];
    gameState.lastSpawnTime = performance.now();

    // Update UI
    updateScoreDisplay();
    scoreDisplay.style.display = 'block';

    // Start game loop
    gameState.animationFrameId = requestAnimationFrame(gameLoop);

    console.log('✅ Game started!');
}

/**
 * Stops the game
 */
function stopGame() {
    console.log('⏹️ Stopping game...');

    gameState.isGameActive = false;
    gameState.fallingObjects = [];

    // Cancel animation frame
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    // Hide score display
    scoreDisplay.style.display = 'none';

    console.log(`Final score: ${gameState.score}`);
}

/**
 * Triggers game over state
 */
function gameOver() {
    console.log('💀 Game Over!');

    // Stop the game loop
    gameState.isGameActive = false;
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    // Show game over modal
    finalScoreValue.textContent = gameState.score;
    gameOverOverlay.classList.add('active');

    console.log(`Final Score: ${gameState.score}`);
}

/**
 * Restarts the game
 */
function restartGame() {
    console.log('🔄 Restarting game...');

    // Hide game over modal
    gameOverOverlay.classList.remove('active');

    // Reset game state
    gameState.score = 0;
    gameState.lives = gameState.maxLives;
    gameState.fallingObjects = [];
    gameState.lastSpawnTime = performance.now();

    // Update UI
    updateScoreDisplay();
    updateLivesDisplay();

    // Start game
    startGame();
}\r\n\r\n/**\r\n * Starts the camera and gets video stream
 */
async function startCamera() {
    try {
        // Disable button
        startButton.disabled = true;
        startButton.textContent = 'Starting Camera...';

        // Request camera permission and get stream
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        });

        // Assign stream to video element
        videoElement.srcObject = stream;

        // Start video playback
        await videoElement.play();

        // Hide overlay
        videoOverlay.classList.add('hidden');

        // Mark stream as active
        isStreamActive = true;

        // Initialize MediaPipe FaceMesh
        if (!faceMesh) {
            initializeFaceMesh();
        }

        // Connect camera with FaceMesh
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });
        camera.start();

        // Update button state
        updateButtonState();

        console.log('✅ Camera started successfully');
        console.log('👃 Nose tracking active');

        // Start the game
        startGame();

    } catch (error) {
        console.error('❌ Camera start error:', error);
        handleCameraError(error);
    }
}

/**
 * Stops the camera stream
 */
function stopCamera() {
    // Stop game first
    stopGame();

    // Stop camera
    if (camera) {
        camera.stop();
        camera = null;
    }

    // Stop stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        stream = null;
    }

    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Show overlay
    videoOverlay.classList.remove('hidden');

    // Reset stream
    isStreamActive = false;

    // Update button state
    updateButtonState();

    console.log('⏹️ Camera stopped');
}

/**
 * Updates button state
 */
function updateButtonState() {
    if (isStreamActive) {
        startButton.innerHTML = `
            <span class="btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            </span>
            Stop Game
        `;
        startButton.disabled = false;
    } else {
        startButton.innerHTML = `
            <span class="btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            </span>
            Start Game
        `;
        startButton.disabled = false;
    }
}

/**
 * Handles camera errors
 */
function handleCameraError(error) {
    let errorMessage = 'Failed to start camera. ';

    switch (error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            errorMessage += 'Camera permission denied. Please allow camera access in browser settings.';
            break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            errorMessage += 'No camera found. Please ensure your camera is connected.';
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            errorMessage += 'Camera may be in use by another application.';
            break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
            errorMessage += 'Camera does not support the requested settings.';
            break;
        case 'TypeError':
            errorMessage += 'An error occurred in camera settings.';
            break;
        default:
            errorMessage += `Error: ${error.message}`;
    }

    alert(errorMessage);

    // Re-enable button
    startButton.disabled = false;
    updateButtonState();
}

/**
 * Listen for button click event
 */
startButton.addEventListener('click', () => {
    if (isStreamActive) {
        stopCamera();
    } else {
        startCamera();
    }
});

/**
 * Listen for restart button click
 */
restartButton.addEventListener('click', () => {
    restartGame();
});

/**
 * Stop camera when page is closed
 */
window.addEventListener('beforeunload', () => {
    if (isStreamActive) {
        stopCamera();
    }
});

/**
 * Video element error handling
 */
videoElement.addEventListener('error', (e) => {
    console.error('Video element error:', e);
});

// Set initial state
scoreDisplay.style.display = 'none'; // Hide score initially
console.log('🎮 ChatGames loaded - v0.1.1 Alpha');
