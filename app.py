from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)