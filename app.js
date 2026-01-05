// ChatGames - Camera Management & Face Tracking with Game Loop
// Screen elements
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');

// Game elements
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
const menuButton = document.getElementById('menuButton');
const menuButtonGameOver = document.getElementById('menuButtonGameOver');

const canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });

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
    speedMultiplier: 1.0, // Difficulty scaling (increases every 10 points)
    floatingTexts: [], // Array of floating feedback texts
    animationFrameId: null
};

/**
 * Falling Object Class
 */
class FallingObject {
    constructor(canvasWidth, speedMultiplier = 1.0) {
        this.x = Math.random() * (canvasWidth - 60) + 30; // Random x position with padding
        this.y = -30; // Start above canvas
        this.radius = 15 + Math.random() * 10; // Random radius between 15-25

        // 20% chance of bad object (bomb)
        this.type = Math.random() < 0.2 ? 'bad' : 'good';

        // Set color based on type
        this.color = this.type === 'good' ? this.getRandomGoodColor() : this.getBadColor();

        // Apply speed multiplier
        this.speed = (2 + Math.random() * 2) * speedMultiplier; // Base speed 2-4, scaled by multiplier
    }

    /**
     * Gets a random good object color (green, blue, purple)
     */
    getRandomGoodColor() {
        const goodColors = [
            '#10b981', // Green
            '#3b82f6', // Blue
            '#8b5cf6', // Purple
            '#14b8a6', // Teal
            '#06b6d4'  // Cyan
        ];
        return goodColors[Math.floor(Math.random() * goodColors.length)];
    }

