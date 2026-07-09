from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import time
import json
import asyncio
import urllib.request
import urllib.parse
from dotenv import load_dotenv
import httpx
import logging

# Load environment variables from .env file
load_dotenv()

# Import Leaderboard Services (Redis primary, HF fallback)
from redis_leaderboard import RedisLeaderboardService
from redis_analytics import RedisAnalyticsService

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

# Initialize Leaderboard Service (Redis primary, HF Space fallback)
# REDIS_URL is auto-injected by Railway when Redis plugin is added
try:
    leaderboard_service = RedisLeaderboardService(
        redis_url=os.getenv("REDIS_URL"),
        hf_fallback_url="https://milwright-cloze-leaderboard.hf.space",
        hf_token=os.getenv("HF_TOKEN"),
    )
    if leaderboard_service.is_redis_available():
        logger.info("Leaderboard using Redis (primary) with HF Space (fallback)")
    else:
        logger.info("Leaderboard using HF Space (Redis unavailable)")
except Exception as e:
    logger.warning(f"Could not initialize Leaderboard Service: {e}")
    logger.warning("Leaderboard will use localStorage fallback only")
    leaderboard_service = None

# Initialize Analytics Service (Redis)
try:
    analytics_service = RedisAnalyticsService(redis_url=os.getenv("REDIS_URL"))
    if analytics_service.is_available():
        logger.info("Analytics Service using Redis")
    else:
        logger.info("Analytics Service unavailable (Redis not connected)")
except Exception as e:
    logger.warning(f"Could not initialize Analytics Service: {e}")
    analytics_service = None

# ===== HEALTH CHECK ENDPOINT =====

@app.get("/api/health")
async def health_check():
    """Diagnostic endpoint for Redis and service status"""
    redis_leaderboard_ok = False
    redis_analytics_ok = False

    if leaderboard_service:
        redis_leaderboard_ok = leaderboard_service.is_redis_available()
    if analytics_service:
        redis_analytics_ok = analytics_service.is_available()

    return {
        "status": "ok",
        "redis": {
            "leaderboard": "connected" if redis_leaderboard_ok else "disconnected",
            "analytics": "connected" if redis_analytics_ok else "disconnected",
        },
        "services": {
            "leaderboard": "initialized" if leaderboard_service else "unavailable",
            "analytics": "initialized" if analytics_service else "unavailable",
        },
    }


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


# Pydantic models for Analytics API
class WordAnalytics(BaseModel):
    word: str
    length: Optional[int] = None
    attemptsToCorrect: int = 1
    # Avoid mutable default list
    hintsUsed: List[str] = Field(default_factory=list)
    finalCorrect: bool = False


class PassageAnalytics(BaseModel):
    passageId: str
    sessionId: str
    bookTitle: str
    bookAuthor: str
    level: int
    round: int
    words: List[WordAnalytics]
    totalBlanks: int
    correctOnFirstTry: int
    totalHintsUsed: int
    passed: bool
    timestamp: Optional[str] = None

# Mount static files. /assets is the canonical path (moved off /src so the
# Cloudflare edge cache entries for the old URLs stopped serving stale module
# code after a deploy); /src stays for anything still linking the old path.
app.mount("/assets", StaticFiles(directory="src"), name="assets")
app.mount("/src", StaticFiles(directory="src"), name="src")


@app.middleware("http")
async def no_stale_assets(request, call_next):
    response = await call_next(request)
    path = request.url.path
    # ES-module imports resolve to bare asset URLs that ?v= busting can't
    # reach, and Cloudflare caches .js/.css for 4h by default — force edge
    # and browser revalidation so deploys take effect immediately.
    if path == "/" or path.startswith(("/assets/", "/src/")) or path.endswith(".html"):
        response.headers["Cache-Control"] = "no-cache"
    return response

@app.get("/icon.png")
async def get_icon():
    """Serve the app icon locally if available, else fallback to GitHub."""
    local_icon = "icon.png"
    if os.path.exists(local_icon):
        return FileResponse(local_icon, media_type="image/png")
    # Fallback to GitHub-hosted icon
    return RedirectResponse(url="https://media.githubusercontent.com/media/milwrite/cloze-reader/main/icon.png")

