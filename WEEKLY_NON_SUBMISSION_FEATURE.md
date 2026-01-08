# Weekly Logbook Non-Submission Alert Feature

## Overview
This feature automatically checks if interns have not submitted their daily logbook entries for the past 5 working days (Monday-Friday) and sends an alert email to mgiri@slt.com.lk with a detailed list of non-submitting interns.

## How It Works

### 1. Automated Weekly Check
- **Schedule**: Every Sunday at 9:30 AM (Sri Lanka time)
- **Logic**: 
  - Identifies all active interns in the system
  - Checks if each intern has submitted at least one daily log entry in the past 5 working days
  - Excludes weekends (Saturday & Sunday) from the calculation
  - Compiles a list of interns who haven't submitted any logs

### 2. Email Notification
- **Recipient**: mgiri@slt.com.lk
- **Content**: Detailed list of non-submitting interns including:
  - Intern name and ID
  - Email address
  - Field of specialization
  - Institute
  - Team assignment
  - Training period dates

### 3. Manual Trigger
Admins can manually trigger the check via API endpoint:
```
POST /api/admin/trigger/weekly-non-submission-check
Authorization: Bearer <admin-token>
```

## Files Modified/Created

### New Files:
1. **`backend/services/weeklyNonSubmissionService.js`**
   - Main service handling the non-submission check logic
   - Methods:
     - `hasSubmittedLogsForPastWeek(internId)` - Checks if intern submitted logs
     - `getActiveInterns()` - Retrieves all active interns
     - `sendNonSubmissionEmail(nonSubmittedInterns)` - Sends alert email
     - `performWeeklyNonSubmissionCheck(triggerType)` - Main execution method

2. **`backend/scripts/testWeeklyNonSubmissionCheck.js`**
   - Test script to manually verify the feature
   - Run with: `node backend/scripts/testWeeklyNonSubmissionCheck.js`

### Modified Files:
1. **`backend/services/weeklyScheduler.js`**
   - Added new cron job for non-submission check (Sundays at 9:30 AM)
   - Added `triggerManualNonSubmissionCheck()` method

2. **`backend/controllers/adminController.js`**
   - Added `triggerWeeklyNonSubmissionCheck` controller function
   - Imported `WeeklyScheduler` service

3. **`backend/routes/adminRoutes.js`**
   - Added POST route: `/trigger/weekly-non-submission-check`

## Testing

### Method 1: Run Test Script
```bash
cd backend
node scripts/testWeeklyNonSubmissionCheck.js
```

### Method 2: Manual API Trigger
1. Ensure you have admin authentication token
2. Make POST request to:
   ```
   POST http://localhost:5000/api/admin/trigger/weekly-non-submission-check
   Headers:
     Authorization: Bearer <your-admin-token>
   ```

### Method 3: Wait for Scheduled Run
The check will automatically run every Sunday at 9:30 AM (Asia/Colombo timezone).

## Email Template
The email sent to mgiri@slt.com.lk contains:
- Header with week period and total count
- Detailed list of each non-submitting intern with:
  - Name and ID
  - Contact email
  - Academic details (field, institute)
  - Team assignment
  - Training dates
- Summary and recommended actions
- Timestamp and system information

## Configuration

### Email Settings
Ensure these environment variables are set in `.env`:
```
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
```

### Schedule Customization
To modify the schedule, edit [backend/services/weeklyScheduler.js](backend/services/weeklyScheduler.js):
```javascript
// Current: Every Sunday at 9:30 AM
const nonSubmissionCronExpression = '30 9 * * 0';

// Examples:
// Every Friday at 5 PM: '0 17 * * 5'
// Every day at 10 AM: '0 10 * * *'
```

### Working Days Logic
The feature checks the past 5 **working days** (Monday-Friday). Weekends are automatically excluded. The logic is in `hasSubmittedLogsForPastWeek()` method.

## Difference from Existing Weekly Compliance Check

There are now TWO weekly checks:

### 1. Weekly Compliance Check (Existing)
- **Time**: Sunday 9:00 AM
- **Purpose**: Checks if interns submitted work logs for the **previous week** (Monday-Friday)
- **Recipients**: mgiri@slt.com.lk, jana@slt.com.lk
- **Grace Period**: Considers 4-week grace period for new interns

### 2. Weekly Non-Submission Alert (NEW)
- **Time**: Sunday 9:30 AM
- **Purpose**: Checks if interns submitted **any log in the past 5 working days**
- **Recipient**: mgiri@slt.com.lk only
- **Grace Period**: No grace period - all active interns are checked

## Troubleshooting

### Email Not Sending
1. Verify `.env` has correct `GMAIL_USER` and `GMAIL_PASS`
2. Ensure Gmail account has "App Passwords" enabled
3. Check server logs for error messages

### Wrong Interns Listed
1. Verify intern's `Training_StartDate` and `Training_EndDate` in database
2. Check if DailyRecord entries exist with correct `internId` and `date` format
3. Ensure date format is 'YYYY-MM-DD' in DailyRecord

### Scheduler Not Running
1. Verify `WeeklyScheduler.init()` is called in app.js/server.js
2. Check server timezone is set correctly
3. Review cron expression syntax

## Future Enhancements
- Add configurable threshold (currently fixed at 5 days)
- Support for multiple email recipients
- Dashboard view of historical non-submission reports
- SMS notifications for repeat offenders
- Integration with HR system for automatic warnings

## Support
For issues or questions, contact the system administrator or check the application logs.