    /**
     * Gets bad object color (dark red/black)
     */
    getBadColor() {
        const badColors = [
            '#991b1b', // Dark red
            '#7f1d1d', // Darker red
            '#1f2937'  // Dark gray (almost black)
        ];
        return badColors[Math.floor(Math.random() * badColors.length)];
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
        if (this.type === 'bad') {
            // Draw bomb with red glow
            // Outer red glow
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red glow
            ctx.fill();

            // Middle glow
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.fill();
        } else {
            // Normal glow for good objects
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, 2 * Math.PI);
            ctx.fillStyle = this.color + '40'; // Add transparency
            ctx.fill();
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Draw bomb symbol for bad objects
        if (this.type === 'bad') {
            // Draw bomb emoji
            ctx.fillStyle = '#ef4444';
            ctx.font = `bold ${this.radius}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', this.x, this.y);
        } else {
            // Inner highlight for good objects
            ctx.beginPath();
            ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.3, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }
    }

    /**
     * Checks if object is off-screen
     */
    isOffScreen(canvasHeight) {
        return this.y - this.radius > canvasHeight;
    }
}

/**
 * Floating Text Class (for visual feedback)
 */
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.opacity = 1.0;
        this.lifetime = 60; // 60 frames (~1 second at 60fps)
        this.age = 0;
    }

    /**
     * Updates text position and opacity
     */
    update() {
        this.y -= 2; // Float upwards
        this.age++;
        this.opacity = 1.0 - (this.age / this.lifetime);
    }

    /**
     * Draws the floating text
     */
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw text with shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);

        ctx.restore();
    }

    /**
     * Checks if text should be removed
     */
    isDead() {
        return this.age >= this.lifetime;
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
}

/**
 * Processes FaceMesh results
 */
function onFaceMeshResults(results) {
    // Set canvas dimensions
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // Prevent processing if canvas is not ready
    if (!canvasElement.height || canvasElement.height === 0) {
        return;
    }

    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // If face is detected
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Nose tip landmark (index 4 - nose tip)
        const noseTip = landmarks[4];

        // Get canvas coordinates (use raw values, CSS handles mirroring)
        // MediaPipe gives us 0-1 values, CSS transform: scaleX(-1) mirrors the display
        const x = noseTip.x * canvasElement.width;
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
    const newObject = new FallingObject(canvasElement.width, gameState.speedMultiplier);
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
            // Only lose life for good objects that escape
            if (obj.type === 'good') {
                gameState.lives--;
                updateLivesDisplay();


                // Check for game over
                if (gameState.lives <= 0) {
                    gameOver();
                }
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
            // Collision detected!
            if (obj.type === 'good') {
                // Good object: +1 score
                gameState.score++;
                updateScoreDisplay();

                // Create floating text feedback
                const floatingText = new FloatingText(obj.x, obj.y, '+1', '#10b981');
                gameState.floatingTexts.push(floatingText);

                // Check for difficulty increase (every 10 points)
                if (gameState.score % 10 === 0 && gameState.score > 0) {
                    gameState.speedMultiplier *= 1.1;

                    // Show level up text
                    const levelUpText = new FloatingText(
                        canvasElement.width / 2,
                        canvasElement.height / 2,
                        'SPEED UP!',
                        '#f59e0b'
                    );
                    gameState.floatingTexts.push(levelUpText);
                }

                console.log(`💯 Score: ${gameState.score}`);
            } else {
                // Bad object (bomb): -2 lives
                gameState.lives -= 2;
                updateLivesDisplay();

                // Create floating text feedback
                const floatingText = new FloatingText(obj.x, obj.y, '-2 HP', '#ef4444');
                gameState.floatingTexts.push(floatingText);



                // Check for game over
                if (gameState.lives <= 0) {
                    gameOver();
                }
            }

            return false; // Remove collected/hit object
        }

        return true; // Keep object in array
    });

    // Update floating texts
    gameState.floatingTexts.forEach(text => text.update());
    gameState.floatingTexts = gameState.floatingTexts.filter(text => !text.isDead());

    // Continue game loop
    gameState.animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Draws all game elements (nose tracker + falling objects + floating texts)
 */
function drawGameElements() {
    // Draw all falling objects
    gameState.fallingObjects.forEach(obj => {
        obj.draw(canvasCtx);
    });

    // Draw all floating texts
    gameState.floatingTexts.forEach(text => {
        text.draw(canvasCtx);
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
    // Wait for video to be ready before starting game
    if (videoElement.readyState < 2) {
        // Video not ready yet, wait and retry
        setTimeout(startGame, 100);
        return;
    }



    // Reset game state
    gameState.score = 0;
    gameState.lives = gameState.maxLives;
    gameState.isGameActive = true;
    gameState.fallingObjects = [];
    gameState.floatingTexts = [];
    gameState.speedMultiplier = 1.0;
    gameState.lastSpawnTime = performance.now();

    // Update UI
    updateScoreDisplay();
    updateLivesDisplay();
    scoreDisplay.style.display = 'block';

    // Start game loop
    gameState.animationFrameId = requestAnimationFrame(gameLoop);


}

/**
 * Stops the game
 */
function stopGame() {


    gameState.isGameActive = false;
    gameState.fallingObjects = [];
    gameState.floatingTexts = [];

    // Cancel animation frame
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    // Hide score display
    scoreDisplay.style.display = 'none';


}

/**
 * Triggers game over state
 */
function gameOver() {
    // Stop the game loop
    gameState.isGameActive = false;
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }

    // Show game over modal
    finalScoreValue.textContent = gameState.score;
    gameOverOverlay.classList.add('active');


}

/**
 * Restarts the game
 */
function restartGame() {


    // Hide game over modal
    gameOverOverlay.classList.remove('active');

    // Reset game state
    gameState.score = 0;
    gameState.lives = gameState.maxLives;
    gameState.fallingObjects = [];
    gameState.floatingTexts = [];
    gameState.speedMultiplier = 1.0;
    gameState.lastSpawnTime = performance.now();

    // Update UI
    updateScoreDisplay();
    updateLivesDisplay();

    // Start game
    startGame();
}

/**
 * Starts the camera and gets video stream
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

/**
 * Menu button listeners
 */
menuButton.addEventListener('click', () => {
    returnToMenu();
});

menuButtonGameOver.addEventListener('click', () => {
    returnToMenu();
});

// ===== NAVIGATION FUNCTIONS =====

/**
 * Initializes and starts the game
 */
function initGame(gameName) {
    // Hide menu, show game screen
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    // Start camera and game
    startCamera();
}

/**
 * Returns to main menu
 */
function returnToMenu() {
    // Stop camera and game
    stopCamera();

    // Hide game over modal if visible
    gameOverOverlay.classList.remove('active');

    // Show menu, hide game screen
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';


}

// Set initial state
scoreDisplay.style.display = 'none'; // Hide score initially
console.log('🎮 ChatGames Platform loaded - v0.3.3');

