// Live Recipe AI - AI Module
// Handles Gemini API calls and AI interactions

class AIManager {
    constructor() {
        this.apiKey = null;
        this.model = 'gemini-1.5-pro';
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/';
        this.maxRetries = 3;
        this.requestTimeout = 30000;
        this.isInitialized = false;
        
        this.init();
    }
    
    // Initialize AI module
    init() {
        // Check for API key
        if (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) {
            this.apiKey = CONFIG.GEMINI_API_KEY;
            this.model = CONFIG.GEMINI_MODEL || this.model;
            this.maxRetries = CONFIG.MAX_RETRIES || this.maxRetries;
            this.requestTimeout = CONFIG.REQUEST_TIMEOUT || this.requestTimeout;
            
            this.isInitialized = true;
            this.updateAIStatus(true, 'Connected');
            console.log('AI Manager initialized with API key');
        } else {
            this.updateAIStatus(false, 'No API Key');
            console.warn('No API key found. Please add your Google AI Studio API key to config.js');
            
            // Show helpful error
            this.showAPIKeyError();
        }
    }
    
    // Generate text response from AI
    async generateResponse(userMessage, imageData = null) {
        if (!this.isInitialized || !this.apiKey) {
            throw new Error('AI not initialized. Please check API key.');
        }
        
        // Update status
        this.updateAIStatus(true, 'Thinking...');
        
        try {
            // Prepare messages
            const messages = this.prepareMessages(userMessage, imageData);
            
            // Make API call
            const response = await this.callGeminiAPI(messages);
            
            // Update status
            this.updateAIStatus(true, 'Connected');
            
            return response;
            
        } catch (error) {
            this.updateAIStatus(true, 'Error');
            throw error;
        }
    }
    
    // Prepare messages for API call
    prepareMessages(userMessage, imageData) {
        // Start with system prompt
        const messages = [
            {
                role: 'user',
                parts: [{ text: AppState.getSystemPrompt() }]
            },
            {
                role: 'model',
                parts: [{ text: 'Understood. I am ChefMate, your kitchen assistant. I will guide you step by step in friendly Hinglish.' }]
            }
        ];
        
        // Add conversation history
        if (AppState.aiContext.messages.length > 0) {
            messages.push(...AppState.aiContext.messages);
        }
        
        // Add current user message
        const userMessageParts = [{ text: userMessage }];
        
        // Add image if provided
        if (imageData) {
            userMessageParts.push({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageData.split(',')[1] // Remove data:image/jpeg;base64, prefix
                }
            });
            
            // Add vision context instruction
            userMessageParts.push({
                text: "Please analyze this image of the cooking. Look for obvious issues like burning, undercooking, wrong consistency, or safety concerns. Give a brief, helpful suggestion if something needs correction."
            });
        }
        
        messages.push({
            role: 'user',
            parts: userMessageParts
        });
        
