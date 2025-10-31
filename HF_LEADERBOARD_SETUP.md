# Hugging Face Leaderboard Setup

This document explains how the HF Hub leaderboard integration works and how to set it up.

## Overview

The leaderboard system now supports two modes:
1. **HF Hub Mode** (persistent, shared across all users)
2. **localStorage Mode** (fallback, local to browser)

When HF Hub is available, all leaderboard entries are:
- Saved to a HF Hub dataset repository
- Automatically synced across all users
- Version controlled with commit history
- Persistent across sessions and devices

## Setup Instructions

### 1. Get Hugging Face Token

1. Go to https://huggingface.co/settings/tokens
2. Create a new token with **write** access
3. Copy the token value

### 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Hugging Face API Token
HF_TOKEN=hf_your_token_here

# Optional: Custom repository name (defaults to zmuhls/cloze-reader-leaderboard)
HF_LEADERBOARD_REPO=your_username/your-repo-name
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

This will install `huggingface-hub` along with other dependencies.

### 4. Run the Server

```bash
# Production mode (with HF backend)
make dev-python
# OR
python app.py

# The server will:
# 1. Check for HF_TOKEN in environment
# 2. Create the HF dataset repository if it doesn't exist
# 3. Initialize with empty leaderboard
# 4. Handle all read/write operations via API endpoints
```

### 5. Test the Integration

Visit `http://localhost:7860` and:
1. Play the game to reach Level 2
2. Enter your initials
3. Check browser console for HF sync messages:
   - `🔧 LEADERBOARD: Using HF Hub backend`
   - `📤 LEADERBOARD: Saved to HF Hub`
   - `📥 LEADERBOARD: Synced from HF Hub`

## Architecture

### Backend (Python)

**`hf_leaderboard.py`** - HF Hub integration service
- Creates/manages HF dataset repository
- Handles leaderboard read/write/update operations
- Auto-commits changes to HF Hub
- Uses `huggingface_hub` Python library

**`app.py`** - FastAPI endpoints
- `GET /api/leaderboard` - Fetch current leaderboard
- `POST /api/leaderboard/add` - Add new entry
- `POST /api/leaderboard/update` - Replace entire leaderboard
- `DELETE /api/leaderboard/clear` - Clear all entries (admin)

### Frontend (JavaScript)

**`src/hfLeaderboardAPI.js`** - API client
- Communicates with FastAPI backend
- Handles network errors gracefully
- Provides async methods for all operations

**`src/leaderboardService.js`** - Service layer (updated)
- Checks HF availability on init
- Syncs from HF Hub on page load
- Saves to both HF and localStorage
- Falls back to localStorage if HF unavailable

## Data Format

Leaderboard entries are stored as JSON on HF Hub:

```json
{
  "leaderboard": [
    {
      "initials": "ABC",
      "level": 5,
      "round": 2,
      "passagesPassed": 18,
      "date": "2025-01-31T12:00:00.000Z"
    }
  ],
  "last_updated": "2025-01-31T12:00:00.000Z",
  "version": "1.0"
}
```

## How It Works

### On Page Load
1. Frontend checks if backend is available (`/api/leaderboard`)
2. If available, sets `useHF = true`
3. Syncs leaderboard from HF Hub to localStorage
4. User sees most recent global leaderboard

### When Player Achieves High Score
1. Entry saved to localStorage immediately (fast UI update)
2. Entry sent to backend API (`POST /api/leaderboard/add`)
3. Backend adds entry to HF Hub with auto-commit
4. All other users will see updated leaderboard on next load

### Fallback Behavior
If HF backend is unavailable (no token, network error, etc.):
- System automatically uses localStorage only
- Leaderboard still works, just not shared
- Console shows: `⚠️ LEADERBOARD: HF backend unavailable, using localStorage`

## Viewing Your HF Dataset

After first save, visit:
```
https://huggingface.co/datasets/YOUR_USERNAME/cloze-reader-leaderboard
```

You'll see:
- `leaderboard.json` file
- Commit history of all updates
- Public leaderboard accessible to all

## Production Deployment

### Hugging Face Spaces
If deploying on HF Spaces, the token is automatically available:
```python
# HF Spaces provides HF_TOKEN automatically
# No .env file needed!
```

### Other Platforms (Vercel, Railway, etc.)
Add `HF_TOKEN` to your platform's environment variables:
- Vercel: Project Settings → Environment Variables
- Railway: Project → Variables
- Render: Environment → Environment Variables

## Security Notes

- ✅ HF Token stored securely in backend environment
- ✅ Token never exposed to frontend/browser
- ✅ All HF operations go through backend API
- ✅ CORS configured for security
- ⚠️ Leaderboard dataset should be **public** (read access for all users)
- ⚠️ Write access controlled via backend (users can't directly modify HF dataset)

## Troubleshooting

### "No HF token available for writing"
- Check `.env` file has `HF_TOKEN` or `HF_API_KEY`
- Restart server after adding token
- Verify token has write permissions

### "Failed to create HF repo"
- Check token permissions (need write access)
- Verify repository name format (username/repo-name)
- Check if repo already exists

### Leaderboard not syncing
- Check browser console for error messages
- Verify backend is running (`http://localhost:7860/api/leaderboard`)
- Check network tab for failed API calls
- Ensure HF Hub is accessible (not blocked by firewall)

### Backend logs show errors
```bash
# Check logs for detailed error messages
python app.py

# Look for:
# ✅ "Using existing HF dataset: ..."
# ✅ "Leaderboard saved to HF Hub: ..."
# ❌ "Failed to upload to HF Hub: ..."
```

## Development vs Production

**Local Development** (`make dev` - static server):
- Uses localStorage only
- No backend, no HF sync
- Fast iteration, no setup needed

**Production** (`make dev-python` - FastAPI server):
- Uses HF Hub backend
- Requires token and backend running
- Shared global leaderboard

## API Documentation

Once server is running, visit:
- FastAPI docs: `http://localhost:7860/docs`
- Alternative docs: `http://localhost:7860/redoc`

Interactive API testing available through Swagger UI!
