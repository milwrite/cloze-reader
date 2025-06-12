// Welcome overlay for first-time users
class WelcomeOverlay {
  constructor() {
    this.isVisible = false;
    this.hasBeenShown = localStorage.getItem('cloze-reader-welcomed') === 'true';
  }

  show() {
    if (this.hasBeenShown) return;
    
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
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      margin: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
      <h1 style="margin: 0 0 24px 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">
        Cloze Reader
      </h1>
      
      <div style="text-align: left; color: #4a4a4a; line-height: 1.6; margin-bottom: 32px;">
        <p style="margin: 0 0 16px 0;">
          <strong>Practice reading comprehension</strong> by filling in missing words from classic literature passages.
        </p>
        
        <p style="margin: 0 0 16px 0;">
          <strong>How to play:</strong> Read the passage, fill in the blanks, and use hints or chat help (💬) if needed. Progress through levels as you improve.
        </p>
        
        <p style="margin: 0 0 16px 0;">
          <strong>Data source:</strong> Passages from Project Gutenberg's public domain collection, processed via Hugging Face Datasets.
        </p>
        
        <p style="margin: 0 0 0 0;">
          <strong>AI assistance:</strong> Powered by Google's Gemma 3 model via OpenRouter for intelligent word selection and contextual hints.
        </p>
      </div>

      <button id="welcome-start-btn" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 32px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
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
}

export default WelcomeOverlay;