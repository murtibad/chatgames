// ChatGames - Kamera Yönetimi
const videoElement = document.getElementById('videoElement');
const startButton = document.getElementById('startButton');
const videoOverlay = document.getElementById('videoOverlay');

let stream = null;
let isStreamActive = false;

/**
 * Kamerayı başlatır ve video akışını alır
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
        
        // Video elementine stream'i ata
        videoElement.srcObject = stream;
        
        // Video oynatmayı başlat
        await videoElement.play();
        
        // Overlay'i gizle
        videoOverlay.classList.add('hidden');
        
        // Stream aktif olarak işaretle
        isStreamActive = true;
        
        // Buton durumunu güncelle
        updateButtonState();
        
        console.log('✅ Kamera başarıyla başlatıldı');
        
    } catch (error) {
        console.error('❌ Kamera başlatma hatası:', error);
        handleCameraError(error);
    }
}

/**
 * Kamera akışını durdurur
 */
function stopCamera() {
    if (stream) {
        // Tüm track'leri durdur
        stream.getTracks().forEach(track => track.stop());
        
        // Video elementini temizle
        videoElement.srcObject = null;
        
        // Overlay'i göster
        videoOverlay.classList.remove('hidden');
        
        // Stream'i sıfırla
        stream = null;
        isStreamActive = false;
        
        // Buton durumunu güncelle
        updateButtonState();
        
        console.log('⏹️ Kamera durduruldu');
    }
}

/**
 * Buton durumunu günceller
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
            Kamerayı Durdur
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
            Kamerayı Başlat
        `;
        startButton.disabled = false;
    }
}

/**
 * Kamera hatalarını yönetir
 */
function handleCameraError(error) {
    let errorMessage = 'Kamera başlatılamadı. ';
    
    switch (error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            errorMessage += 'Kamera izni verilmedi. Lütfen tarayıcı ayarlarından kamera erişimine izin verin.';
            break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            errorMessage += 'Hiçbir kamera bulunamadı. Lütfen kameranızın bağlı olduğundan emin olun.';
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            errorMessage += 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
            break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
            errorMessage += 'Kamera talep edilen ayarları desteklemiyor.';
            break;
        case 'TypeError':
            errorMessage += 'Kamera ayarlarında bir hata oluştu.';
            break;
        default:
            errorMessage += `Hata: ${error.message}`;
    }
    
    alert(errorMessage);
    
    // Butonu yeniden etkinleştir
    startButton.disabled = false;
    updateButtonState();
}

/**
 * Buton tıklama olayını dinle
 */
startButton.addEventListener('click', () => {
    if (isStreamActive) {
        stopCamera();
    } else {
        startCamera();
    }
});

/**
 * Sayfa kapatılırken kamerayı durdur
 */
window.addEventListener('beforeunload', () => {
    if (isStreamActive) {
        stopCamera();
    }
});

/**
 * Video element hata kontrolü
 */
videoElement.addEventListener('error', (e) => {
    console.error('Video element hatası:', e);
});

// Başlangıç durumunu ayarla
console.log('🎮 ChatGames yüklendi');
