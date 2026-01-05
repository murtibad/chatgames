// ChatGames - Camera Management & Face Tracking
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const startButton = document.getElementById('startButton');
const videoOverlay = document.getElementById('videoOverlay');

const canvasCtx = canvasElement.getContext('2d');

let stream = null;
let isStreamActive = false;
let faceMesh = null;
let camera = null;

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
    // Canvas boyutlarını ayarla
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // Canvas'ı temizle
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // If face is detected
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        // Burun ucu landmark'ı (index 4 - nose tip)
        const noseTip = landmarks[4];

        // Canvas koordinatlarını al
        const x = noseTip.x * canvasElement.width;
        const y = noseTip.y * canvasElement.height;

        // Draw red dot
        drawNoseDot(x, y);
    }

    canvasCtx.restore();
}

/**
 * Draws a red dot on the nose tip
 */
function drawNoseDot(x, y) {
    // Outer circle (glow effect)
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 15, 0, 2 * Math.PI);
    canvasCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    canvasCtx.fill();

    // Inner circle (main dot)
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 8, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#ef4444';
    canvasCtx.fill();

    // Center dot (highlight)
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 3, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#fca5a5';
    canvasCtx.fill();
}

/**
 * Starts the camera and gets video stream
 */
async function startCamera() {
    try {
        // Butonu devre dışı bırak
        startButton.disabled = true;
        startButton.textContent = 'Kamera Başlatılıyor...';

        // Kamera izni iste ve stream al
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

    } catch (error) {
        console.error('❌ Camera start error:', error);
        handleCameraError(error);
    }
}

/**
 * Stops the camera stream
 */
function stopCamera() {
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

    // Canvas'ı temizle
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Show overlay
    videoOverlay.classList.remove('hidden');

    // Reset stream
    isStreamActive = false;

    // Buton durumunu güncelle
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
            Stop Camera
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
            Start Camera
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
console.log('🎮 ChatGames loaded');
