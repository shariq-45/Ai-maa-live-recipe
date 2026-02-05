// Live Recipe AI - Camera Module
// Handles camera access, video feed, and frame capture

class CameraManager {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.stream = null;
        this.isActive = false;
        this.constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment', // Prefer back camera
                frameRate: { ideal: 30 }
            }
        };
        this.captureCount = 0;
        this.maxCapturesPerMinute = 10; // Rate limiting for AI calls
        this.lastCaptureTime = 0;
        
        this.init();
    }
    
    // Initialize camera
    async init() {
        this.videoElement = document.getElementById('camera-feed');
        this.canvasElement = document.getElementById('frame-canvas');
        
        if (!this.videoElement || !this.canvasElement) {
            console.error('Camera elements not found');
            return;
        }
        
        // Set up canvas context
        this.canvasContext = this.canvasElement.getContext('2d');
        
        // Check camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Camera not supported in this browser');
            return;
        }
        
        // Update UI status
        this.updateCameraStatus(false, 'Initializing...');
        
        // Start with camera off by default
        // Will be turned on when cooking starts
        AppState.camera.isActive = false;
        AppState.preferences.cameraEnabled = false;
        
        this.updateUI();
    }
    
    // Start camera
    async startCamera() {
        if (this.isActive) {
            return true;
        }
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Camera API not available');
            return false;
        }
        
        try {
            // Request camera permission
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            
            // Set video source
            this.videoElement.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
            
            this.isActive = true;
            AppState.camera.isActive = true;
            AppState.camera.stream = this.stream;
            
            this.updateCameraStatus(true, 'Active');
            this.updateUI();
            
            console.log('Camera started successfully');
            return true;
            
        } catch (error) {
            console.error('Camera error:', error);
            this.handleCameraError(error);
            return false;
        }
    }
    
    // Stop camera
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        this.isActive = false;
        AppState.camera.isActive = false;
        
        this.updateCameraStatus(false, 'Off');
        this.updateUI();
        
        console.log('Camera stopped');
    }
    
    // Toggle camera on/off
    async toggleCamera() {
        if (this.isActive) {
            this.stopCamera();
            AppState.preferences.cameraEnabled = false;
        } else {
            const started = await this.startCamera();
            AppState.preferences.cameraEnabled = started;
        }
        
        AppState.savePreferences();
        return AppState.preferences.cameraEnabled;
    }
    
    // Capture current frame as base64 image
    captureFrame(quality = 0.7, maxWidth = 800) {
        if (!this.isActive || !this.videoElement) {
            this.showError('Camera not active');
            return null;
        }
        
        // Rate limiting
        const now = Date.now();
        if (now - this.lastCaptureTime < 6000) { // 6 seconds between captures
            this.showHint('Please wait a moment before another capture');
            return null;
        }
        
        // Get video dimensions
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        
        if (videoWidth === 0 || videoHeight === 0) {
            this.showError('Video not ready yet');
            return null;
        }
        
        // Calculate scaled dimensions
        const scale = maxWidth / videoWidth;
        const canvasWidth = maxWidth;
        const canvasHeight = videoHeight * scale;
        
        // Set canvas dimensions
        this.canvasElement.width = canvasWidth;
        this.canvasElement.height = canvasHeight;
        
        // Draw video frame to canvas
        this.canvasContext.drawImage(
            this.videoElement,
            0, 0, videoWidth, videoHeight,
            0, 0, canvasWidth, canvasHeight
        );
        
        // Convert to base64 JPEG
        const imageData = this.canvasElement.toDataURL('image/jpeg', quality);
        
        // Update stats
        this.captureCount++;
        this.lastCaptureTime = now;
        AppState.camera.captureCount = this.captureCount;
        AppState.camera.lastCapture = now;
        
        // Show capture feedback
        this.showHint('Frame captured! Sending to AI...');
        
        console.log(`Frame captured: ${Math.round(imageData.length / 1024)}KB`);
        return imageData;
    }
    
    // Capture and analyze with AI
    async captureAndAnalyze() {
        if (!AppState.preferences.cameraEnabled) {
            this.showError('Please enable camera first');
            return null;
        }
        
        // Show loading
        this.showHint('Analyzing your cooking...');
        
        // Capture frame
        const imageData = this.captureFrame();
        if (!imageData) {
            return null;
        }
        
        // Add to conversation
        AppState.addToConversation('user', '[Showed food to AI]');
        
        // Analyze with AI
        if (typeof window.analyzeImage === 'function') {
            const analysis = await window.analyzeImage(imageData);
            return analysis;
        }
        
        return null;
    }
    
    // Handle camera errors
    handleCameraError(error) {
        let errorMessage = 'Camera error: ';
        
        switch (error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                errorMessage += 'Camera permission denied. Please allow camera access in browser settings.';
                break;
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                errorMessage += 'No camera found. Please connect a camera.';
                break;
            case 'NotReadableError':
            case 'TrackStartError':
                errorMessage += 'Camera is in use by another application.';
                break;
            case 'OverconstrainedError':
                errorMessage += 'Camera constraints could not be satisfied.';
                break;
            case 'ConstraintNotSatisfiedError':
                errorMessage += 'Camera resolution not supported.';
                break;
            default:
                errorMessage += error.message || 'Unknown error';
        }
        
        this.showError(errorMessage);
        this.updateCameraStatus(false, 'Error');
        
        // Update AppState
        AppState.setError(errorMessage);
    }
    
    // Update camera status UI
    updateCameraStatus(active, message) {
        const statusElement = document.getElementById('camera-status');
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span');
            
            if (active) {
                statusElement.classList.remove('inactive');
                icon.style.color = 'var(--success-color)';
            } else {
                statusElement.classList.add('inactive');
                icon.style.color = 'var(--gray-color)';
            }
            
            if (text) {
                text.textContent = message;
            }
        }
    }
    
    // Update UI elements
    updateUI() {
        const toggleBtn = document.getElementById('toggle-camera');
        const captureBtn = document.getElementById('capture-frame');
        const cameraHint = document.getElementById('camera-hint');
        
        if (toggleBtn) {
            toggleBtn.innerHTML = this.isActive ? 
                '<i class="fas fa-camera-slash"></i>' : 
                '<i class="fas fa-camera"></i>';
            toggleBtn.title = this.isActive ? 'Turn Camera Off' : 'Turn Camera On';
        }
        
        if (captureBtn) {
            captureBtn.disabled = !this.isActive;
            if (!this.isActive) {
                captureBtn.classList.add('disabled');
            } else {
                captureBtn.classList.remove('disabled');
            }
        }
        
        if (cameraHint) {
            if (!this.isActive) {
                cameraHint.textContent = 'Camera is off. Turn on to show food.';
            } else if (this.captureCount === 0) {
                cameraHint.textContent = 'Camera is active. Say "dekho" to show food.';
            } else {
                cameraHint.textContent = 'Ready to capture. Hold food steady.';
            }
        }
    }
    
    // Show error message
    showError(message) {
        console.error('Camera Error:', message);
        
        // Show in UI if function exists
        if (typeof window.showError === 'function') {
            window.showError(message);
        }
        
        // Add to conversation
        AppState.addToConversation('system', `Camera: ${message}`);
    }
    
    // Show hint message
    showHint(message) {
        const cameraHint = document.getElementById('camera-hint');
        if (cameraHint) {
            cameraHint.textContent = message;
            
            // Clear after 3 seconds
            setTimeout(() => {
                if (cameraHint.textContent === message) {
                    this.updateUI();
                }
            }, 3000);
        }
    }
    
    // Clean up resources
    cleanup() {
        this.stopCamera();
        this.captureCount = 0;
        this.lastCaptureTime = 0;
    }
    
    // Check camera support
    checkSupport() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    
    // Get camera capabilities
    async getCapabilities() {
        if (!this.stream) return null;
        
        const videoTrack = this.stream.getVideoTracks()[0];
        if (!videoTrack) return null;
        
        return {
            width: videoTrack.getSettings().width,
            height: videoTrack.getSettings().height,
            frameRate: videoTrack.getSettings().frameRate,
            facingMode: videoTrack.getSettings().facingMode
        };
    }
}

// Create global instance
let cameraManager = null;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cameraManager = new CameraManager();
        window.cameraManager = cameraManager;
    });
} else {
    cameraManager = new CameraManager();
    window.cameraManager = cameraManager;
}

// Export functions for global use
window.startCamera = () => cameraManager?.startCamera();
window.stopCamera = () => cameraManager?.stopCamera();
window.toggleCamera = () => cameraManager?.toggleCamera();
window.captureFrame = (quality, maxWidth) => cameraManager?.captureFrame(quality, maxWidth);
window.captureAndAnalyze = () => cameraManager?.captureAndAnalyze();
