@echo off
rem NewsForge — avvia la console contenuti (solo locale) e apre il browser.
cd /d "%~dp0"
echo.
echo   Avvio della console NewsForge su http://localhost:4455
echo   (il browser si apre tra qualche secondo; Ctrl+C per fermare)
echo.
start "" /min cmd /c "timeout /t 4 >nul & explorer http://localhost:4455"
npm run console --workspace pipeline
