@echo off
cd /d "%~dp0"
echo Unpacking the Tode Boss Rush repo...
powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath tode-boss-rush-repo.zip -DestinationPath ."
cd tode-boss-rush
git --version || (echo Git is not installed. Get it from https://git-scm.com and run this again. & pause & exit /b 1)
git remote remove origin 2>nul
git remote add origin https://github.com/unityguy45/tode-boss-rush.git
git push -u origin main
echo.
echo Finished. You can close this window.
pause
