// MediaPipe FaceMesh tracking with One Euro Filter smoothing
// Replaces fixed LERP (0.2 factor) with adaptive filtering

import { State, Config } from '../core/state.js';
import { checkDistance, updateDistanceUI, updateHoldProgress, showProximityWarning, showDangerZone, showPenaltyNotification } from '../ui/ui.js';

let faceMesh, camera;

export async function initTracking(videoElement, canvasElement, onReady) {
    try {
        // Mobile optimization: lower resolution for mobile devices
        const isMobile = window.innerWidth < 768;
        const videoWidth = isMobile ? 720 : 1280;
        const videoHeight = isMobile ? 480 : 720;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: videoWidth, height: videoHeight },
            audio: false
        });
        videoElement.srcObject = stream;

        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
        faceMesh.onResults((results) => onResults(results, canvasElement));

        camera = new Camera(videoElement, {
            onFrame: async () => { await faceMesh.send({ image: videoElement }); },
            width: 1280,
            height: 720
        });
        camera.start();

        window.addEventListener('resize', () => {
            canvasElement.width = window.innerWidth;
            canvasElement.height = window.innerHeight;
        });

        if (onReady) onReady();
    } catch (e) {
        console.error("Camera Error:", e);
        showCameraError();
    }
}

function onResults(results, canvasElement) {
    if (canvasElement.width !== window.innerWidth) {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
    }

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[4];

        // ONE EURO FILTER: Get timestamp once per frame (performance.now() in seconds)
        const t = performance.now() / 1000;

        // Seed filters on first face detection
        if (!State.filtersSeeded) {
            State.filters.noseX.reset(nose.x, t);
            State.filters.noseY.reset(nose.y, t);

            const leftCheek = landmarks[234];
            const rightCheek = landmarks[454];
            const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
            State.filters.faceScale.reset(faceWidth, t);

            State.filtersSeeded = true;
        }

        // ONE EURO FILTER: Replace LERP smoothing with adaptive filtering
        State.noseX = State.filters.noseX.filter(nose.x, t);
        State.noseY = State.filters.noseY.filter(nose.y, t);

        // Convert to pixel coordinates
        State.lastKnownNose.x = State.noseX * canvasElement.width;
        State.lastKnownNose.y = State.noseY * canvasElement.height;

        // Face scale detection
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        const faceWidth = Math.abs(rightCheek.x - leftCheek.x);

        // ONE EURO FILTER: Smooth face scale
        State.faceScale = State.filters.faceScale.filter(faceWidth, t);

        const distanceStatus = checkDistance(faceWidth, State.noseY);

        if (State.waitingForIdealDistance) {
            updateDistanceUI(distanceStatus);

            const now = performance.now();
            const deltaTime = now - State.lastDistanceCheckTime;
            State.lastDistanceCheckTime = now;

            if (distanceStatus === 'IDEAL') {
                const holdProgress = document.getElementById('hold-progress');
                if (holdProgress) holdProgress.classList.remove('hidden');

                State.distanceHoldTime += deltaTime;
                const progress = Math.min(State.distanceHoldTime / Config.DISTANCE.HOLD_DURATION, 1);
                updateHoldProgress(progress);

                if (State.distanceHoldTime >= Config.DISTANCE.HOLD_DURATION && !State.isCountingDown) {
                    // Trigger callback to begin countdown (handled in main app)
                    if (window.beginCountdown) window.beginCountdown();
                }
            } else {
                State.distanceHoldTime = 0;
                updateHoldProgress(0);
                const holdProgress = document.getElementById('hold-progress');
                if (holdProgress) holdProgress.classList.add('hidden');
            }
        } else if (State.isGameActive) {
            const now = performance.now();

            // HYSTERESIS with DEBOUNCING (200ms) - preserved from original
            const wasInWarningZone = State.isInWarningZone;
            const shouldBeInWarning = (distanceStatus !== 'IDEAL');

            if (shouldBeInWarning !== wasInWarningZone && now - State.lastWarningChange > 200) {
                State.isInWarningZone = shouldBeInWarning;
                State.lastWarningChange = now;
            }

            // ANTI-CHEAT: Track warning time
            if (State.isInWarningZone) {
                State.warningTime += (now - State.lastPenaltyCheck);
                showProximityWarning(true);

                // PENALTY MODE: 2s in warning = bomb rain
                if (State.warningTime >= Config.DISTANCE.PENALTY_THRESHOLD && !State.isPenaltyMode) {
                    State.isPenaltyMode = true;
                    showDangerZone(true);
                    showPenaltyNotification(true);
                }
            } else {
                State.warningTime = 0;
                if (State.isPenaltyMode) {
                    State.isPenaltyMode = false;
                    showDangerZone(false);
                    showPenaltyNotification(false);
                }
                showProximityWarning(false);
            }

            State.lastPenaltyCheck = now;
        }
    } else {
        // Face lost - reset seeding for clean restart
        State.filtersSeeded = false;
    }
}

function showCameraError() {
    const errorPanel = document.createElement('div');
    errorPanel.className = 'glass-panel';
    errorPanel.style.position = 'fixed';
    errorPanel.style.top = '50%';
    errorPanel.style.left = '50%';
    errorPanel.style.transform = 'translate(-50%, -50%)';
    errorPanel.style.zIndex = '10000';
    errorPanel.style.textAlign = 'center';
    errorPanel.style.padding = '2rem';

    const title = document.createElement('h2');
    title.style.color = '#ff0050';
    title.textContent = '⚠️ Camera Required';

    const message = document.createElement('p');
    message.textContent = 'Please allow camera access and refresh the page.';

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'btn-primary';
    reloadBtn.textContent = 'Reload Page';
    reloadBtn.addEventListener('click', () => location.reload());

    errorPanel.appendChild(title);
    errorPanel.appendChild(message);
    errorPanel.appendChild(reloadBtn);
    document.body.appendChild(errorPanel);
}
