/**
 * Leaderboard Service
 * Manages high scores, player stats, and localStorage persistence
 * Following arcade conventions with 3-letter initials and top 10 tracking
 */

export class LeaderboardService {
  constructor() {
    this.storageKeys = {
      leaderboard: 'cloze-reader-leaderboard',
      player: 'cloze-reader-player',
      stats: 'cloze-reader-stats'
    };

    this.maxEntries = 10;

    // Reset all data on initialization (fresh start each session)
    this.resetAll();
    this.initializeStorage();
  }

  /**
   * Initialize localStorage with default values if needed
   */
  initializeStorage() {
    if (!this.getLeaderboard()) {
      this.saveLeaderboard([]);
    }

    if (!this.getPlayerProfile()) {
      this.savePlayerProfile({
        initials: null,
        hasEnteredInitials: false,
        gamesPlayed: 0,
        lastPlayed: null
      });
    }

    if (!this.getStats()) {
      this.saveStats(this.createEmptyStats());
    }
  }

  /**
   * Create empty stats object
   */
  createEmptyStats() {
    return {
      highestLevel: 1,
      roundAtHighestLevel: 1,
      totalPassagesPassed: 0,
      totalPassagesAttempted: 0,
      longestStreak: 0,
      currentStreak: 0,
      totalCorrectWords: 0,
      uniqueWordsCorrect: new Set(),
      gamesPlayed: 0,
      lastPlayed: null
    };
  }

  /**
   * Get leaderboard from localStorage
   */
  getLeaderboard() {
    try {
      const data = localStorage.getItem(this.storageKeys.leaderboard);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading leaderboard:', e);
      return [];
    }
  }

  /**
   * Save leaderboard to localStorage
   */
  saveLeaderboard(entries) {
    try {
      localStorage.setItem(this.storageKeys.leaderboard, JSON.stringify(entries));
    } catch (e) {
      console.error('Error saving leaderboard:', e);
    }
  }

  /**
   * Get player profile from localStorage
   */
  getPlayerProfile() {
    try {
      const data = localStorage.getItem(this.storageKeys.player);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading player profile:', e);
      return null;
    }
  }

  /**
   * Save player profile to localStorage
   */
  savePlayerProfile(profile) {
    try {
      localStorage.setItem(this.storageKeys.player, JSON.stringify(profile));
    } catch (e) {
      console.error('Error saving player profile:', e);
    }
  }

  /**
   * Get stats from localStorage
   */
  getStats() {
    try {
      const data = localStorage.getItem(this.storageKeys.stats);
      if (!data) return null;

      const stats = JSON.parse(data);
      // Convert uniqueWordsCorrect back to Set
      if (stats.uniqueWordsCorrect && Array.isArray(stats.uniqueWordsCorrect)) {
        stats.uniqueWordsCorrect = new Set(stats.uniqueWordsCorrect);
      } else {
        stats.uniqueWordsCorrect = new Set();
      }
      return stats;
    } catch (e) {
      console.error('Error reading stats:', e);
      return null;
    }
  }

  /**
   * Save stats to localStorage
   */
  saveStats(stats) {
    try {
      // Convert Set to Array for JSON serialization
      const statsToSave = {
        ...stats,
        uniqueWordsCorrect: Array.from(stats.uniqueWordsCorrect || [])
      };
      localStorage.setItem(this.storageKeys.stats, JSON.stringify(statsToSave));
    } catch (e) {
      console.error('Error saving stats:', e);
    }
  }

  /**
   * Validate and sanitize initials (3 letters, A-Z only)
   */
  validateInitials(initials) {
    if (!initials || typeof initials !== 'string') {
      return false;
    }

    const sanitized = initials.toUpperCase().replace(/[^A-Z]/g, '');
    return sanitized.length === 3 ? sanitized : false;
  }

  /**
   * Sort leaderboard entries
   * Primary: Level (desc), Secondary: Round (desc), Tertiary: Passages passed (desc)
   */
  sortLeaderboard(entries) {
    return entries.sort((a, b) => {
      // Primary: Level (higher is better)
      if (b.level !== a.level) {
        return b.level - a.level;
      }

      // Secondary: Round at that level (higher is better)
      if (b.round !== a.round) {
        return b.round - a.round;
      }

      // Tertiary: Total passages passed (higher is better)
      if (b.passagesPassed !== a.passagesPassed) {
        return b.passagesPassed - a.passagesPassed;
      }

      // Quaternary: Date (newer is better)
      return new Date(b.date) - new Date(a.date);
    });
  }

  /**
   * Check if a score qualifies for the leaderboard
   */
  qualifiesForLeaderboard(level, round, passagesPassed) {
    const leaderboard = this.getLeaderboard();

    // If leaderboard isn't full, always qualifies
    if (leaderboard.length < this.maxEntries) {
      return true;
    }

    // Check if better than lowest entry
    const lowestEntry = leaderboard[leaderboard.length - 1];

    if (level > lowestEntry.level) return true;
    if (level === lowestEntry.level && round > lowestEntry.round) return true;
    if (level === lowestEntry.level && round === lowestEntry.round && passagesPassed > lowestEntry.passagesPassed) return true;

    return false;
  }

