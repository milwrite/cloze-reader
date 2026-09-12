// Main application entry point
import ClozeGame from './clozeGameEngine.js';
import AccountWork from './accountWork.js';
import ChatUI from './chatInterface.js';
import WelcomeOverlay from './welcomeOverlay.js';
import { LeaderboardUI } from './leaderboardUI.js';
import { analyticsService } from './analyticsService.js';

class App {
  constructor() {
    this.game = new ClozeGame();
    this.chatUI = new ChatUI(this.game);
    this.welcomeOverlay = new WelcomeOverlay();
    this.leaderboardUI = new LeaderboardUI(this.game.leaderboardService);
    this.analytics = analyticsService;
    // Prevent double-trigger on rapid Skip clicks
    this._skipInProgress = false;
    this.lastRevealWasSkip = false; // Controls reveal styling after skip
    this.elements = {
      loading: document.getElementById('loading'),
      gameArea: document.getElementById('game-area'),
      stickyControls: document.getElementById('sticky-controls'),
      bookInfo: document.getElementById('book-info'),
      roundInfo: document.getElementById('round-info'),
      streakInfo: document.getElementById('streak-info'),
      contextualization: document.getElementById('contextualization'),
      passageContent: document.getElementById('passage-content'),
      hintsSection: document.getElementById('hints-section'),
      hintsList: document.getElementById('hints-list'),
      skipBtn: document.getElementById('skip-btn'),
      submitBtn: document.getElementById('submit-btn'),
      nextBtn: document.getElementById('next-btn'),
      hintBtn: document.getElementById('hint-btn'),
      result: document.getElementById('result'),
      leaderboardBtn: document.getElementById('leaderboard-btn')
    };

    this.currentResults = null;
    this.isRetrying = false; // Track if we're in retry mode
    this.accountWork = new AccountWork(this);
    this.setupEventListeners();
  }

  async initialize() {
    try {
      this.showLoading(true);
      if(await this.accountWork.initialize())return;
      await this.game.initialize();
      await this.startNewGame();
      this.showLoading(false);
      this.accountWork.changed();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to load the game. Please refresh and try again.');
    }
  }

