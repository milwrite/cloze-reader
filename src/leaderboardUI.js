/**
 * Leaderboard UI
 * Modal display and initials entry interface
 * Following arcade conventions with vintage aesthetic
 */

export class LeaderboardUI {
  constructor(leaderboardService) {
    this.service = leaderboardService;
    this.modal = null;
    this.initialsModal = null;
    this.currentSlot = 0;
    this.initials = ['A', 'A', 'A'];
    this.onInitialsSubmit = null;
  }

  /**
   * Show the leaderboard modal
   */
  show() {
    // Remove existing modal if any
    this.hide();

    const data = this.service.getFormattedLeaderboard();
    const playerStats = this.service.getPlayerStats();

    // Create modal HTML
    this.modal = document.createElement('div');
    this.modal.className = 'leaderboard-overlay';
    this.modal.innerHTML = `
      <div class="leaderboard-modal">
        <div class="leaderboard-header">
          <h2 class="leaderboard-title">High Scores</h2>
          <button class="leaderboard-close" aria-label="Close leaderboard">×</button>
        </div>

        <div class="leaderboard-content">
          <div class="leaderboard-list">
            ${this.generateLeaderboardHTML(data.entries, data.playerInitials)}
          </div>

          ${playerStats.highestLevel > 1 ? `
            <div class="leaderboard-player-stats">
              <div class="player-best">
                Your Best: <span class="highlight">Level ${playerStats.highestLevel}</span>
              </div>
              <div class="player-stats-details">
                <div>Passages: ${playerStats.totalPassagesPassed}/${playerStats.totalPassagesAttempted} (${playerStats.successRate}%)</div>
                <div>Longest Streak: ${playerStats.longestStreak}</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Animate in
    requestAnimationFrame(() => {
      this.modal.classList.add('visible');
    });

    // Add event listeners
    this.modal.querySelector('.leaderboard-close').addEventListener('click', () => this.hide());

    // Prevent clicks inside modal content from closing
    this.modal.querySelector('.leaderboard-modal').addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // ESC key to close
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Generate HTML for leaderboard entries
   */
  generateLeaderboardHTML(entries, playerInitials) {
    if (entries.length === 0) {
      return `
        <div class="leaderboard-empty">
          <p>No high scores yet!</p>
          <p class="text-sm">Be the first to reach Level 2!</p>
        </div>
      `;
    }

    return entries.map(entry => {
      const rankClass = this.getRankClass(entry.rank);
      const isPlayer = entry.initials === playerInitials;
      const playerClass = isPlayer ? 'player-entry' : '';

      return `
        <div class="leaderboard-entry ${rankClass} ${playerClass}">
          <span class="entry-rank">#${entry.rank}</span>
          <span class="entry-initials">${entry.initials}</span>
          <span class="entry-score">Level ${entry.level}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Get CSS class for rank-based styling
   */
  getRankClass(rank) {
    if (rank === 1) return 'rank-gold';
    if (rank === 2 || rank === 3) return 'rank-silver';
    return 'rank-standard';
  }

  /**
   * Hide the leaderboard modal
   */
  hide() {
    if (this.modal) {
      this.modal.classList.remove('visible');
      setTimeout(() => {
        if (this.modal && this.modal.parentNode) {
          this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
      }, 300);
    }

    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
  }

  /**
   * Show initials entry screen for new high score
   */
  showInitialsEntry(level, round, rank, onSubmit) {
    // Store callback
    this.onInitialsSubmit = onSubmit;

    // Reset initials state
    this.currentSlot = 0;

    // Get existing player initials if available
    const profile = this.service.getPlayerProfile();
    if (profile && profile.initials) {
      this.initials = profile.initials.split('');
    } else {
      this.initials = ['A', 'A', 'A'];
    }

    // Remove existing modal
    this.hideInitialsEntry();

    // Create modal HTML
    this.initialsModal = document.createElement('div');
    this.initialsModal.className = 'leaderboard-overlay initials-overlay';
    this.initialsModal.innerHTML = `
      <div class="initials-modal">
        <div class="initials-header">
          <h2 class="initials-title">New High Score</h2>
          <div class="initials-achievement">
            You reached <span class="highlight">Level ${level}</span>
            <br>
            <span class="rank-text">${this.getRankText(rank)}</span>
          </div>
        </div>

        <div class="initials-content">
          <p class="initials-prompt">Enter or update your initials:</p>

          <div class="initials-slots">
            ${this.initials.map((letter, index) => `
              <div class="initial-slot ${index === 0 ? 'active' : ''}" data-slot="${index}">
                <div class="slot-letter">${letter}</div>
                <div class="slot-arrows">
                  <button class="arrow-up" data-slot="${index}" data-direction="up" aria-label="Increase letter">▲</button>
                  <button class="arrow-down" data-slot="${index}" data-direction="down" aria-label="Decrease letter">▼</button>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="initials-instructions">
            <p>Use arrow keys ↑↓ to change letters</p>
            <p>Press Tab or ←→ to move between slots</p>
            <p>Press Enter to submit</p>
          </div>

          <button class="initials-submit typewriter-button">
            Submit
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.initialsModal);

    // Animate in
    requestAnimationFrame(() => {
      this.initialsModal.classList.add('visible');
    });

    // Add event listeners
    this.setupInitialsEventListeners();
  }

  /**
   * Get rank description text
   */
  getRankText(rank) {
    const ordinal = this.getOrdinal(rank);
    if (rank === 1) return `${ordinal} place - Top Score`;
    if (rank === 2) return `${ordinal} place`;
    if (rank === 3) return `${ordinal} place`;
    return `${ordinal} place on the leaderboard`;
  }

  /**
   * Get ordinal suffix for rank (1st, 2nd, 3rd, etc.)
   */
  getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Setup event listeners for initials entry
   */
  setupInitialsEventListeners() {
    // Arrow buttons
    this.initialsModal.querySelectorAll('.arrow-up, .arrow-down').forEach(button => {
      button.addEventListener('click', (e) => {
        const slot = parseInt(e.target.dataset.slot);
        const direction = e.target.dataset.direction;
        this.changeInitialLetter(slot, direction === 'up' ? 1 : -1);
      });
    });

    // Slot clicking to select
    this.initialsModal.querySelectorAll('.initial-slot').forEach(slot => {
      slot.addEventListener('click', (e) => {
        if (!e.target.closest('.arrow-up') && !e.target.closest('.arrow-down')) {
          const slotIndex = parseInt(slot.dataset.slot);
          this.selectSlot(slotIndex);
        }
      });
    });

    // Submit button
    this.initialsModal.querySelector('.initials-submit').addEventListener('click', () => {
      this.submitInitials();
    });

    // Keyboard controls
    this.initialsKeyHandler = (e) => {
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.changeInitialLetter(this.currentSlot, 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.changeInitialLetter(this.currentSlot, -1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.selectSlot(Math.max(0, this.currentSlot - 1));
          break;
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          this.selectSlot(Math.min(2, this.currentSlot + 1));
          break;
        case 'Enter':
          e.preventDefault();
          this.submitInitials();
          break;
        case 'Escape':
          e.preventDefault();
          this.hideInitialsEntry();
          break;
      }
    };
    document.addEventListener('keydown', this.initialsKeyHandler);

    // Prevent modal close on backdrop click for initials entry
    this.initialsModal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Change letter in current slot
   */
  changeInitialLetter(slot, delta) {
    const currentChar = this.initials[slot].charCodeAt(0);
    let newChar = currentChar + delta;

    // Wrap around A-Z
    if (newChar > 90) newChar = 65; // After Z, go to A
    if (newChar < 65) newChar = 90; // Before A, go to Z

    this.initials[slot] = String.fromCharCode(newChar);
    this.updateInitialsDisplay();
  }

  /**
   * Select a specific slot
   */
  selectSlot(slot) {
    this.currentSlot = slot;
    this.initialsModal.querySelectorAll('.initial-slot').forEach((el, index) => {
      el.classList.toggle('active', index === slot);
    });
  }

  /**
   * Update the visual display of initials
   */
  updateInitialsDisplay() {
    this.initialsModal.querySelectorAll('.initial-slot').forEach((slot, index) => {
      slot.querySelector('.slot-letter').textContent = this.initials[index];
    });
  }

  /**
   * Submit initials and save to leaderboard
   */
  submitInitials() {
    const initialsString = this.initials.join('');

    // Save to player profile
    const profile = this.service.getPlayerProfile();
    profile.initials = initialsString;
    profile.hasEnteredInitials = true;
    this.service.savePlayerProfile(profile);

    // Call the callback
    if (this.onInitialsSubmit) {
      this.onInitialsSubmit(initialsString);
    }

    // Hide modal
    this.hideInitialsEntry();

    // Show success message briefly, then show leaderboard
    this.showSuccessMessage(() => {
      this.show();
    });
  }

  /**
   * Hide initials entry modal
   */
  hideInitialsEntry() {
    if (this.initialsModal) {
      this.initialsModal.classList.remove('visible');
      setTimeout(() => {
        if (this.initialsModal && this.initialsModal.parentNode) {
          this.initialsModal.parentNode.removeChild(this.initialsModal);
        }
        this.initialsModal = null;
      }, 300);
    }

    if (this.initialsKeyHandler) {
      document.removeEventListener('keydown', this.initialsKeyHandler);
      this.initialsKeyHandler = null;
    }
  }

  /**
   * Show success message after submitting initials
   */
  showSuccessMessage(onComplete) {
    const successDiv = document.createElement('div');
    successDiv.className = 'leaderboard-overlay visible';
    successDiv.innerHTML = `
      <div class="leaderboard-modal success-message">
        <div class="success-content">
          <h2>Score Saved</h2>
          <p>Your initials have been added to the leaderboard</p>
        </div>
      </div>
    `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
      successDiv.classList.remove('visible');
      setTimeout(() => {
        if (successDiv.parentNode) {
          successDiv.parentNode.removeChild(successDiv);
        }
        if (onComplete) {
          onComplete();
        }
      }, 300);
    }, 1500);
  }

  /**
   * Show notification toast for milestone achievement
   */
  showMilestoneNotification(level) {
    const toast = document.createElement('div');
    toast.className = 'milestone-toast';
    toast.innerHTML = `
      <div class="toast-content">
        Milestone Reached: Level ${level}
      </div>
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}
