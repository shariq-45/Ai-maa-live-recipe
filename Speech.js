// Live Recipe AI - Speech Module
// Handles Speech-to-Text and Text-to-Speech

class SpeechManager {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.utteranceQueue = [];
        this.recognitionLanguage = 'en-IN'; // Indian English for Hinglish support
        this.speechLanguage = 'en-IN';
        this.speechRate = 1.0;
        this.speechPitch = 1.0;
        
        this.init();
    }
    
    // Initialize speech modules
    init() {
        this.initSpeechRecognition();
        this.initSpeechSynthesis();
    }
    
    // Initialize Speech-to-Text
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported in this browser');
            this.updateSpeechStatus('mic', false, 'Not supported');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.recognitionLanguage;
        this.recognition.maxAlternatives = 3;
        
        // Set up event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateSpeechStatus('mic', true, 'Listening...');
            if (typeof window.onSpeechStart === 'function') {
                window.onSpeechStart();
            }
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const confidence = event.results[0][0].confidence;
            
            // Only accept if confidence is reasonable
            if (confidence > 0.5 || transcript.length > 2) {
                if (typeof window.onSpeechResult === 'function') {
                    window.onSpeechResult(transcript, confidence);
                }
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateSpeechStatus('mic', false, 'Error: ' + event.error);
            
            if (event.error === 'not-allowed') {
                this.showPermissionError('microphone');
            }
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateSpeechStatus('mic', false, 'Ready');
            if (typeof window.onSpeechEnd === 'function') {
                window.onSpeechEnd();
            }
        };
        
        this.updateSpeechStatus('mic', false, 'Ready');
    }
    
    // Initialize Text-to-Speech
    initSpeechSynthesis() {
        if (!this.synthesis) {
            console.warn('Speech synthesis not supported in this browser');
            this.updateSpeechStatus('speech', false, 'Not supported');
            return;
        }
        
        // Check available voices
        this.loadVoices();
        
        // Re-load voices when changed
        this.synthesis.onvoiceschanged = () => this.loadVoices();
        
        this.updateSpeechStatus('speech', true, 'Ready');
    }
    
    // Load available voices
    loadVoices() {
        this.voices = this.synthesis.getVoices();
        
        // Try to find Indian English or female voices
        this.selectedVoice = this.voices.find(voice => 
            voice.lang.includes('IN') || voice.lang.includes('en-')
        ) || this.voices[0];
    }
    
    // Start listening
    startListening() {
        if (!this.recognition) {
            console.error('Speech recognition not initialized');
            return false;
        }
        
        if (this.isListening) {
            this.stopListening();
            return false;
        }
        
        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            return false;
        }
    }
    
    // Stop listening
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    // Speak text
    speak(text, callback = null) {
        if (!this.synthesis || !AppState.preferences.aiSpeechEnabled) {
            if (callback) callback();
            return;
        }
        
        // Don't speak if already speaking the same text
        if (this.isSpeaking && this.currentUtterance?.text === text) {
            return;
        }
        
        // Stop any ongoing speech
        this.stopSpeaking();
        
        // Create new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure utterance
        utterance.voice = this.selectedVoice;
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;
        utterance.lang = this.speechLanguage;
        
        // Set up event handlers
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.currentUtterance = utterance;
            this.updateSpeechStatus('speech', true, 'Speaking...');
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.updateSpeechStatus('speech', true, 'Ready');
            
            // Process next in queue
            if (this.utteranceQueue.length > 0) {
                const nextText = this.utteranceQueue.shift();
                this.speak(nextText, callback);
            } else if (callback) {
                callback();
            }
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.updateSpeechStatus('speech', true, 'Error');
            
            // Try next in queue
            if (this.utteranceQueue.length > 0) {
                const nextText = this.utteranceQueue.shift();
                this.speak(nextText, callback);
            } else if (callback) {
                callback();
            }
        };
        
        // Speak immediately
        this.synthesis.speak(utterance);
    }
    
    // Queue text for speaking
    queueSpeech(text) {
        if (this.isSpeaking) {
            this.utteranceQueue.push(text);
        } else {
            this.speak(text);
        }
    }
    
    // Stop speaking
    stopSpeaking() {
        if (this.synthesis && this.isSpeaking) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.utteranceQueue = [];
            this.updateSpeechStatus('speech', true, 'Stopped');
        }
    }
    
    // Toggle speech on/off
    toggleSpeech() {
        AppState.preferences.aiSpeechEnabled = !AppState.preferences.aiSpeechEnabled;
        AppState.savePreferences();
        
        if (!AppState.preferences.aiSpeechEnabled) {
            this.stopSpeaking();
        }
        
        this.updateSpeechStatus('speech', AppState.preferences.aiSpeechEnabled, 
            AppState.preferences.aiSpeechEnabled ? 'Ready' : 'Disabled');
        
        return AppState.preferences.aiSpeechEnabled;
    }
    
    // Update UI status
    updateSpeechStatus(type, active, message) {
        const statusElement = document.getElementById(`${type}-status`);
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
            
            // Update AppState
            if (type === 'mic') {
                AppState.speech.recognitionActive = active;
            }
        }
    }
    
    // Show permission error
    showPermissionError(permissionType) {
        const errorMsg = `Please allow ${permissionType} access in your browser settings to use this feature.`;
        
        if (typeof window.showError === 'function') {
            window.showError(errorMsg);
        }
        
        AppState.addToConversation('system', `Permission needed: ${errorMsg}`);
    }
    
    // Check browser support
    checkSupport() {
        const support = {
            speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
            speechSynthesis: !!window.speechSynthesis
        };
        
        return support;
    }
    
    // Set language
    setLanguage(lang) {
        if (this.recognition) {
            this.recognitionLanguage = lang;
            this.recognition.lang = lang;
        }
        this.speechLanguage = lang;
    }
    
    // Clean up
    cleanup() {
        this.stopListening();
        this.stopSpeaking();
        this.utteranceQueue = [];
    }
}

// Create global instance
let speechManager = null;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        speechManager = new SpeechManager();
        window.speechManager = speechManager;
    });
} else {
    speechManager = new SpeechManager();
    window.speechManager = speechManager;
}

// Export functions for global use
window.startListening = () => speechManager?.startListening();
window.stopListening = () => speechManager?.stopListening();
window.speakText = (text, callback) => speechManager?.speak(text, callback);
window.queueSpeech = (text) => speechManager?.queueSpeech(text);
window.toggleSpeech = () => speechManager?.toggleSpeech();
