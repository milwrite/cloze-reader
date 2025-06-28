// Main application entry point
import ClozeGame from './clozeGameEngine.js';
import ChatUI from './chatInterface.js';
import WelcomeOverlay from './welcomeOverlay.js';

class App {
  constructor() {
    this.game = new ClozeGame();
    this.chatUI = new ChatUI(this.game);
    this.welcomeOverlay = new WelcomeOverlay();
    this.elements = {
      loading: document.getElementById('loading'),
      gameArea: document.getElementById('game-area'),
      stickyControls: document.getElementById('sticky-controls'),
      bookInfo: document.getElementById('book-info'),
      roundInfo: document.getElementById('round-info'),
      contextualization: document.getElementById('contextualization'),
      passageContent: document.getElementById('passage-content'),
      hintsSection: document.getElementById('hints-section'),
      hintsList: document.getElementById('hints-list'),
      submitBtn: document.getElementById('submit-btn'),
      nextBtn: document.getElementById('next-btn'),
      hintBtn: document.getElementById('hint-btn'),
      result: document.getElementById('result')
    };
    
    this.currentResults = null;
    this.setupEventListeners();
  }

  async initialize() {
    try {
      this.showLoading(true);
      await this.game.initialize();
      await this.startNewGame();
      this.showLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to load the game. Please refresh and try again.');
    }
  }

