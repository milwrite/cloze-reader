// Welcome overlay for first-time users
class WelcomeOverlay {
  constructor() {
    this.isVisible = false;
    this.hasBeenShown = localStorage.getItem('cloze-reader-welcomed') === 'true';
  }

  show() {
    // Always show overlay regardless of previous views
    
    this.isVisible = true;
    const overlay = this.createOverlay();
    document.body.appendChild(overlay);
    
    // Animate in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.style.opacity = '0';

    const modal = document.createElement('div');
    modal.className = 'welcome-modal';
    modal.style.cssText = `
      max-width: 500px;
      margin: 20px;
      text-align: center;
    `;

    modal.innerHTML = `
      <div style="display: flex; justify-content: center; margin-bottom: 12px;">
        <img src="https://media.githubusercontent.com/media/milwrite/cloze-reader/main/icon.png"
             alt=""
             style="width: 48px; height: 48px; border-radius: 6px;"
             onerror="this.style.display='none'">
      </div>
      <h1 class="welcome-title">
        Cloze Reader
      </h1>
      
      <div class="welcome-content">
        <p>
          <strong>How to play:</strong> Fill in the blanks to advance through levels with increasing difficulty and vocabulary complexity.
        </p>

        <p>
          <strong>Data source:</strong> Excerpted historical and literary texts from Project Gutenberg's public domain collection, processed via Hugging Face Datasets.
        </p>

        <p style="margin-bottom: 0;">
          <strong>AI assistance:</strong> <span id="welcome-ai-mode">${this.aiModeText()}</span>
        </p>
      </div>

      <button id="welcome-start-btn" class="typewriter-button">
        Start Reading
      </button>
    `;

    overlay.appendChild(modal);

    // The local-server probe usually resolves after the overlay renders, so
    // keep the AI line in sync with the mode the game actually ends up using.
    this._onModeChange = () => {
      const span = modal.querySelector('#welcome-ai-mode');
      if (span) span.innerHTML = this.aiModeText();
    };
    window.addEventListener('cloze-ai-mode', this._onModeChange);

    // Add click handler
    const startBtn = modal.querySelector('#welcome-start-btn');
    startBtn.addEventListener('click', () => this.hide());

    // Allow clicking outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    return overlay;
  }

  // Describes whichever stack the AI service detected (set by aiService.js).
  aiModeText() {
    return window.__clozeAIMode === 'local'
      ? 'Powered by <a href="https://huggingface.co/milwright/cloze-reader-gemma-4-e4b-lora" target="_blank" rel="noopener" style="text-decoration: underline;">milwright/cloze-reader-gemma-4-e4b-lora</a>, a fine-tuned Gemma-4-E4B adapter.'
      : 'Powered by <a href="https://huggingface.co/google/gemma-3-27b-it" target="_blank" rel="noopener" style="text-decoration: underline;">google/gemma-3-27b-it</a> via OpenRouter.';
  }

  hide() {
    const overlay = document.querySelector('.welcome-overlay');
    if (!overlay) return;

    if (this._onModeChange) {
      window.removeEventListener('cloze-ai-mode', this._onModeChange);
      this._onModeChange = null;
    }

    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      this.isVisible = false;
      
      // Remember that user has seen welcome
      localStorage.setItem('cloze-reader-welcomed', 'true');
      this.hasBeenShown = true;
    }, 300);
  }

  // Method to reset welcome (for testing or new features)
  reset() {
    localStorage.removeItem('cloze-reader-welcomed');
    this.hasBeenShown = false;
  }

  // Force show overlay (for testing)
  forceShow() {
    this.hasBeenShown = false;
    this.show();
  }
}

export default WelcomeOverlay;
