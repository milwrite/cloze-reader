from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import logging

# Load environment variables from .env file
load_dotenv()

# Import HF Leaderboard Service
from hf_leaderboard import HFLeaderboardService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize HF Leaderboard Service
# Using dedicated leaderboard Space: milwright/cloze-leaderboard
hf_token = os.getenv("HF_TOKEN")
try:
    hf_leaderboard = HFLeaderboardService(
        repo_id="milwright/cloze-leaderboard",  # Dedicated leaderboard Space
        token=hf_token
    )
except ValueError as e:
    logger.warning(f"Could not initialize HF Leaderboard Service: {e}")
    logger.warning("Leaderboard will use localStorage fallback only")
    hf_leaderboard = None

# Pydantic models for API
class LeaderboardEntry(BaseModel):
    initials: str
    level: int
    round: int
    passagesPassed: int
    date: str

class LeaderboardResponse(BaseModel):
    success: bool
    leaderboard: List[LeaderboardEntry]
    message: Optional[str] = None

# Mount static files
app.mount("/src", StaticFiles(directory="src"), name="src")

@app.get("/icon.png")
async def get_icon():
    # Redirect to GitHub-hosted icon
    return RedirectResponse(url="https://raw.githubusercontent.com/zmuhls/cloze-reader/main/icon.png")

@app.get("/")
async def read_root():
    # Read the HTML file and inject environment variables
    with open("index.html", "r") as f:
        html_content = f.read()
    
    # Inject environment variables as a script
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    hf_key = os.getenv("HF_API_KEY", "")
    
    # Create a CSP-compliant way to inject the keys
    env_script = f"""
    <meta name="openrouter-key" content="{openrouter_key}">
    <meta name="hf-key" content="{hf_key}">
    <script src="./src/init-env.js"></script>
    """
    
    # Insert the script before closing head tag
    html_content = html_content.replace("</head>", env_script + "</head>")
    
    return HTMLResponse(content=html_content)


# ===== LEADERBOARD API ENDPOINTS =====

@app.get("/api/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard():
    """
    Get current leaderboard data from HF Hub
    """
    if not hf_leaderboard:
        return {
            "success": True,
            "leaderboard": [],
            "message": "HF leaderboard not available (using localStorage only)"
        }

    try:
        leaderboard = hf_leaderboard.get_leaderboard()
        return {
            "success": True,
            "leaderboard": leaderboard,
            "message": f"Retrieved {len(leaderboard)} entries"
        }
    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/leaderboard/add")
async def add_leaderboard_entry(entry: LeaderboardEntry):
    """
    Add new entry to leaderboard
    """
    if not hf_leaderboard:
        raise HTTPException(status_code=503, detail="HF leaderboard not available")

    try:
        success = hf_leaderboard.add_entry(entry.dict())
        if success:
            return {
                "success": True,
                "message": f"Added {entry.initials} to leaderboard"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to add entry")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/leaderboard/update")
async def update_leaderboard(entries: List[LeaderboardEntry]):
    """
    Update entire leaderboard (replace all data)
    """
    if not hf_leaderboard:
        raise HTTPException(status_code=503, detail="HF leaderboard not available")

    try:
        success = hf_leaderboard.update_leaderboard([e.dict() for e in entries])
        if success:
            return {
                "success": True,
                "message": "Leaderboard updated successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update leaderboard")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating leaderboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/leaderboard/clear")
async def clear_leaderboard():
    """
    Clear all leaderboard data (admin only)
    """
    if not hf_leaderboard:
        raise HTTPException(status_code=503, detail="HF leaderboard not available")

    try:
        success = hf_leaderboard.clear_leaderboard()
        if success:
            return {
                "success": True,
                "message": "Leaderboard cleared"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to clear leaderboard")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error clearing leaderboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)