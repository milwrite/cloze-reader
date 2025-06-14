#!/usr/bin/env python3
"""
Local development server for cloze-reader
Serves static files with CORS enabled for local testing
"""

import http.server
import socketserver
import os
from urllib.parse import urlparse
import json

class LocalHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_GET(self):
        # Handle root path
        if self.path == '/':
            self.path = '/index.html'
        
        # Handle icon.png (serve local file if exists, otherwise redirect)
        if self.path == '/icon.png':
            if os.path.exists('icon.png'):
                return super().do_GET()
            else:
                self.send_response(302)
                self.send_header('Location', 'https://raw.githubusercontent.com/zmuhls/cloze-reader/main/icon.png')
                self.end_headers()
                return
        
        # Serve static files
        return super().do_GET()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def run_server(port=8000):
    handler = LocalHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"Local development server running at http://localhost:{port}/")
            print("Press Ctrl+C to stop")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"Port {port} is already in use. Try a different port.")
        else:
            print(f"Error starting server: {e}")

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)