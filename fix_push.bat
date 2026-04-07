@echo off
echo.
echo  [36m🔧 AuraOS: Fixing Git Index and Retrying Push... [0m
echo.

echo  [33m⏳ Undoing last commit (resetting to previous HEAD)... [0m
git reset --soft HEAD~1

echo  [33m⏳ Clearing Git index to apply fixed .gitignore... [0m
git rm -r --cached .

echo  [33m⏳ Re-adding files (respecting filters)... [0m
git add .

echo  [33m⏳ Creating clean commit... [0m
git commit -m "UI/UX & Backend Sync (Correctly Ignoring Large Binaries)"

echo  [36m📤 Pushing to remote... [0m
git push --force
if %ERRORLEVEL% NEQ 0 (
    echo  [31m❌ Push failed. Please check if you have write access to the branch. [0m
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo  [32m✅ SUCCESS! History cleaned and changes pushed to GitHub. [0m
echo.
pause