  setupEventListeners() {
    this.elements.submitBtn.addEventListener('click', () => this.handleSubmit());
    this.elements.nextBtn.addEventListener('click', () => this.handleNext());
    this.elements.hintBtn.addEventListener('click', () => this.toggleHints());
    
    // Allow Enter key to submit when focused on an input
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('cloze-input')) {
        this.handleSubmit();
      }
    });
  }

  async startNewGame() {
    try {
      const roundData = await this.game.startNewRound();
      this.displayRound(roundData);
      this.resetUI();
    } catch (error) {
      console.error('Error starting new game:', error);
      this.showError('Could not load a new passage. Please try again.');
    }
  }

  displayRound(roundData) {
    // Show book information
    this.elements.bookInfo.innerHTML = `
      <strong>${roundData.title}</strong> by ${roundData.author}
    `;

    // Show level information
    const blanksCount = roundData.blanks.length;
    const levelInfo = `Level ${this.game.currentLevel} • ${blanksCount} blank${blanksCount > 1 ? 's' : ''}`;
    
    this.elements.roundInfo.innerHTML = levelInfo;

    // Show contextualization from AI agent
    this.elements.contextualization.innerHTML = `
      <div class="flex items-start gap-2">
        <span class="text-blue-600">📜</span>
        <span>${roundData.contextualization || 'Loading context...'}</span>
      </div>
    `;

    // Render the cloze text with input fields and chat buttons
    const clozeHtml = this.game.renderClozeTextWithChat();
    this.elements.passageContent.innerHTML = `<p>${clozeHtml}</p>`;

    // Store hints for later display
    this.currentHints = roundData.hints || [];
    this.populateHints();
    
    // Hide hints initially
    this.elements.hintsSection.style.display = 'none';

    // Set up input field listeners
    this.setupInputListeners();
    
    // Set up chat buttons
    this.chatUI.setupChatButtons();
  }

  setupInputListeners() {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    
    inputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        // Remove any previous styling
        input.classList.remove('correct', 'incorrect');
        this.updateSubmitButton();
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          // Move to next input or submit if last
          const nextInput = inputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          } else {
            this.handleSubmit();
          }
        }
      });
    });

    // Focus first input
    if (inputs.length > 0) {
      inputs[0].focus();
    }
  }

  updateSubmitButton() {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    const allFilled = Array.from(inputs).every(input => input.value.trim() !== '');
    this.elements.submitBtn.disabled = !allFilled;
  }

  handleSubmit() {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    const answers = Array.from(inputs).map(input => input.value.trim());
    
    // Check if all fields are filled
    if (answers.some(answer => answer === '')) {
      alert('Please fill in all blanks before submitting.');
      return;
    }

    // Submit answers and get results
    this.currentResults = this.game.submitAnswers(answers);
    this.displayResults(this.currentResults);
  }

  displayResults(results) {
    let message = `Score: ${results.correct}/${results.total} (${results.percentage}%)`;
    
    // Show "Required" information at all levels for consistency
    message += ` - Required: ${results.requiredCorrect}/${results.total}`;
    
    if (results.passed) {
      // Check if this completes the requirements for level advancement
      const roundsCompleted = this.game.roundsPassedAtCurrentLevel + 1; // +1 for this round
      if (roundsCompleted >= 2) {
        message += ` - Excellent! Advancing to Level ${this.game.currentLevel + 1}! 🎉`;
      } else {
        message += ` - Great job! ${roundsCompleted}/2 rounds completed for Level ${this.game.currentLevel}`;
      }
      this.elements.result.className = 'mt-4 text-center font-semibold text-green-600';
    } else {
      message += ` - Need ${results.requiredCorrect} correct to advance. Keep practicing! 💪`;
      this.elements.result.className = 'mt-4 text-center font-semibold text-red-600';
    }
    
    this.elements.result.textContent = message;
    
    // Always reveal answers at the end of each round
    this.revealAnswersInPlace(results.results);
    
    // Show next button and hide submit button
    this.elements.submitBtn.style.display = 'none';
    this.elements.nextBtn.classList.remove('hidden');
  }

  highlightAnswers(results) {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    
    results.forEach((result, index) => {
      const input = inputs[index];
      if (input) {
        if (result.isCorrect) {
          input.classList.add('correct');
        } else {
          input.classList.add('incorrect');
          // Show correct answer as placeholder or title
          input.title = `Correct answer: ${result.correctAnswer}`;
        }
        input.disabled = true;
      }
    });
  }

  async handleNext() {
    try {
      // Show loading immediately with specific message
      this.showLoading(true, 'Loading passages...');
      
      // Clear chat history when starting new passage/round
      this.chatUI.clearChatHistory();
      
      // Always show loading for at least 1 second for smooth UX
      const startTime = Date.now();
      
      // Check if we should load next passage or next round
      let roundData;
      if (this.game.currentPassageIndex === 0) {
        // Load second passage in current round
        roundData = await this.game.nextPassage();
      } else {
        // Load next round (two new passages)
        roundData = await this.game.nextRound();
      }
      
      // Ensure loading is shown for at least half a second
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
      }
      
      this.displayRound(roundData);
      this.resetUI();
      this.showLoading(false);
    } catch (error) {
      console.error('Error loading next passage:', error);
      this.showError('Could not load next passage. Please try again.');
    }
  }

  // Reveal correct answers immediately after submission
  revealAnswersInPlace(results) {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    
    results.forEach((result, index) => {
      const input = inputs[index];
      if (input) {
        if (result.isCorrect) {
          input.classList.add('correct');
          input.style.backgroundColor = '#dcfce7'; // Light green
          input.style.borderColor = '#16a34a'; // Green border
        } else {
          input.classList.add('incorrect');
          input.style.backgroundColor = '#fef2f2'; // Light red
          input.style.borderColor = '#dc2626'; // Red border
          
          // Show correct answer below the input (only if not already shown)
          const existingAnswer = input.parentNode.querySelector('.correct-answer-reveal');
          if (!existingAnswer) {
            const correctAnswerSpan = document.createElement('span');
            correctAnswerSpan.className = 'correct-answer-reveal text-sm text-green-600 font-semibold ml-2';
            correctAnswerSpan.textContent = `✓ ${result.correctAnswer}`;
            input.parentNode.appendChild(correctAnswerSpan);
          }
        }
        input.disabled = true;
      }
    });
  }

  populateHints() {
    if (!this.currentHints || this.currentHints.length === 0) {
      this.elements.hintsList.innerHTML = '<div class="text-yellow-600">No hints available for this passage.</div>';
      return;
    }

    const hintsHtml = this.currentHints.map((hintData, index) => 
      `<div class="flex items-start gap-2">
        <span class="font-semibold text-yellow-800">${index + 1}.</span>
        <span>${hintData.hint}</span>
      </div>`
    ).join('');
    
    this.elements.hintsList.innerHTML = hintsHtml;
  }

  toggleHints() {
    const isHidden = this.elements.hintsSection.style.display === 'none';
    this.elements.hintsSection.style.display = isHidden ? 'block' : 'none';
    this.elements.hintBtn.textContent = isHidden ? 'Hide Hints' : 'Show Hints';
  }

  resetUI() {
    this.elements.result.textContent = '';
    this.elements.submitBtn.style.display = 'inline-block';
    this.elements.submitBtn.disabled = true;
    this.elements.nextBtn.classList.add('hidden');
    this.elements.hintsSection.style.display = 'none';
    this.elements.hintBtn.textContent = 'Show Hints';
    this.currentResults = null;
    this.currentHints = [];
  }

  showLoading(show, message = 'Loading passages...') {
    if (show) {
      this.elements.loading.innerHTML = `
        <div class="text-center py-8">
          <p class="text-lg loading-text">${message}</p>
        </div>
      `;
      this.elements.loading.classList.remove('hidden');
      this.elements.gameArea.classList.add('hidden');
      this.elements.stickyControls.classList.add('hidden');
    } else {
      this.elements.loading.classList.add('hidden');
      this.elements.gameArea.classList.remove('hidden');
      this.elements.stickyControls.classList.remove('hidden');
    }
  }

  showError(message) {
    this.elements.loading.innerHTML = `
      <div class="text-center py-8">
        <p class="text-lg text-red-600 mb-4">${message}</p>
        <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Reload
        </button>
      </div>
    `;
    this.elements.loading.classList.remove('hidden');
    this.elements.gameArea.classList.add('hidden');
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  
  // Show welcome overlay immediately before any loading
  app.welcomeOverlay.show();
  
  app.initialize();
  
  // Expose API key setter for browser console
  window.setOpenRouterKey = (key) => {
    app.game.chatService.aiService.setApiKey(key);
    console.log('OpenRouter API key updated');
  };
});