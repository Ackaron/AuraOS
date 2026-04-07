@echo off
echo.
echo  [36m🚀 AuraOS: Synchronizing changes to GitHub... [0m
echo.

git add .
if %ERRORLEVEL% NEQ 0 (
    echo  [31m❌ Error adding files. [0m
    pause
    exit /b %ERRORLEVEL%
)

git commit -m "AuraOS Total UI/UX & Backend Sync Refactoring (Analytic Noir)"
if %ERRORLEVEL% NEQ 0 (
    echo  [33m⚠️  No changes to commit or commit failed. [0m
)

echo  [36m📤 Pushing to remote... [0m
git push
if %ERRORLEVEL% NEQ 0 (
    echo  [31m❌ Push failed. Please check your internet connection and git credentials. [0m
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo  [32m✅ Sync complete! AuraOS is up to date on GitHub. [0m
echo.
pause