        return messages;
    }
    
    // Call Gemini API
    async callGeminiAPI(messages, retryCount = 0) {
        const url = `${this.baseURL}${this.model}:generateContent?key=${this.apiKey}`;
        
        const requestBody = {
            contents: messages,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 500,
                stopSequences: []
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };
        
        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            
            // Extract text from response
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const text = data.candidates[0].content.parts[0]?.text || '';
                return text.trim();
            } else {
                throw new Error('Invalid response format from API');
            }
            
        } catch (error) {
            // Retry logic
            if (retryCount < this.maxRetries) {
                console.log(`Retrying API call (${retryCount + 1}/${this.maxRetries})...`);
                await this.delay(1000 * (retryCount + 1)); // Exponential backoff
                return this.callGeminiAPI(messages, retryCount + 1);
            }
            
            // Handle specific errors
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please check your internet connection.');
            }
            
            if (error.message.includes('API key')) {
                throw new Error('Invalid API key. Please check your config.js file.');
            }
            
            if (error.message.includes('429')) {
                throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
            }
            
            throw error;
        }
    }
    
    // Analyze image for cooking issues
    async analyzeImage(imageData) {
        if (!this.isInitialized) {
            throw new Error('AI not initialized');
        }
        
        const prompt = "Analyze this cooking image. Look for: 1) Burning/overcooking, 2) Undercooking, 3) Wrong consistency, 4) Safety issues, 5) Missing ingredients. Give brief, practical advice in Hinglish. Keep it under 2 sentences.";
        
        try {
            const analysis = await this.generateResponse(prompt, imageData);
            
            // Add to vision context
            AppState.addVisionContext(analysis);
            
            return analysis;
            
        } catch (error) {
            console.error('Image analysis failed:', error);
            return "Could not analyze image. Please try again or continue cooking.";
        }
    }
    
    // Extract recipe from user request
    async extractRecipe(userMessage) {
        const prompt = `The user wants to cook something. Extract recipe details from this message: "${userMessage}"

        Return ONLY a valid JSON object with this exact structure:
        {
            "name": "Dish name",
            "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity", ...],
            "steps": ["Step 1 instruction", "Step 2 instruction", ...],
            "estimatedTime": "time in minutes"
        }

        If information is missing, make reasonable assumptions for a home cook.
        Keep steps clear and sequential.`;
        
        try {
            const response = await this.generateResponse(prompt);
            
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const recipeData = JSON.parse(jsonMatch[0]);
                return recipeData;
            }
            
            // Fallback to simple parsing
            return this.parseRecipeFallback(response);
            
        } catch (error) {
            console.error('Recipe extraction failed:', error);
            return this.getDefaultRecipe();
        }
    }
    
    // Fallback recipe parser
    parseRecipeFallback(text) {
        // Simple parsing logic
        const lines = text.split('\n').filter(line => line.trim());
        
        const recipe = {
            name: 'Custom Dish',
            ingredients: [],
            steps: [],
            estimatedTime: '30'
        };
        
        let currentSection = '';
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.includes('ingredient')) {
                currentSection = 'ingredients';
            } else if (lowerLine.includes('step') || lowerLine.includes('method') || lowerLine.includes('instruction')) {
                currentSection = 'steps';
            } else if (lowerLine.includes('time')) {
                const timeMatch = line.match(/\d+/);
                if (timeMatch) {
                    recipe.estimatedTime = timeMatch[0];
                }
            } else if (currentSection === 'ingredients' && line.trim()) {
                recipe.ingredients.push(line.trim());
            } else if (currentSection === 'steps' && line.trim()) {
                recipe.steps.push(line.trim());
            } else if (!recipe.name || recipe.name === 'Custom Dish') {
                recipe.name = line.trim();
            }
        }
        
        return recipe;
    }
    
    // Default recipe if extraction fails
    getDefaultRecipe() {
        return {
            name: 'Vegetable Pulao',
            ingredients: [
                '1 cup basmati rice',
                '2 cups mixed vegetables (carrots, peas, beans)',
                '1 onion, sliced',
                '2 tomatoes, chopped',
                'Spices: turmeric, cumin, garam masala',
                '2 tbsp oil or ghee',
                'Salt to taste',
                'Water as needed'
            ],
            steps: [
                'Wash rice and soak for 15 minutes',
                'Heat oil in a pressure cooker, add cumin seeds',
                'Add onions and sauté until golden brown',
                'Add tomatoes and cook until soft',
                'Add vegetables and spices, cook for 2 minutes',
                'Add rice and water, pressure cook for 2 whistles',
                'Let pressure release naturally, then serve hot'
            ],
            estimatedTime: '30'
        };
    }
    
    // Update AI status UI
    updateAIStatus(active, message) {
        const statusElement = document.getElementById('ai-status');
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
        
        // Update connection status
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            const dot = connectionStatus.querySelector('.status-dot');
            const text = connectionStatus.querySelector('span');
            
            if (active && message === 'Connected') {
                dot.className = 'status-dot connected';
                text.textContent = 'AI Connected';
            } else if (!active) {
                dot.className = 'status-dot';
                text.textContent = 'AI Disconnected';
            } else {
                dot.className = 'status-dot connected';
                text.textContent = message;
            }
        }
    }
    
    // Show API key error
    showAPIKeyError() {
        const errorHTML = `
            <div class="error" style="margin: 1rem; padding: 1rem;">
                <strong>API Key Required</strong>
                <p>To use ChefMate, you need a Google AI Studio API key:</p>
                <ol>
                    <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></li>
                    <li>Create an API key (it's free with limits)</li>
                    <li>Copy the key to <code>config.js</code> file</li>
                    <li>Refresh this page</li>
                </ol>
                <p>Without an API key, only demo mode is available.</p>
            </div>
        `;
        
        // Add to chat
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message system-message';
            errorDiv.innerHTML = errorHTML;
            chatMessages.appendChild(errorDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    // Helper: delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Clean up
    cleanup() {
        this.apiKey = null;
        this.isInitialized = false;
        this.updateAIStatus(false, 'Disconnected');
    }
}

// Create global instance
let aiManager = null;

// Initialize on load
if (document.readyState === 'loading
