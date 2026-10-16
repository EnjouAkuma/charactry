@echo off
rem Serves the whole "my website" folder so you can test pages the way the real host serves them.
rem Double-click this, then open the pages in your browser. Close the window to stop.
cd /d "%~dp0..\..\.."
start "" http://localhost:8000/charactry/
start "" http://localhost:8000/charactry.html
echo Serving %cd% at http://localhost:8000  (press Ctrl+C to stop)
python -m http.server 8000
