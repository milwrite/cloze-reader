# Cloze Reader Leaderboard Implementation Roadmap

## Overview
This document outlines the implementation plan for adding a competitive leaderboard system to the Cloze Reader game, where players can submit their scores using 3-letter acronyms.

## Phase 1: Core Infrastructure (Week 1-2)

### 1.1 Database Schema
- Create leaderboard table structure:
  ```sql
  leaderboard {
    id: UUID
    acronym: VARCHAR(3)
    score: INTEGER
    level_reached: INTEGER
    total_time: INTEGER (seconds)
    created_at: TIMESTAMP
    ip_hash: VARCHAR(64) // For rate limiting
  }
  ```

### 1.2 API Endpoints
- `POST /api/leaderboard/submit` - Submit new score
- `GET /api/leaderboard/top/{period}` - Get top scores (daily/weekly/all-time)
- `GET /api/leaderboard/check-acronym/{acronym}` - Validate acronym availability

### 1.3 Score Calculation
- Base score = (correct_answers * 100) * level_multiplier
- Time bonus = max(0, 1000 - seconds_per_round)
- Streak bonus = consecutive_correct * 50

## Phase 2: Frontend Integration (Week 2-3)

### 2.1 UI Components
- **Leaderboard Modal** (`leaderboardModal.js`)
  - Top 10 display with rank, acronym, score, level
  - Period toggle (Today/Week/All-Time)
  - Personal best highlight

### 2.2 Score Submission Flow
- End-of-game prompt for acronym entry
- 3-letter validation (A-Z only)
- Profanity filter implementation
- Success/error feedback

### 2.3 Visual Elements
- Trophy icons for top 3 positions
- Animated score counter
- Level badges display

## Phase 3: Security & Performance (Week 3-4)

### 3.1 Anti-Cheat Measures
- Server-side score validation
- Rate limiting (1 submission per 5 minutes per IP)
- Score feasibility checks (max possible score per level)
- Request signing with session tokens

### 3.2 Caching Strategy
- Redis cache for top 100 scores
- 5-minute TTL for leaderboard queries
- Real-time updates for top 10 changes

### 3.3 Data Persistence
- PostgreSQL for primary storage
- Daily backups of leaderboard data
- Archived monthly snapshots

## Phase 4: Advanced Features (Week 4-5)

### 4.1 Achievement System
- "First Timer" - First leaderboard entry
- "Vocabulary Master" - 10+ correct in a row
- "Speed Reader" - Complete round < 30 seconds
- "Persistent Scholar" - Play 7 days straight

### 4.2 Social Features
- Share score to social media
- Challenge link generation
- Friend acronym tracking

### 4.3 Analytics Dashboard
- Player retention metrics
- Popular acronym analysis
- Score distribution graphs

## Technical Implementation Details

### Backend Changes Required

1. **FastAPI Endpoints** (`app.py`):
   ```python
   @app.post("/api/leaderboard/submit")
   async def submit_score(score_data: ScoreSubmission)
   
   @app.get("/api/leaderboard/top/{period}")
   async def get_leaderboard(period: str, limit: int = 10)
   ```

2. **Database Models** (`models.py` - new file):
   ```python
   class LeaderboardEntry(Base):
       __tablename__ = "leaderboard"
       # Schema implementation
   ```

3. **Validation Service** (`validation.py` - new file):
   - Acronym format validation
   - Profanity checking
   - Score feasibility verification

### Frontend Changes Required

1. **Game Engine Integration** (`clozeGameEngine.js`):
   - Track game metrics for scoring
   - Call submission API on game end
   - Store session data for validation

2. **UI Updates** (`app.js`):
   - Add leaderboard button to main menu
   - Integrate submission modal
   - Handle API responses

3. **New Modules**:
   - `leaderboardService.js` - API communication
   - `scoreCalculator.js` - Client-side scoring logic
   - `leaderboardUI.js` - UI component management

## Deployment Considerations

### Infrastructure Requirements
- Database: PostgreSQL 14+
- Cache: Redis 6+
- API rate limiting: nginx or API Gateway
- SSL certificate for secure submissions

### Environment Variables
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
LEADERBOARD_SECRET=... # For request signing
PROFANITY_API_KEY=... # Optional external service
```

### Migration Strategy
1. Deploy database schema
2. Enable API endpoints (feature flagged)
3. Gradual UI rollout (A/B testing)
4. Full launch with announcement

## Success Metrics

- **Engagement**: 30% of players submit scores
- **Retention**: 15% return to beat their score
- **Performance**: <100ms leaderboard load time
- **Security**: Zero validated cheating incidents

## Timeline Summary

- **Week 1-2**: Backend infrastructure
- **Week 2-3**: Frontend integration
- **Week 3-4**: Security hardening
- **Week 4-5**: Advanced features
- **Week 6**: Testing & deployment

## Open Questions

1. Should we allow Unicode characters in acronyms?
2. Reset frequency for periodic leaderboards?
3. Maximum entries per player per day?
4. Prize/reward system for top performers?