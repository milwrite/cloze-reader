/**
 * HF Leaderboard API Client
 * Communicates with FastAPI backend for HF Hub leaderboard persistence
 */

export class HFLeaderboardAPI {
  constructor(baseUrl = '') {
    // If no baseUrl provided, use current origin (works for both dev and production)
    this.baseUrl = baseUrl || window.location.origin;
  }

  /**
   * Get leaderboard from HF Hub
   * @returns {Promise<Array>} Array of leaderboard entries
   */
  async getLeaderboard() {
    try {
      const response = await fetch(`${this.baseUrl}/api/leaderboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('📥 HF API: Retrieved leaderboard', {
          entries: data.leaderboard.length,
          message: data.message
        });
        return data.leaderboard;
      } else {
        throw new Error(data.message || 'Failed to retrieve leaderboard');
      }
    } catch (error) {
      console.error('❌ HF API: Error fetching leaderboard:', error);
      throw error;
    }
  }

  /**
   * Add new entry to leaderboard
   * @param {Object} entry - Leaderboard entry {initials, level, round, passagesPassed, date}
   * @returns {Promise<Object>} Response object
   */
  async addEntry(entry) {
    try {
      const response = await fetch(`${this.baseUrl}/api/leaderboard/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ HF API: Added entry', {
        initials: entry.initials,
        level: entry.level,
        message: data.message
      });

      return data;
    } catch (error) {
      console.error('❌ HF API: Error adding entry:', error);
      throw error;
    }
  }

  /**
   * Update entire leaderboard
   * @param {Array} entries - Array of leaderboard entries
   * @returns {Promise<Object>} Response object
   */
  async updateLeaderboard(entries) {
    try {
      const response = await fetch(`${this.baseUrl}/api/leaderboard/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entries)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ HF API: Updated leaderboard', {
        entries: entries.length,
        message: data.message
      });

      return data;
    } catch (error) {
      console.error('❌ HF API: Error updating leaderboard:', error);
      throw error;
    }
  }

  /**
   * Clear all leaderboard data (admin function)
   * @returns {Promise<Object>} Response object
   */
  async clearLeaderboard() {
    try {
      const response = await fetch(`${this.baseUrl}/api/leaderboard/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();

      console.log('✅ HF API: Cleared leaderboard', {
        message: data.message
      });

      return data;
    } catch (error) {
      console.error('❌ HF API: Error clearing leaderboard:', error);
      throw error;
    }
  }

  /**
   * Check if HF backend is available
   * @returns {Promise<boolean>} True if backend is reachable
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/leaderboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.warn('⚠️ HF API: Backend not available, will use localStorage fallback');
      return false;
    }
  }
}
