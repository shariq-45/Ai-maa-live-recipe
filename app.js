// Live Recipe AI - Main Application
// Orchestrates all modules and manages user experience

class LiveRecipeAI {
    constructor() {
        this.isInitialized = false;
        this.voiceButtonHoldTimer = null;
        this.currentOperation = null;
        this.init();
    }
    
    // Initialize the application
    async init() {
        console.log('Initializing Live Recipe AI...');
        
        // Show loading overlay
        this.showLoading('Starting ChefMate...');
        
        // Initialize state first
        if (!window.AppState) {
            console.error('State module not loaded');
            this.showError('Application state failed to load');
            return;
        }
        
        // Wait a moment for all modules to load
        await this.delay(1000);
        
        // Check browser compatibility
        if (!this.checkCompatibility()) {
            this.hideLoading();
            return;
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize modules
        await this.initializeModules();
        
        // Update UI with initial state
        this.updateUIFromState(AppState);
        
        // Hide loading overlay
        this.hideLoading();
        
        this.isInitialized = true;
        console.log('Live Recipe AI initialized successfully');
        
        // Welcome message
        this.speakWelcome();
    }
    
    // Check browser compatibility
    checkCompatibility() {
        const issues = [];
        
        // Check for required APIs
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            issues.push('Camera API not supported');
        }
        
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            issues.push('Speech recognition not supported');
        }
        
        if (!window.speechSynthesis) {
            issues.push('Text-to-speech not supported');
        }
        
        if (issues.length > 0) {
            const errorMsg = `Browser compatibility issues:\n${issues.join('\n')}\n\nPlease use Chrome, Edge, or Safari for best experience.`;
            this.showError(errorMsg);
            return false;
        }
        