@app.get("/favicon.png")
async def get_favicon_png():
    """Serve favicon as PNG by pointing to the canonical PNG icon."""
    return await get_icon()

@app.get("/favicon.ico")
async def get_favicon_ico():
    """Serve an ICO route that points to our PNG so browsers can find it."""
    # Many browsers request /favicon.ico explicitly; return PNG is acceptable
    return await get_favicon_png()

@app.get("/favicon.svg")
async def get_favicon_svg():
    """Serve SVG favicon for browsers that support it."""
    # Prefer `icon.svg` if available
    for candidate in ["favicon.svg", "icon.svg"]:
        if os.path.exists(candidate):
            return FileResponse(candidate, media_type="image/svg+xml")
    # If missing, fall back to PNG icon
    return await get_favicon_png()

@app.get("/icon.svg")
async def get_icon_svg():
    """Serve the SVG icon at /icon.svg if present, else fallback to PNG."""
    candidate = "icon.svg"
    if os.path.exists(candidate):
        return FileResponse(candidate, media_type="image/svg+xml")
    return await get_icon()

@app.get("/apple-touch-icon.png")
async def get_apple_touch_icon():
    """Serve Apple touch icon, fallback to main icon."""
    candidate = "apple-touch-icon.png"
    if os.path.exists(candidate):
        return FileResponse(candidate, media_type="image/png")
    return await get_icon()

@app.get("/site.webmanifest")
async def site_manifest():
    """Serve the web app manifest if present, else a minimal generated one."""
    manifest_path = "site.webmanifest"
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/manifest+json")
    # Minimal default manifest
    content = {
        "name": "Cloze Reader",
        "short_name": "Cloze",
        "icons": [
            {"src": "./icon-192.png", "type": "image/png", "sizes": "192x192"},
            {"src": "./icon-512.png", "type": "image/png", "sizes": "512x512"}
        ],
        "start_url": "./",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#2c2826"
    }
    return JSONResponse(content=content, media_type="application/manifest+json")

@app.get("/icon-192.png")
async def get_icon_192():
    path = "icon-192.png"
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    return await get_icon()

@app.get("/icon-512.png")
async def get_icon_512():
    path = "icon-512.png"
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    return await get_icon()

@app.get("/admin")
async def admin_dashboard():
    """Serve the analytics admin dashboard"""
    with open("admin.html", "r") as f:
        return HTMLResponse(content=f.read())


@app.get("/")
async def read_root():
    with open("index.html", "r") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)


# ===== AI PROXY ENDPOINT =====

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

class AIChatRequest(BaseModel):
    model: str
    messages: list
    max_tokens: int = 200
    temperature: float = 0.5
    response_format: Optional[dict] = None

