from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# Mount static files
app.mount("/src", StaticFiles(directory="src"), name="src")

@app.get("/")
async def read_root():
    # Read the HTML file and inject environment variables
    with open("index.html", "r") as f:
        html_content = f.read()
    
    # Inject environment variables as a script
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    hf_key = os.getenv("HF_API_KEY", "")
    
    env_script = f"""
    <script>
        window.OPENROUTER_API_KEY = "{openrouter_key}";
        window.HF_API_KEY = "{hf_key}";
    </script>
    """
    
    # Insert the script before closing head tag
    html_content = html_content.replace("</head>", env_script + "</head>")
    
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)