// Live Recipe AI - Configuration
// 1. Copy this file to `config.js`
// 2. Get your Google AI Studio API key from: https://makersuite.google.com/app/apikey
// 3. Replace 'YOUR_API_KEY_HERE' with your actual API key
// 4. NEVER commit config.js to version control

const CONFIG = {
    GEMINI_API_KEY: 'AIzaSyBHBlMVcRjdpt4zuZWc4kDOlMgxoP_wWZ0',
    GEMINI_MODEL: 'gemini-1.5-pro', // or 'gemini-1.5-flash' for faster responses
    MAX_RETRIES: 3,
    REQUEST_TIMEOUT: 30000, // 30 seconds
    VISION_ENABLED: true
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
