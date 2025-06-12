// Welcome overlay for first-time users
class WelcomeOverlay {
  constructor() {
    this.isVisible = false;
    this.hasBeenShown = localStorage.getItem('cloze-reader-welcomed') === 'true';
  }

  show() {
    console.log('WelcomeOverlay.show() called, hasBeenShown:', this.hasBeenShown);
    // Always show overlay regardless of previous views
    
    this.isVisible = true;
    const overlay = this.createOverlay();
    document.body.appendChild(overlay);
    console.log('Welcome overlay added to DOM');
    
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
      <div style="display: flex; justify-content: center; margin-bottom: 16px;">
        <img src="https://raw.githubusercontent.com/zmuhls/cloze-reader/main/icon.png" 
             alt="Cloze Reader" 
             style="width: 64px; height: 64px; border-radius: 8px;">
      </div>
      <h1 class="welcome-title">
        Cloze Reader
      </h1>
      
      <div class="welcome-content">
        <p>
          <strong>Practice reading comprehension</strong> by filling in missing words from historical and literary texts.
        </p>
        
        <p>
          <strong>How to play:</strong> Read the passage, fill in the blanks, and use hints or chat help (💬) if needed. Progress through levels as you improve.
        </p>
        
        <p>
          <strong>Data source:</strong> Historical and literary texts from Project Gutenberg's public domain collection, processed via Hugging Face Datasets.
        </p>
        
        <p style="margin-bottom: 0;">
          <strong>AI assistance:</strong> Powered by Google's Gemma 3 model via OpenRouter for intelligent word selection and contextual hints.
        </p>
      </div>

      <button id="welcome-start-btn" class="typewriter-button">
        Start Reading
      </button>
    `;

    overlay.appendChild(modal);

    // Add click handler
    const startBtn = modal.querySelector('#welcome-start-btn');
    startBtn.addEventListener('click', () => this.hide());

    // Allow clicking outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    return overlay;
  }

  hide() {
    const overlay = document.querySelector('.welcome-overlay');
    if (!overlay) return;

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