@app.post("/api/ai/chat")
async def proxy_ai_chat(request: AIChatRequest):
    """
    Proxy AI chat requests to OpenRouter so the API key never reaches the client.
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if not openrouter_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://reader.inference-arcade.com",
        "X-Title": "Cloze Reader",
    }

    payload = {
        "model": request.model,
        "messages": request.messages,
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
    }
    if request.response_format:
        payload["response_format"] = request.response_format

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(OPENROUTER_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenRouter API error: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=e.response.status_code, detail="AI provider error")
    except httpx.RequestError as e:
        logger.error(f"OpenRouter request failed: {e}")
        raise HTTPException(status_code=502, detail="AI provider unreachable")


# ===== LEADERBOARD API ENDPOINTS =====

@app.get("/api/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard():
    """
    Get current leaderboard data (Redis primary, HF Space fallback)
    """
    if not leaderboard_service:
        return {
            "success": True,
            "leaderboard": [],
            "message": "Leaderboard service not available (using localStorage only)"
        }

    try:
        leaderboard = leaderboard_service.get_leaderboard()
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
    if not leaderboard_service:
        raise HTTPException(status_code=503, detail="Leaderboard service not available")

    try:
        success = leaderboard_service.add_entry(entry.dict())
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
    if not leaderboard_service:
        raise HTTPException(status_code=503, detail="Leaderboard service not available")

    try:
        success = leaderboard_service.update_leaderboard([e.dict() for e in entries])
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
    if not leaderboard_service:
        raise HTTPException(status_code=503, detail="Leaderboard service not available")

    try:
        success = leaderboard_service.clear_leaderboard()
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


@app.post("/api/leaderboard/seed-from-hf")
async def seed_leaderboard_from_hf():
    """
    Force re-seed Redis leaderboard from HF Space (admin function).
    Use this to migrate existing HF Space data to Redis.
    """
    if not leaderboard_service:
        raise HTTPException(status_code=503, detail="Leaderboard service not available")

    try:
        success = leaderboard_service.force_seed_from_hf()
        if success:
            leaderboard = leaderboard_service.get_leaderboard()
            return {
                "success": True,
                "message": f"Seeded Redis with {len(leaderboard)} entries from HF Space",
                "entries": len(leaderboard)
            }
        else:
            return {
                "success": False,
                "message": "No entries found in HF Space to seed"
            }
    except Exception as e:
        logger.error(f"Error seeding leaderboard from HF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== ANALYTICS API ENDPOINTS =====

@app.post("/api/analytics/passage")
async def record_passage_analytics(data: PassageAnalytics):
    """
    Record a completed passage attempt with analytics data.
    Called by frontend when a passage is completed (pass or fail).
    """
    if not analytics_service:
        return {
            "success": False,
            "message": "Analytics service not initialized"
        }

    try:
        # Convert Pydantic models to dicts
        data_dict = data.dict()
        data_dict["words"] = [w.dict() for w in data.words]

        entry_id = analytics_service.record_passage(data_dict)
        if entry_id:
            return {
                "success": True,
                "entryId": entry_id,
                "message": "Passage analytics recorded"
            }
        else:
            return {
                "success": False,
                "message": "Failed to record analytics"
            }
    except Exception as e:
        logger.error(f"Error recording passage analytics: {e}")
        # Don't raise - analytics failure shouldn't break gameplay
        return {
            "success": False,
            "message": str(e)
        }


@app.get("/api/analytics/summary")
async def get_analytics_summary():
    """
    Get aggregate analytics statistics for admin dashboard.
    Returns totals, hardest/easiest words, and popular books.
    """
    if not analytics_service:
        return {
            "success": True,
            "data": {
                "totalPassages": 0,
                "totalSessions": 0,
                "hardestWords": [],
                "easiestWords": [],
                "popularBooks": []
            },
            "message": "Analytics service unavailable"
        }

    try:
        summary = analytics_service.get_summary()
        return {
            "success": True,
            "data": summary,
            "message": f"Retrieved analytics summary"
        }
    except Exception as e:
        logger.error(f"Error getting analytics summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/recent")
async def get_recent_analytics(count: int = 50):
    """
    Get recent passage attempts for admin review.

    Args:
        count: Number of recent entries to retrieve (default: 50, max: 200)
    """
    if not analytics_service:
        return {
            "success": True,
            "passages": [],
            "message": "Analytics service unavailable"
        }

    # Cap at 200 entries
    count = min(count, 200)

    try:
        passages = analytics_service.get_recent_passages(count)
        return {
            "success": True,
            "passages": passages,
            "count": len(passages),
            "message": f"Retrieved {len(passages)} recent passages"
        }
    except Exception as e:
        logger.error(f"Error getting recent analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/export")
async def export_all_analytics():
    """
    Export all analytics data as JSON (admin function).
    Use for backup or external analysis.
    """
    if not analytics_service:
        return {
            "success": False,
            "passages": [],
            "message": "Analytics service unavailable"
        }

    try:
        all_data = analytics_service.export_all()
        return {
            "success": True,
            "passages": all_data,
            "count": len(all_data),
            "message": f"Exported {len(all_data)} passage records"
        }
    except Exception as e:
        logger.error(f"Error exporting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/word/{word}")
async def get_word_statistics(word: str):
    """
    Get statistics for a specific word.
    Shows how often the word was correct on first try vs needing retries.
    """
    if not analytics_service:
        return {
            "success": True,
            "data": {"word": word, "firstTryCount": 0, "retryCount": 0},
            "message": "Analytics service unavailable"
        }

    try:
        stats = analytics_service.get_word_stats(word)
        return {
            "success": True,
            "data": stats,
            "message": f"Retrieved stats for '{word}'"
        }
    except Exception as e:
        logger.error(f"Error getting word stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/analytics/clear")
async def clear_all_analytics():
    """
    Clear all analytics data (admin function).
    WARNING: This permanently deletes all recorded analytics.
    """
    if not analytics_service:
        raise HTTPException(status_code=503, detail="Analytics service unavailable")

    try:
        success = analytics_service.clear_analytics()
        if success:
            return {
                "success": True,
                "message": "All analytics data cleared"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to clear analytics")
    except Exception as e:
        logger.error(f"Error clearing analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)


# ================== HF DATASETS PROXY ENDPOINTS ==================

HF_DATASETS_BASE = "https://datasets-server.huggingface.co"

# very small in-memory cache suitable for single-process app
_proxy_cache = {
    "splits": {},  # key -> {value, ts, ttl}
    "rows": {},
}


def _cache_get(bucket: str, key: str):
    entry = _proxy_cache.get(bucket, {}).get(key)
    if not entry:
        return None
    if time.time() - entry["ts"] > entry["ttl"]:
        try:
            del _proxy_cache[bucket][key]
        except Exception:
            pass
        return None
    return entry["value"]


def _cache_set(bucket: str, key: str, value, ttl: int):
    _proxy_cache.setdefault(bucket, {})[key] = {
        "value": value,
        "ts": time.time(),
        "ttl": ttl,
    }


def _fetch_sync(url: str, timeout: float = 3.0):
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "cloze-reader/1.0 (+fastapi-proxy)",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        status = resp.getcode()
        body = resp.read()
        return status, body


async def _fetch_json(url: str, timeout: float = 3.0):
    try:
        status, body = await asyncio.to_thread(_fetch_sync, url, timeout)
        if status != 200:
            raise HTTPException(status_code=status, detail=f"Upstream returned {status}")
        return json.loads(body.decode("utf-8"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream fetch failed: {e}")


@app.get("/api/books/splits")
async def proxy_hf_splits(
    dataset: str = Query(..., description="HF dataset repo id, e.g. manu/project_gutenberg"),
    cache_ttl: int = Query(300, description="Cache TTL seconds (default 300)"),
):
    """Proxy the HF datasets splits endpoint with caching and timeout.

    Example: /api/books/splits?dataset=manu/project_gutenberg
    """
    dataset_q = urllib.parse.quote(dataset, safe="")
    url = f"{HF_DATASETS_BASE}/splits?dataset={dataset_q}"

    cached = _cache_get("splits", url)
    if cached is not None:
        return cached

    data = await _fetch_json(url, timeout=3.0)
    _cache_set("splits", url, data, ttl=max(1, cache_ttl))
    return data


@app.get("/api/books/rows")
async def proxy_hf_rows(
    dataset: str = Query(...),
    config: str = Query("default"),
    split: str = Query("en"),
    offset: int = Query(0, ge=0, le=1000000),
    length: int = Query(1, ge=1, le=50),
    cache_ttl: int = Query(60, description="Cache TTL seconds for identical queries (default 60)"),
):
    """Proxy the HF datasets rows endpoint with short timeout and small cache.

    Example:
    /api/books/rows?dataset=manu/project_gutenberg&config=default&split=en&offset=0&length=2
    """
    params = {
        "dataset": dataset,
        "config": config,
        "split": split,
        "offset": str(offset),
        "length": str(length),
    }
    qs = urllib.parse.urlencode(params)
    url = f"{HF_DATASETS_BASE}/rows?{qs}"

    cached = _cache_get("rows", url)
    if cached is not None:
        return cached

    # Allow longer timeout for HF API which can be slow under load
    # 15s should handle most cases without client-side abort racing
    data = await _fetch_json(url, timeout=15.0)
    # Cache briefly to smooth bursts; rows vary by offset so cache is typically small
    _cache_set("rows", url, data, ttl=max(1, cache_ttl))
    return data
