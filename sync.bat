@echo off
echo ========================================================
echo Syncing TalentHub DEV to PROD...
echo ========================================================
echo.

:: Define Paths
set DEV_DIR="copy_your_local_path_to_Lakindu24-TalentHub_repo_here_inside_quotation_marks"
set PROD_DIR="copy_your_local_path_to_DevoraOrg-SourceCode_repo_here_inside_quotation_marks"

:: Run Robocopy
:: /MIR  -> Mirror directory (copy new, update changed, delete removed)
:: /XD   -> Exclude Directories (.git, node_modules, .github)
:: /XF   -> Exclude Files (.env, script itself, plus all extra ignored files)
:: Note: Putting .gitignore here automatically ignores it in the root, backend\, and frontend\
robocopy %DEV_DIR% %PROD_DIR% /MIR /XD .git node_modules .github /XF .env sync.bat .gitattributes deploy.yml .gitignore IMPLEMENTATION_COMPLETE.md PR-log-validation.md README.md SHORT_LEAVE_FEATURE.md SYSTEM_READY_TESTING.md WEEKLY_NON_SUBMISSION_FEATURE.md ENV_SETUP_AI_LOG_VALIDATION.md check_admin.js create_admin_final.js create_admin_mongoose.js recreate_admin.js seedLockedSeats.js sendWeeklyNonSubmissionToManager.js testWeeklyNonSubmissionCheck.js testWeeklyNonSubmissionCheckToTestEmail.js update_attendance.js

echo.
echo ========================================================
echo Sync Complete! 
echo Please open the PROD repo in VS Code, review changes, commit, and push.
echo ========================================================
pause