  setupEventListeners() {
    if (this.elements.skipBtn) {
      this.elements.skipBtn.addEventListener('click', () => {
        // Ensure any unexpected async errors are surfaced but don’t crash UI
        Promise.resolve(this.handleSkip()).then(()=>this.accountWork.changed()).catch(err => console.error('handleSkip (event) ERROR:', err));
      });
    } else {
    }
    this.elements.submitBtn.addEventListener('click', () => {this.handleSubmit();this.accountWork.changed();});
    this.elements.nextBtn.addEventListener('click', () => this.handleNext());
    this.elements.hintBtn.addEventListener('click', () => this.toggleHints());

    // Leaderboard button
    if (this.elements.leaderboardBtn) {
      this.elements.leaderboardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.leaderboardUI.show();
      });
    }

    // Note: Enter key handling is done per-input in setupInputListeners()
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
    // Start analytics tracking for this passage
    this.analytics.startPassage(
      { title: roundData.title, author: roundData.author },
      roundData.blanks,
      this.game.currentLevel,
      this.game.currentRound
    );

    // Reset retry state
    this.isRetrying = false;

    // Show book information
    this.elements.bookInfo.innerHTML = `
      <strong>${roundData.title}</strong> by ${roundData.author}
    `;

    // Show level information
    const blanksCount = roundData.blanks.length;
    const levelInfo = `Level ${this.game.currentLevel} • ${blanksCount} blank${blanksCount > 1 ? 's' : ''}`;

    this.elements.roundInfo.innerHTML = levelInfo;

    // Update streak display
    this.updateStreakDisplay();

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
        this.accountWork.changed();
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          // Move to next input or submit if last
          const nextInput = inputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          } else {
            this.handleSubmit();this.accountWork.changed();
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
    // Only check non-disabled (non-locked) inputs
    const nonLockedInputs = Array.from(inputs).filter(input => !input.disabled);
    const allFilled = nonLockedInputs.every(input => input.value.trim() !== '');
    this.elements.submitBtn.disabled = !allFilled || nonLockedInputs.length === 0;
  }

  handleSubmit() {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    const answers = Array.from(inputs).map(input => input.value.trim());

    // Check if all non-locked fields are filled
    const nonLockedInputs = Array.from(inputs).filter((input, index) => !this.game.isBlankLocked(index));
    const nonLockedAnswers = nonLockedInputs.map(input => input.value.trim());

    if (nonLockedAnswers.some(answer => answer === '')) {
      alert('Please fill in all blanks before submitting.');
      return;
    }

    // Submit answers and get results
    this.currentResults = this.game.submitAnswers(answers);

    // Record attempts in analytics only for blanks attempted in this submission
    this.currentResults.results.forEach(result => {
      if (result.attemptedThisRound) {
        this.analytics.recordAttempt(result.blankIndex, result.isCorrect);
      }
    });

    // Handle retry vs final display
    if (this.currentResults.canRetry) {
      this.displayRetryUI(this.currentResults);
    } else {
      // Final submission - send analytics
      this.sendAnalytics(this.currentResults.passed);
      this.displayResults(this.currentResults);
    }
  }

  /**
   * Display UI for retry mode - lock correct answers, highlight wrong ones
   */
  displayRetryUI(results) {
    this.isRetrying = true;
    // Ensure skip can be used during this retry cycle
    this._skipInProgress = false;
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');

    results.results.forEach((result, index) => {
      const input = inputs[index];
      if (!input) return;

      if (result.isCorrect || result.isLocked) {
        // Lock correct answers - show green background and disable
        input.classList.add('correct');
        input.classList.remove('incorrect');
        input.style.backgroundColor = '#dcfce7'; // Light green
        input.style.borderColor = '#16a34a';
        input.disabled = true;
        input.value = result.correctAnswer;
      } else {
        // Highlight wrong answers - show red border, keep editable
        input.classList.add('incorrect');
        input.classList.remove('correct');
        input.style.backgroundColor = '#fef2f2'; // Light red
        input.style.borderColor = '#dc2626';
        input.disabled = false;
        // Clear wrong answer for retry
        input.value = '';
      }
    });

    // Update result message
    this.elements.result.textContent = results.feedbackText;
    this.elements.result.className = 'mt-4 text-center font-semibold text-amber-600';

    // Update submit button text and show skip button
    this.elements.submitBtn.textContent = 'Try Again';
    this.elements.submitBtn.disabled = true; // Will be enabled when user types
    if (this.elements.skipBtn) {
      this.elements.skipBtn.classList.remove('hidden');
      this.elements.skipBtn.disabled = false; // Ensure skip is clickable on retries
      this.elements.skipBtn.removeAttribute('disabled');
      this.elements.skipBtn.setAttribute('aria-disabled', 'false');
    } else {
    }

    // Focus first wrong input
    const firstWrongInput = Array.from(inputs).find(
      (input, index) => results.retryableIndices.includes(index)
    );
    if (firstWrongInput) {
      firstWrongInput.focus();
    }

    // Don't update streak display during retry - wait for final result
  }

  /**
   * Handle skip button - skip passage and move to next
   */
  async handleSkip() {
    console.log('handleSkip: START - v2');

    try {
      // Debounce multiple rapid clicks
      if (this._skipInProgress) {
        console.warn('handleSkip: already in progress, ignoring');
        return;
      }
      this._skipInProgress = true;
      if (this.elements?.skipBtn) {
        this.elements.skipBtn.disabled = true;
      }
      // Early exit if no game or blanks
      if (!this.game || !Array.isArray(this.game.blanks) || this.game.blanks.length === 0) {
        console.warn('handleSkip: No game/blanks, going to next passage');
        this.handleNext();
        return;
      }

      // Send analytics as failed (non-blocking)
      console.log('📊 Sending analytics (skip - passage failed)...');
      this.sendAnalytics(false).catch(err => console.warn('📊 Analytics (skip) failed non-critically:', err));

      // Use engine to force-complete this passage to ensure consistent results/state
      const finalResults = this.game.forceCompletePassage();
      console.log('handleSkip: forceCompletePassage results:', finalResults);

      // Show the results (which reveals correct answers)
      console.log('handleSkip: calling displayResults');
      this.lastRevealWasSkip = true;
      this.displayResults(finalResults);
      console.log('handleSkip: displayResults completed');

      // Hide skip button
      this.elements.skipBtn.classList.add('hidden');

      // Hide submit button
      this.elements.submitBtn.style.display = 'none';

      // Show the next button immediately after skip
      this.elements.nextBtn.classList.remove('hidden');
    } catch (error) {
      console.error('handleSkip ERROR:', error);
      // Fallback: attempt to force-complete and reveal, or at least enable Next
      try {
        if (this.game?.forceCompletePassage) {
          const fallbackResults = this.game.forceCompletePassage();
          this.lastRevealWasSkip = true;
          this.displayResults(fallbackResults);
        } else {
          this.elements.nextBtn.classList.remove('hidden');
        }
      } catch (fallbackError) {
        console.warn('handleSkip fallback failed; showing Next button:', fallbackError);
        this.elements.nextBtn.classList.remove('hidden');
      }
    } finally {
      // Reset guard so future rounds can skip normally
      this._skipInProgress = false;
    }
  }

  /**
   * Send analytics data to backend
   */
  async sendAnalytics(passed) {
    try {
      await this.analytics.completePassage(passed);
    } catch (error) {
      // Non-critical - don't break gameplay
      console.warn('📊 Analytics send failed (non-critical):', error);
    }
  }

  displayResults(results) {
    let message = `Score: ${results.correct}/${results.total}`;

    if (results.passed) {
      // Check if level was just advanced
      if (results.justAdvancedLevel) {
        message += ` - Level ${results.currentLevel} unlocked!`;

        // Check for milestone notification (every 5 levels)
        if (results.currentLevel % 5 === 0) {
          this.leaderboardUI.showMilestoneNotification(results.currentLevel);
        }

        // Check for high score
        this.checkForHighScore();
      } else {
        message += ` - Passed!`;
      }
      this.elements.result.className = 'mt-4 text-center font-semibold text-green-600';
    } else {
      message += ` - Failed (need ${results.requiredCorrect} correct)`;
      this.elements.result.className = 'mt-4 text-center font-semibold text-red-600';
    }

    this.elements.result.textContent = message;

    // Always reveal answers at the end of each round
    this.revealAnswersInPlace(results.results);

    // Show next button and hide submit/skip buttons
    this.elements.submitBtn.style.display = 'none';
    if (this.elements.skipBtn) {
      this.elements.skipBtn.classList.add('hidden');
    }
    this.elements.nextBtn.classList.remove('hidden');

    // Update streak display after processing results
    this.updateStreakDisplay();
  }

  updateStreakDisplay() {
    const stats = this.game.leaderboardService.getPlayerStats();
    const currentStreak = stats.currentStreak;
    
    if (currentStreak > 0) {
      this.elements.streakInfo.innerHTML = `🔥 ${currentStreak} streak`;
      this.elements.streakInfo.classList.remove('hidden');
    } else {
      this.elements.streakInfo.classList.add('hidden');
    }
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
    if(!await this.accountWork.newRound())return;
    try {
      // Show loading immediately with specific message
      this.showLoading(true, 'Loading passages...');

      // Clear chat history when starting new round
      this.chatUI.clearChatHistory();

      // Always show loading for at least 1 second for smooth UX
      const startTime = Date.now();

      // Load next round
      const roundData = await this.game.nextRound();

      // Ensure loading is shown for at least half a second
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
      }

      this.displayRound(roundData);
      this.resetUI();
      this.showLoading(false);
      this.accountWork.changed();
    } catch (error) {
      console.error('Error loading next round:', error);
      this.showError('Could not load next round. Please try again.');
    }
  }

  // Reveal correct answers immediately after submission
  revealAnswersInPlace(results) {
    const inputs = this.elements.passageContent.querySelectorAll('.cloze-input');
    // Remove any previously rendered external labels to avoid duplicates
    const existingLabels = this.elements.passageContent.querySelectorAll('.correct-answer-reveal');
    existingLabels.forEach(node => node.remove());

    results.forEach((result, index) => {
      const input = inputs[index];
      if (input) {
        // Always set the correct answer in the input
        input.value = result.correctAnswer;

        if (this.lastRevealWasSkip) {
          // Neutral reveal on skip: no red/green styling
          input.classList.remove('correct', 'incorrect');
          input.style.backgroundColor = '';
          input.style.borderColor = '';
        } else {
          // Normal reveal with visual feedback
          if (result.isCorrect) {
            input.classList.add('correct');
            input.classList.remove('incorrect');
            input.style.backgroundColor = '#dcfce7'; // Light green
            input.style.borderColor = '#16a34a'; // Green border
          } else {
            input.classList.add('incorrect');
            input.classList.remove('correct');
            input.style.backgroundColor = '#fef2f2'; // Light red
            input.style.borderColor = '#dc2626'; // Red border
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
    this.elements.hintBtn.setAttribute('aria-expanded', String(isHidden));
    if (isHidden) this.elements.hintsSection.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  resetUI() {
    this.elements.result.textContent = '';
    this.elements.submitBtn.style.display = 'inline-block';
    this.elements.submitBtn.disabled = true;
    this.elements.submitBtn.textContent = 'Submit'; // Reset button text
    if (this.elements.skipBtn) {
      this.elements.skipBtn.classList.add('hidden'); // Hide skip button
      this.elements.skipBtn.disabled = false; // Re-enable for new round
      this.elements.skipBtn.removeAttribute('disabled');
      this.elements.skipBtn.setAttribute('aria-disabled', 'false');
    }
    this.elements.nextBtn.classList.add('hidden');
    this.elements.hintsSection.style.display = 'none';
    this.elements.hintBtn.textContent = 'Show Hints';
    this.elements.hintBtn.setAttribute('aria-expanded', 'false');
    this.currentResults = null;
    this.currentHints = [];
    this.isRetrying = false; // Reset retry state
    this._skipInProgress = false; // Allow skip again in new round
    this.lastRevealWasSkip = false;
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

  checkForHighScore() {
    // Check if current score qualifies for leaderboard
    if (this.game.checkForHighScore()) {
      const rank = this.game.getHighScoreRank();
      const stats = this.game.leaderboardService.getStats();

      // Always show initials entry when achieving a high score
      // Pre-fills with previous initials if available, allowing changes
      this.leaderboardUI.showInitialsEntry(
        stats.highestLevel,
        stats.roundAtHighestLevel,
        rank,
        (initials) => {
          // Save to leaderboard
          const finalRank = this.game.addToLeaderboard(initials);
        }
      );
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.clozeApp=app;
  const ask=app.game.chatService.askQuestion.bind(app.game.chatService);
  app.game.chatService.askQuestion=async(...args)=>{const value=await ask(...args);app.accountWork.changed();return value;};
  
  // Show welcome overlay immediately before any loading
  // Start directly in the exercise. Instructions remain available in About this project.
  
  app.initialize();
  
  // Expose API key setter for browser console
  window.setOpenRouterKey = (key) => {
    app.game.chatService.aiService.setApiKey(key);
  };
});