  /**
   * Get the rank position for a score (1-10, or null if doesn't qualify)
   */
  getRankForScore(level, round, passagesPassed) {
    if (!this.qualifiesForLeaderboard(level, round, passagesPassed)) {
      return null;
    }

    const leaderboard = this.getLeaderboard();
    const tempEntry = { level, round, passagesPassed, date: new Date().toISOString() };
    const tempLeaderboard = [...leaderboard, tempEntry];
    const sorted = this.sortLeaderboard(tempLeaderboard);

    return sorted.findIndex(entry => entry === tempEntry) + 1;
  }

  /**
   * Add a new entry to the leaderboard
   */
  addEntry(initials, level, round, passagesPassed) {
    const validInitials = this.validateInitials(initials);
    if (!validInitials) {
      console.error('Invalid initials:', initials);
      return false;
    }

    const leaderboard = this.getLeaderboard();
    const newEntry = {
      initials: validInitials,
      level,
      round,
      passagesPassed,
      date: new Date().toISOString()
    };

    leaderboard.push(newEntry);
    const sorted = this.sortLeaderboard(leaderboard);

    // Keep only top 10
    const trimmed = sorted.slice(0, this.maxEntries);
    this.saveLeaderboard(trimmed);

    return sorted.findIndex(entry => entry === newEntry) + 1; // Return rank
  }

  /**
   * Update session stats after a passage attempt
   */
  updateStats(data) {
    const stats = this.getStats() || this.createEmptyStats();

    console.log('📊 LEADERBOARD: Updating stats', {
      before: { attempted: stats.totalPassagesAttempted, passed: stats.totalPassagesPassed, level: stats.highestLevel },
      passResult: data.passed,
      currentLevel: data.currentLevel
    });

    stats.totalPassagesAttempted++;

    if (data.passed) {
      stats.totalPassagesPassed++;
      stats.currentStreak++;
      stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }

    // Track highest level reached
    if (data.currentLevel > stats.highestLevel) {
      stats.highestLevel = data.currentLevel;
      stats.roundAtHighestLevel = data.round;
    } else if (data.currentLevel === stats.highestLevel) {
      stats.roundAtHighestLevel = Math.max(stats.roundAtHighestLevel, data.round);
    }

    // Track correct words
    if (data.results) {
      data.results.forEach(result => {
        if (result.isCorrect) {
          stats.totalCorrectWords++;
          const word = result.correctAnswer.toLowerCase();
          stats.uniqueWordsCorrect.add(word);
        }
      });
    }

    stats.lastPlayed = new Date().toISOString();

    console.log('📊 LEADERBOARD: Stats updated', {
      after: { attempted: stats.totalPassagesAttempted, passed: stats.totalPassagesPassed, level: stats.highestLevel }
    });

    this.saveStats(stats);
    return stats;
  }

  /**
   * Get formatted leaderboard for display
   */
  getFormattedLeaderboard() {
    const leaderboard = this.getLeaderboard();
    const player = this.getPlayerProfile();
    const stats = this.getStats();

    return {
      entries: leaderboard.map((entry, index) => ({
        rank: index + 1,
        initials: entry.initials,
        level: entry.level,
        round: entry.round,
        passagesPassed: entry.passagesPassed,
        date: entry.date,
        isPlayer: player && player.initials === entry.initials
      })),
      playerBest: stats ? {
        level: stats.highestLevel,
        round: stats.roundAtHighestLevel,
        passagesPassed: stats.totalPassagesPassed
      } : null,
      playerInitials: player ? player.initials : null
    };
  }

  /**
   * Reset all leaderboard data (fresh start each session)
   */
  resetAll() {
    console.log('🔄 LEADERBOARD: Starting fresh session (stats reset on page load)');
    this.saveLeaderboard([]);
    this.savePlayerProfile({
      initials: null,
      hasEnteredInitials: false,
      gamesPlayed: 0,
      lastPlayed: null
    });
    this.saveStats(this.createEmptyStats());
  }

  /**
   * Get player stats summary
   */
  getPlayerStats() {
    const stats = this.getStats() || this.createEmptyStats();
    const profile = this.getPlayerProfile();

    return {
      initials: profile?.initials || '---',
      highestLevel: stats.highestLevel,
      roundAtHighestLevel: stats.roundAtHighestLevel,
      totalPassagesPassed: stats.totalPassagesPassed,
      totalPassagesAttempted: stats.totalPassagesAttempted,
      successRate: stats.totalPassagesAttempted > 0
        ? Math.round((stats.totalPassagesPassed / stats.totalPassagesAttempted) * 100)
        : 0,
      longestStreak: stats.longestStreak,
      currentStreak: stats.currentStreak,
      totalCorrectWords: stats.totalCorrectWords,
      uniqueWords: stats.uniqueWordsCorrect.size,
      gamesPlayed: stats.gamesPlayed,
      lastPlayed: stats.lastPlayed
    };
  }
}
