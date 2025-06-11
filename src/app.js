// Main application entry point
import ClozeGameEngine from './clozeGameEngine.js';
import bookDataService from './bookDataService.js';
import { AIService } from './aiService.js';
import ChatInterface from './chatInterface.js';
import ConversationManager from './conversationManager.js';

class ClozeReaderApp {
    constructor() {
        this.bookDataService = bookDataService; // Already instantiated
        this.aiService = new AIService();
        this.gameEngine = new ClozeGameEngine();
        this.chatInterface = new ChatInterface(this.aiService);
        this.conversationManager = new ConversationManager(this.aiService);
        
        this.init();
    }

    async init() {
        try {
            // Initialize services
            await this.bookDataService.initialize();
            
            // Start the game
            await this.gameEngine.initialize();
            
            // Initialize chat interface
            this.chatInterface.initialize();
            
            console.log('Cloze Reader application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('Failed to load the application. Please refresh the page.');
        }
    }

    showError(message) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = `<p class="text-red-600">${message}</p>`;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClozeReaderApp();
});