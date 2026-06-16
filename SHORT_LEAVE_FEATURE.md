# Short Leave Request Automated Email Feature

## Overview

This feature automates the short leave request process by enforcing time windows for submissions and automatically sending consolidated reports to the Digital Platforms Development team.

## How It Works

### 1. Request Submission Window (8 AM - 1 PM)

- **Time Window**: Interns can ONLY submit short leave requests between 8:00 AM and 1:00 PM (Sri Lanka Time)
- **Validation**: System automatically validates submission time
- **Error Handling**: Requests outside this window are rejected with clear error message
- **Leave Date**: Requests are for the SAME DAY

### 2. Automated 1 PM Email Report

- **Schedule**: Every day at 1:00 PM (Sri Lanka time)
- **Logic**:
  - Collects ALL short leave requests submitted between 8 AM - 1 PM
  - Generates Excel file with all request details
  - Sends email to digital platforms development team group
- **Recipient**: digitalplatformsdev@slt.com.lk (email group)
- **Sender**: internship-management-systems@slt.com.lk (new domain email)
- **Attachment**: Excel file containing all short leave requests

### 3. Admin Approval Process

- **Timing**: Admin reviews and approves requests after 1:30 PM
- **Previous Flow**: Approved leaves are sent at 4:00 PM (existing functionality)

## Email Configuration

### New Domain Email Setup

The system now uses a dedicated domain email for short leave notifications:

- **Email**: `internship-management-systems@slt.com.lk`
- **Purpose**: Sender for 1 PM short leave requests report
- **Recipient Group**: `digitalplatformsdev@slt.com.lk`

### Environment Variables Required

Add these to your `.env` file:

```env
# Short Leave Email Configuration (New Domain Email)
SHORT_LEAVE_EMAIL=internship-management-systems@slt.com.lk
SHORT_LEAVE_EMAIL_PASS=your_email_password
SHORT_LEAVE_SMTP_HOST=smtp.gmail.com
SHORT_LEAVE_SMTP_PORT=587

# Short Leave Recipient Group
SHORT_LEAVE_RECIPIENT=digitalplatformsdev@slt.com.lk
```

## Files Created/Modified

### New Files:

1. **`backend/services/shortLeaveEmailService.js`**
   - Service handling short leave email generation and sending
   - Methods:
     - `generateShortLeaveRequestsExcel(requests)` - Creates Excel report
     - `sendShortLeaveRequestsEmail(requests, recipient)` - Sends email with attachment
     - `sendDailyShortLeaveReport()` - Main method called by scheduler

### Modified Files:

1. **`backend/services/leaveRequestService.js`**
   - Added time validation (8 AM - 1 PM) in `createLeaveRequest()` method
   - Validates current time against allowed submission window
   - Returns clear error message for out-of-window requests

2. **`backend/services/shortLeaveSchedulerService.js`**
   - Added new cron job for 1 PM short leave report
   - Schedule: `"0 13 * * *"` (1:00 PM daily, Asia/Colombo timezone)
   - Maintains existing 4 PM approved leaves report

3. **`backend/.env.example`**
   - Documented new environment variables for short leave email configuration

## Workflow Timeline

```
8:00 AM  ─────────────── 1:00 PM ─── 1:30 PM ─────────────── 4:00 PM
   │                         │            │                      │
   └─ Submission Window ────┘            │                      │
         (Interns can                    │                      │
          submit requests)                │                      │
                                          │                      │
                              Email sent to                Approved leaves
                              Digital Platforms            email sent to
                              Dev team with all            gate staff
                              submitted requests
                                          │
                                          └─ Admin reviews
                                             and approves
                                             requests
```

## Excel Report Contents

The 1 PM Excel report includes:

- **No.**: Sequential number
- **Intern Name**: Full name
- **Trainee ID**: SLT trainee identifier
- **National ID**: NIC number
- **Leave Date**: Date of leave (same day)
- **Leave Time**: Time slot requested
- **Purpose**: Personal or Official
- **Reason**: Detailed reason for leave
- **Submitted At**: Timestamp of submission
- **Status**: Current status (Pending, Approved, or Denied)

## Email Template

The email sent at 1 PM includes:

- Header identifying it as Short Leave Requests Report
- Summary statistics (date, time window, total requests)
- Excel attachment with all requests
- Preview table showing first 10 requests
- Next steps for admin to approve after 1:30 PM
- Automated footer with timestamp and recipient info

## Testing

### Test Short Leave Submission

1. Submit a leave request between 8 AM - 1 PM:

```bash
# Will succeed
curl -X POST http://localhost:5000/api/interns/leave-requests \
  -H "Authorization: Bearer <intern-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveDate": "2026-02-24",
    "leaveTime": "10:00 AM - 12:00 PM",
    "purpose": "Personal",
    "reason": "Medical appointment",
    "nationalId": "123456789V"
  }'
```

2. Try submitting outside 8 AM - 1 PM window:

```bash
# Will be rejected with error message
```

### Test 1 PM Email Report

Manually trigger the report (for testing):

```bash
cd backend
node -e "require('./services/shortLeaveEmailService').sendDailyShortLeaveReport()"
```

## Important Notes

1. **Time Validation**: All time checks use Sri Lanka timezone (UTC+5:30)
2. **Same Day Requests**: Short leave requests are for the same day they are submitted
3. **Email Groups**: Ensure `digitalplatformsdev@slt.com.lk` is properly configured as a group email
4. **Domain Email**: Configure `internship-management-systems@slt.com.lk` with proper SMTP credentials
5. **Scheduler**: Both 1 PM and 4 PM jobs run automatically once server starts

## Troubleshooting

### Email Not Sending

- Check `SHORT_LEAVE_EMAIL` and `SHORT_LEAVE_EMAIL_PASS` in `.env`
- Verify SMTP host and port settings
- Check if sender email has SMTP/app password enabled
- Ensure recipient email group exists and accepts external emails

### Time Validation Issues

- Verify server timezone matches Sri Lanka (Asia/Colombo)
- Check moment.js is properly installed
- Review server logs for time validation errors

### No Requests in Report

- Verify requests were submitted between 8 AM - 1 PM
- Check if requests are for the current day
- Review database query date ranges in logs

## Future Enhancements

- Add configurable time windows via admin panel
- Support multiple recipient groups
- Add manual resend functionality for failed emails
- Include request analytics in Excel report