        return true;
    }
    
    // Initialize all modules
    async initializeModules() {
        try {
            // Initialize speech module
            if (!window.speechManager) {
                console.warn('Speech module not yet loaded');
                await this.delay(500);
            }
            
            // Initialize camera module
            if (!window.cameraManager) {
                console.warn('Camera module not yet loaded');
                await this.delay(500);
            }
            
            // Initialize AI module
            if (!window.aiManager) {
                console.warn('AI module not yet loaded');
                await this.delay(500);
            }
            
            // Check AI initialization
            if (window.aiManager && !window.aiManager.isInitialized) {
                AppState.addToConversation('system', 'AI module waiting for API key');
            }
            
            // Update connection status
            this.updateConnectionStatus();
            
        } catch (error) {
            console.error('Module initialization failed:', error);
            this.showError(`Initialization error: ${error.message}`);
        }
    }
    
    // Set up all event listeners
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Speech recognition events
        window.onSpeechStart = this.onSpeechStart.bind(this);
        window.onSpeechResult = this.onSpeechResult.bind(this);
        window.onSpeechEnd = this.onSpeechEnd.bind(this);
        
        // Main control buttons
        document.getElementById('start-cooking').addEventListener('click', this.startCooking.bind(this));
        document.getElementById('pause-cooking').addEventListener('click', this.togglePause.bind(this));
        document.getElementById('reset-cooking').addEventListener('click', this.resetCooking.bind(this));
        
        // Navigation buttons
        document.getElementById('prev-step').addEventListener('click', this.prevStep.bind(this));
        document.getElementById('next-step').addEventListener('click', this.nextStep.bind(this));
        
        // Camera controls
        document.getElementById('toggle-camera').addEventListener('click', this.toggleCamera.bind(this));
        document.getElementById('capture-frame').addEventListener('click', this.captureAndAnalyze.bind(this));
        
        // Speech controls
        document.getElementById('toggle-mic').addEventListener('click', this.toggleMicrophone.bind(this));
        document.getElementById('toggle-ai-speech').addEventListener('click', this.toggleAISpeech.bind(this));
        
        // Voice input button (hold to talk)
        const voiceBtn = document.getElementById('voice-input');
        voiceBtn.addEventListener('mousedown', this.startVoiceInput.bind(this));
        voiceBtn.addEventListener('touchstart', this.startVoiceInput.bind(this));
        voiceBtn.addEventListener('mouseup', this.stopVoiceInput.bind(this));
        voiceBtn.addEventListener('touchend', this.stopVoiceInput.bind(this));
        voiceBtn.addEventListener('mouseleave', this.stopVoiceInput.bind(this));
        
        // Text input
        const textInput = document.getElementById('text-input');
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextMessage();
            }
        });
        document.getElementById('send-text').addEventListener('click', this.sendTextMessage.bind(this));
        
        // Ingredients toggle
        document.getElementById('toggle-ingredients').addEventListener('click', this.toggleIngredients.bind(this));
        
        // Handle page visibility change
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
        
        // Handle beforeunload
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        
        console.log('Event listeners setup complete');
    }
    
    // === CORE FUNCTIONALITY ===
    
    // Start cooking session
    async startCooking() {
        if (AppState.isCooking) {
            return;
        }
        
        // Ask for dish name
        const dishName = prompt('What would you like to cook today?', 'Vegetable Pulao');
        if (!dishName) {
            return;
        }
        
        // Show loading
        this.showLoading(`Getting recipe for ${dishName}...`);
        
        try {
            // Start camera if enabled
            if (AppState.preferences.cameraEnabled && window.cameraManager) {
                await window.cameraManager.startCamera();
            }
            
            // Update state
            AppState.startCooking(dishName);
            
            // Get recipe from AI
            const recipe = await window.aiManager?.extractRecipe(dishName);
            if (recipe) {
                AppState.updateRecipe(recipe);
                
                // Speak first instruction
                this.speakAIResponse(`Chaliye shuru karte hain ${dishName} banana. Pehle ingredients check karein.`);
                
                // Ask for ingredient confirmation
                AppState.addToConversation('ai', 
                    `Ingredients check karein. Sab kuch ready hai? Agar haan to boliye "ready" ya "haan".`);
                
                AppState.waitingForConfirmation = true;
                
            } else {
                throw new Error('Could not generate recipe');
            }
            
        } catch (error) {
            console.error('Start cooking failed:', error);
            this.showError(`Recipe setup failed: ${error.message}`);
            
            // Use default recipe
            const defaultRecipe = window.aiManager?.getDefaultRecipe();
            AppState.updateRecipe(defaultRecipe);
            AppState.addToConversation('ai', 'Default recipe se shuru karte hain. Ingredients check karein.');
        }
        
        this.hideLoading();
        this.updateUIFromState(AppState);
    }
    
    // Toggle pause state
    togglePause() {
        AppState.pauseCooking();
        this.updateUIFromState(AppState);
    }
    
    // Reset cooking
    resetCooking() {
        if (confirm('Are you sure you want to reset? All progress will be lost.')) {
            AppState.resetCooking();
            this.updateUIFromState(AppState);
            
            // Stop camera
            if (window.cameraManager) {
                window.cameraManager.stopCamera();
            }
            
            // Stop speech
            if (window.speechManager) {
                window.speechManager.stopSpeaking();
            }
        }
    }
    
    // Go to previous step
    prevStep() {
        if (AppState.prevStep()) {
            const stepText = AppState.getCurrentStepText();
            this.speakAIResponse(`Pichla step: ${stepText}`);
        }
        this.updateUIFromState(AppState);
    }
    
    // Go to next step
    nextStep() {
        if (AppState.nextStep()) {
            const stepText = AppState.getCurrentStepText();
            this.speakAIResponse(`Agla step: ${stepText}`);
        }
        this.updateUIFromState(AppState);
    }
    
    // === VOICE & TEXT HANDLING ===
    
    // Start voice input
    startVoiceInput() {
        if (!window.speechManager) return;
        
        const voiceBtn = document.getElementById('voice-input');
        voiceBtn.classList.add('listening');
        
        // Start recognition
        window.speechManager.startListening();
        
        // Set timeout for auto-stop (10 seconds)
        this.voiceButtonHoldTimer = setTimeout(() => {
            this.stopVoiceInput();
        }, 10000);
    }
    
    // Stop voice input
    stopVoiceInput() {
        if (!window.speechManager) return;
        
        const voiceBtn = document.getElementById('voice-input');
        voiceBtn.classList.remove('listening');
        
        // Stop recognition
        window.speechManager.stopListening();
        
        // Clear timer
        if (this.voiceButtonHoldTimer) {
            clearTimeout(this.voiceButtonHoldTimer);
            this.voiceButtonHoldTimer = null;
        }
    }
    
    // Handle speech start
    onSpeechStart() {
        console.log('Speech recognition started');
        // Visual feedback already handled by speech module
    }
    
    // Handle speech result
    async onSpeechResult(transcript, confidence) {
        console.log(`Speech recognized: "${transcript}" (confidence: ${confidence})`);
        
        // Add to conversation
        AppState.addToConversation('user', transcript);
        
        // Process command
        await this.processUserMessage(transcript);
    }
    
    // Handle speech end
    onSpeechEnd() {
        console.log('Speech recognition ended');
    }
    
    // Send text message
    async sendTextMessage() {
        const textInput = document.getElementById('text-input');
        const message = textInput.value.trim();
        
        if (!message) return;
        
        // Clear input
        textInput.value = '';
        
        // Add to conversation
        AppState.addToConversation('user', message);
        
        // Process message
        await this.processUserMessage(message);
    }
    
    // Process user message (voice or text)
    async processUserMessage(message) {
        if (!message || message.length < 2) return;
        
        const lowerMessage = message.toLowerCase();
        
        // Handle special commands
        if (this.handleSpecialCommands(lowerMessage)) {
            return;
        }
        
        // Show thinking indicator
        this.showThinking(true);
        
        try {
            let aiResponse;
            let imageData = null;
            
            // Check if camera analysis is requested
            if (lowerMessage.includes('dekho') || lowerMessage.includes('look') || 
                lowerMessage.includes('see') || lowerMessage.includes('check')) {
                
                // Capture and analyze image
                if (window.cameraManager && AppState.preferences.cameraEnabled) {
                    imageData = window.cameraManager.captureFrame();
                }
            }
            
            // Check if we should analyze camera for this step
            if (!imageData && AppState.shouldAnalyzeCamera() && window.cameraManager) {
                imageData = window.cameraManager.captureFrame(0.6, 600);
            }
            
            // Get AI response
            aiResponse = await window.generateAIResponse(message, imageData);
            
            // Add to conversation
            AppState.addToConversation('ai', aiResponse);
            
            // Speak the response
            this.speakAIResponse(aiResponse);
            
            // Check if response contains step completion
            if (this.shouldMarkStepComplete(aiResponse, lowerMessage)) {
                AppState.completeCurrentStep();
            }
            
            // Extract and update recipe if needed
            this.extractRecipeFromResponse(aiResponse);
            
        } catch (error) {
            console.error('AI response failed:', error);
            
            // Fallback response
            const fallbackResponse = "Mujhe samajh nahi aaya. Could you please repeat?";
            AppState.addToConversation('ai', fallbackResponse);
            this.speakAIResponse(fallbackResponse);
            
            this.showError(`AI Error: ${error.message}`);
        }
        
        // Hide thinking indicator
        this.showThinking(false);
        this.updateUIFromState(AppState);
    }
    
    // Handle special commands
    handleSpecialCommands(message) {
        const commands = {
            'ready': () => {
                AppState.waitingForConfirmation = false;
                const stepText = AppState.getCurrentStepText();
                this.speakAIResponse(`Accha! Chaliye shuru karte hain. ${stepText}`);
                return true;
            },
            'haan': () => {
                AppState.waitingForConfirmation = false;
                const stepText = AppState.getCurrentStepText();
                this.speakAIResponse(`Theek hai. ${stepText}`);
                return true;
            },
            'nahi': () => {
                this.speakAIResponse('Kya problem hai? Batayein main help karun.');
                return true;
            },
            'next': () => {
                this.nextStep();
                return true;
            },
            'previous': () => {
                this.prevStep();
                return true;
            },
            'pause': () => {
                this.togglePause();
                return true;
            },
            'stop': () => {
                this.resetCooking();
                return true;
            },
            'ingredients': () => {
                this.showIngredients();
                return true;
            },
            'camera on': () => {
                this.toggleCamera(true);
                return true;
            },
            'camera off': () => {
                this.toggleCamera(false);
                return true;
            }
        };
        
        for (const [command, handler] of Object.entries(commands)) {
            if (message.includes(command)) {
                return handler();
            }
        }
        
        return false;
    }
    
    // Check if step should be marked complete
    shouldMarkStepComplete(aiResponse, userMessage) {
        const completeKeywords = ['done', 'complete', 'finished', 'hogaya', 'ho gaya', 'taiyar'];
        const userComplete = completeKeywords.some(keyword => userMessage.includes(keyword));
        const aiComplete = completeKeywords.some(keyword => aiResponse.toLowerCase().includes(keyword));
        
        return (userComplete || aiComplete) && AppState.waitingForConfirmation;
    }
    
    // Extract recipe from AI response
    extractRecipeFromResponse(response) {
        // Simple pattern matching for recipe updates
        const stepPattern = /step\s*\d+:|चरण\s*\d+:/i;
        const ingredientPattern = /(\d+\s*(tbsp|tsp|cup|grams?|kg|ml|liter|pieces?)?\s*[\w\s]+)/gi;
        
        if (stepPattern.test(response) && !AppState.recipe.steps.length) {
            // Might be a step, but we already have recipe extraction
        }
    }
    
    // === CAMERA HANDLING ===
    
    // Toggle camera
    async toggleCamera(forceState = null) {
        if (!window.cameraManager) {
            this.showError('Camera module not available');
            return;
        }
        
        const shouldEnable = forceState !== null ? forceState : !AppState.preferences.cameraEnabled;
        
        if (shouldEnable) {
            const enabled = await window.cameraManager.startCamera();
            if (enabled) {
                AppState.preferences.cameraEnabled = true;
                AppState.addToConversation('ai', 'Camera on. Ab main dekh sakta hun aapka cooking.');
            }
        } else {
            window.cameraManager.stopCamera();
            AppState.preferences.cameraEnabled = false;
            AppState.addToConversation('ai', 'Camera off.');
        }
        
        AppState.savePreferences();
        this.updateUIFromState(AppState);
    }
    
    // Capture and analyze image
    async captureAndAnalyze() {
        if (!window.cameraManager || !AppState.preferences.cameraEnabled) {
            this.showError('Please enable camera first');
            return;
        }
        
        this.showLoading('Analyzing your cooking...');
        
        try {
            const analysis = await window.cameraManager.captureAndAnalyze();
            if (analysis) {
                AppState.addToConversation('ai', analysis);
                this.speakAIResponse(analysis);
            }
        } catch (error) {
            console.error('Capture and analyze failed:', error);
            this.showError(`Analysis failed: ${error.message}`);
        }
        
        this.hideLoading();
    }
    
    // === SPEECH HANDLING ===
    
    // Toggle microphone
    toggleMicrophone() {
        if (!window.speechManager) {
            this.showError('Speech module not available');
            return;
        }
        
        const enabled = window.speechManager.toggleSpeech();
        const message = enabled ? 'Microphone ready' : 'Microphone off';
        AppState.addToConversation('system', message);
        
        this.updateUIFromState(AppState);
    }
    
    // Toggle AI speech
    toggleAISpeech() {
        if (!window.speechManager) {
            this.showError('Speech module not available');
            return;
        }
        
        const enabled = window.speechManager.toggleSpeech();
        const message = enabled ? 'AI speech enabled' : 'AI speech disabled';
        AppState.addToConversation('system', message);
        
        this.updateUIFromState(AppState);
    }
    
    // Speak AI response
    speakAIResponse(text) {
        if (!window.speechManager || !AppState.preferences.aiSpeechEnabled) {
            return;
        }
        
        // Clean up text for speech
        const cleanText = text
            .replace(/\[.*?\]/g, '') // Remove brackets
            .replace(/\(.*?\)/g, '') // Remove parentheses
            .replace(/\*/g, '') // Remove asterisks
            .trim();
        
        if (cleanText) {
            window.speechManager.queueSpeech(cleanText);
        }
    }
    
    // Speak welcome message
    speakWelcome() {
        const welcomeText = "Namaste! I'm ChefMate, your kitchen assistant. Ready to cook together?";
        this.speakAIResponse(welcomeText);
    }
    
    // === UI UPDATES ===
    
    // Update UI from state (exposed globally for state.js)
    updateUIFromState(state) {
        // Update step counter
        document.getElementById('current-step').textContent = state.currentStep + 1;
        document.getElementById('total-steps').textContent = state.totalSteps || 0;
        
        // Update current step text
        document.getElementById('current-step-text').textContent = state.getCurrentStepText();
        
        // Update progress
        const progressPercent = state.getProgressPercentage();
        document.getElementById('progress-percent').textContent = `${progressPercent}%`;
        document.getElementById('progress-fill').style.width = `${progressPercent}%`;
        
        // Update control buttons
        document.getElementById('start-cooking').disabled = state.isCooking;
        document.getElementById('pause-cooking').disabled = !state.isCooking;
        document.getElementById('pause-cooking').textContent = state.isPaused ? 
            '<i class="fas fa-play"></i> Resume' : 
            '<i class="fas fa-pause"></i> Pause';
        
        // Update navigation buttons
        document.getElementById('prev-step').disabled = state.currentStep === 0 || !state.isCooking;
        document.getElementById('next-step').disabled = 
            state.currentStep >= state.totalSteps - 1 || !state.isCooking || state.waitingForConfirmation;
        
        // Update mic button
        const micBtn = document.getElementById('toggle-mic');
        if (state.preferences.voiceEnabled) {
            micBtn.classList.add('mic-active');
            micBtn.title = 'Microphone On';
        } else {
            micBtn.classList.remove('mic-active');
            micBtn.title = 'Microphone Off';
        }
        
        // Update speech button
        const speechBtn = document.getElementById('toggle-ai-speech');
        if (state.preferences.aiSpeechEnabled) {
            speechBtn.classList.add('speech-active');
            speechBtn.title = 'AI Speech On';
        } else {
            speechBtn.classList.remove('speech-active');
            speechBtn.title = 'AI Speech Off';
        }
        
        // Update chat messages
        this.updateChatMessages();
        
        // Update ingredients list
        this.updateIngredientsList();
        
        // Update camera button
        const cameraBtn = document.getElementById('toggle-camera');
        if (cameraBtn) {
            cameraBtn.innerHTML = state.preferences.cameraEnabled ? 
                '<i class="fas fa-camera-slash"></i>' : 
                '<i class="fas fa-camera"></i>';
        }
        
        // Update connection status
        this.updateConnectionStatus();
    }
    
    // Update chat messages display
    updateChatMessages() {
        const chatContainer = document.getElementById('chat-messages');
        if (!chatContainer) return;
        
        // Clear existing messages (keep the welcome message)
        const existingMessages = chatContainer.querySelectorAll('.message:not(.ai-message):not(.system-message)');
        existingMessages.forEach(msg => msg.remove());
        
        // Add conversation messages (skip the first welcome message)
        const messagesToShow = AppState.conversation.slice(1); // Skip initial welcome
        
        messagesToShow.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}-message`;
            
            const time = new Date(msg.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            let avatarIcon = 'fa-robot';
            if (msg.role === 'user') avatarIcon = 'fa-user';
            if (msg.role === 'system') avatarIcon = 'fa-info-circle';
            
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas ${avatarIcon}"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${this.escapeHtml(msg.text)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
            
            chatContainer.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // Update ingredients list
    updateIngredientsList() {
        const ingredientsList = document.getElementById('ingredients-list');
        if (!ingredientsList) return;
        
        if (!AppState.recipe.ingredients.length) {
            ingredientsList.innerHTML = `
                <div class="empty-ingredients">
                    <i class="fas fa-clipboard-list"></i>
                    <p>Ingredients will appear here once you start cooking</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        AppState.recipe.ingredients.forEach((ingredient, index) => {
            html += `
                <div class="ingredient-item">
                    <input type="checkbox" class="ingredient-checkbox" 
                           id="ingredient-${index}" 
                           ${ingredient.checked ? 'checked' : ''}
                           onchange="AppState.toggleIngredient(${index})">
                    <label for="ingredient-${index}" class="ingredient-name">
                        ${this.escapeHtml(ingredient.name)}
                    </label>
                    <span class="ingredient-quantity">${this.escapeHtml(ingredient.quantity)}</span>
                </div>
            `;
        });
        
        ingredientsList.innerHTML = html;
    }
    
    // Show ingredients
    showIngredients() {
        if (!AppState.recipe.ingredients.length) {
            this.speakAIResponse('Abhi tak koi ingredients nahi hain. Pehle dish bataiye.');
            return;
        }
        
        const ingredientsText = AppState.recipe.ingredients
            .map(ing => `${ing.name} - ${ing.quantity}`)
            .join(', ');
        
        this.speakAIResponse(`Ingredients hain: ${ingredientsText}`);
    }
    
    // Toggle ingredients panel
    toggleIngredients() {
        const ingredientsList = document.getElementById('ingredients-list');
        const toggleBtn = document.getElementById('toggle-ingredients');
        
        if (ingredientsList.style.display === 'none') {
            ingredientsList.style.display = 'block';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        } else {
            ingredientsList.style.display = 'none';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        }
    }
    
    // Update connection status
    updateConnectionStatus() {
        const aiConnected = window.aiManager && window.aiManager.isInitialized;
        const micSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const cameraSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        
        let statusText = 'All Systems Ready';
        let statusClass = 'connected';
        
        if (!aiConnected) {
            statusText = 'AI Disconnected - Check API Key';
            statusClass = '';
        } else if (!micSupported) {
            statusText = 'Microphone Not Supported';
            statusClass = '';
        } else if (!cameraSupported) {
            statusText = 'Camera Not Supported';
            statusClass = '';
        }
        
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            const text = statusElement.querySelector('span');
            
            dot.className = `status-dot ${statusClass}`;
            text.textContent = statusText;
        }
    }
    
    // === LOADING & ERROR HANDLING ===
    
    // Show loading overlay
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        
        if (overlay && text) {
            text.textContent = message;
            overlay.style.display = 'flex';
        }
        
        AppState.setLoading(true, message);
    }
    
    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        AppState.setLoading(false);
    }
    
    // Show thinking indicator
    showThinking(show) {
        const aiStatus = document.getElementById('ai-status');
        if (aiStatus) {
            const text = aiStatus.querySelector('span');
            if (show) {
                text.textContent = 'Thinking...';
            } else {
                text.textContent = 'Connected';
            }
        }
    }
    
    // Show error message
    showError(message) {
        console.error('App Error:', message);
        
        // Add to conversation
        AppState.addToConversation('system', `Error: ${message}`);
        
        // Show in UI (simple alert for now)
        alert(`ChefMate Error: ${message}`);
    }
    
    // === EVENT HANDLERS ===
    
    // Handle page visibility change
    onVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - pause speech and camera
            if (window.speechManager) {
                window.speechManager.stopSpeaking();
                window.speechManager.stopListening();
            }
        } else {
            // Page is visible again
            if (AppState.isCooking && !AppState.isPaused) {
                // Resume if we were cooking
                this.speakAIResponse('Welcome back! Let\'s continue cooking.');
            }
        }
    }
    
    // Clean up resources
    cleanup() {
        console.log('Cleaning up resources...');
        
        // Stop camera
        if (window.cameraManager) {
            window.cameraManager.cleanup();
        }
        
        // Stop speech
        if (window.speechManager) {
            window.speechManager.cleanup();
        }
        
        // Stop AI
        if (window.aiManager) {
            window.aiManager.cleanup();
        }
        
        // Save state
        AppState.savePreferences();
    }
    
    // === UTILITY FUNCTIONS ===
    
    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Make updateUIFromState available globally
window.updateUIFromState = function(state) {
    if (window.liveRecipeAI) {
        window.liveRecipeAI.updateUIFromState(state);
    }
};

// Initialize application
let liveRecipeAI = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        liveRecipeAI = new LiveRecipeAI();
        window.liveRecipeAI = liveRecipeAI;
    });
} else {
    liveRecipeAI = new LiveRecipeAI();
    window.liveRecipeAI = liveRecipeAI;
}
