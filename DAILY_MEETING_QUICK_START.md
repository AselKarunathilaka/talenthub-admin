# 🎯 Daily & Meeting Face Attendance - Quick Start

## What Changed?

### Before
- Users marked attendance with face (single type)
- No option for daily vs meeting
- Only type: "face"

### After  
- Users select **Daily** or **Meeting** before marking
- Daily: type "face" (daily only)
- Meeting: types "face" + "face_meeting" (daily + meeting)
- Per-day restriction: Only ONE marking allowed

---

## How to Use

### Option 1: Daily Attendance
```
User Flow:
1. Navigate → "Face Attendance"
2. Click → "Mark Attendance"
3. Select → "📅 Daily"
4. Camera → Capture face
5. Result → Attendance marked (daily only)
```

**What it creates:**
```
Intern.attendance += {
  type: "face",      ← Daily attendance
  status: "Present"
}
```

### Option 2: Meeting Attendance
```
User Flow:
1. Navigate → "Face Attendance"
2. Click → "Mark Attendance"
3. Select → "👥 Meeting"
4. Camera → Capture face
5. Result → Attendance marked (daily + meeting)
```

**What it creates:**
```
Intern.attendance += {
  type: "face",           ← Daily attendance
  status: "Present"
}

Intern.attendance += {
  type: "face_meeting",   ← Meeting attendance (NEW)
  status: "Present"
}
```

### If Already Marked
```
User tries to mark again same day:
1. Selects Daily or Meeting
2. Captures face
3. System checks: Any attendance today? YES
4. Shows: ⚠️ "Already marked today attendance"
5. Prevents duplicate marking
```

---

## Technical Summary

| Component | Change | Details |
|-----------|--------|---------|
| **Frontend UI** | Added type selector | Daily vs Meeting choice before camera |
| **API Request** | Added `attendanceType` param | Sent with face descriptor |
| **Database** | New "face_meeting" type | Intern.attendance enum updated |
| **Duplicate Check** | Enhanced logic | Checks any type, not just daily |
| **Meeting Reports** | Added "face_meeting" support | Now counts in weekly compliance |
| **QR Backup** | Enhanced protection | Blocks QR if face OR meeting marked |

---

## Expected Behavior

### Daily Mode Flow
```
Daily selected → Capture face → Check duplicates → If clear:
├─ Add: {type: "face", status: "Present"}
├─ Save to database
└─ Show: "✓ Attendance marked"
```

### Meeting Mode Flow
```
Meeting selected → Capture face → Check duplicates → If clear:
├─ Add: {type: "face", status: "Present"}
├─ Add: {type: "face_meeting", status: "Present"}
├─ Save to database
└─ Show: "✓ Attendance marked"
```

### Duplicate Prevention Flow
```
Any attendance exists today → Try to mark again:
├─ Check: Is any attendance (daily/meeting) marked today?
├─ If YES:
│  ├─ Return error (400)
│  ├─ Show: "Already marked today attendance"
│  └─ Prevent marking
└─ If NO:
   ├─ Create attendance entry
   └─ Show success message
```

---

## Database Examples

### User Marks Daily Attendance
```json
{
  "_id": "user123",
  "Trainee_Name": "John Doe",
  "attendance": [
    {
      "date": "2025-05-12T08:15:00Z",
      "status": "Present",
      "type": "face",
      "timeMarked": "2025-05-12T08:15:00Z"
    }
  ]
}
```

### User Marks Meeting Attendance
```json
{
  "_id": "user456",
  "Trainee_Name": "Jane Smith",
  "attendance": [
    {
      "date": "2025-05-12T08:15:00Z",
      "status": "Present",
      "type": "face",
      "timeMarked": "2025-05-12T08:15:00Z"
    },
    {
      "date": "2025-05-12T08:15:00Z",
      "status": "Present",
      "type": "face_meeting",
      "timeMarked": "2025-05-12T08:15:00Z"
    }
  ]
}
```

---

## Files Modified

1. ✅ `/frontend/src/pages/FaceAttendance.jsx` - Added type selector UI
2. ✅ `/backend/models/Intern.js` - Added "face_meeting" enum
3. ✅ `/backend/services/faceAttendanceService.js` - Updated logic
4. ✅ `/backend/controllers/faceAttendanceController.js` - Updated handler
5. ✅ `/backend/services/weeklymeetingattendanceservice.js` - Support face_meeting
6. ✅ `/backend/services/qrCodeService.js` - Check both face types

---

## Testing Steps

### Test 1: Daily Attendance
```bash
1. Open http://localhost:3000
2. Navigate to Face Attendance
3. Click "Mark Attendance"
4. Select "Daily"
5. Capture face
6. Check: Toast shows success
7. Check DB: One entry with type="face"
8. Try again: Shows "Already marked today attendance"
```

### Test 2: Meeting Attendance
```bash
1. Open http://localhost:3000
2. Navigate to Face Attendance
3. Click "Mark Attendance"
4. Select "Meeting"
5. Capture face
6. Check: Toast shows success
7. Check DB: Two entries (type="face" + type="face_meeting")
8. Try again: Shows "Already marked today attendance"
```

### Test 3: Weekly Reports
```bash
1. Mark meeting attendance with face
2. Check weekly compliance report
3. Verify: User shows as attended (via face_meeting)
4. Mark daily attendance with face (different day)
5. Verify: User NOT in meeting report (only in daily)
```

---

## API Endpoint

### POST `/api/face/scan`

**Request:**
```json
{
  "descriptor": [0.12, -0.34, ..., 0.78],
  "attendanceType": "daily" | "meeting",
  "metadata": {
    "location": {lat, lng},
    "source": "browser-camera"
  }
}
```

**Response (Success):**
```json
{
  "message": "Face attendance marked successfully.",
  "matched": true,
  "alreadyMarked": false,
  "confidence": 88,
  "distance": 0.35,
  "intern": {...},
  "attendanceDate": "2025-05-12"
}
```

**Response (Duplicate):**
```json
{
  "message": "Already marked today attendance",
  "matched": true,
  "alreadyMarked": true,
  "confidence": 88,
  "distance": 0.35
}
```

---

## Error Messages

| Scenario | Message | Status |
|----------|---------|--------|
| Already marked | "Already marked today attendance" | 400 |
| Face not matched | "No matching face profile found" | 404 |
| No face detected | "No face detected. Please try again." | (Frontend) |
| Location invalid | "You must be within 2km of SLT office" | (Frontend) |

---

## What Happens in Reports

### Weekly Meeting Attendance Report
```
Meeting Attendance Types That COUNT:
✅ "qr" - QR code scan for meeting
✅ "meeting" - QR meeting entry
✅ "face_meeting" - Face recognition meeting entry (NEW)

Types That DON'T Count:
❌ "face" - Daily face attendance
❌ "daily" - Daily QR attendance
❌ "daily_qr" - Daily QR attendance
```

### Example Report
```
User A: Marked on May 12
├─ Daily attendance: face (face-recognition)
├─ Meeting attendance: NOT COUNTED
└─ Report status: "No meeting attended"

User B: Marked on May 12  
├─ Daily attendance: face (face-recognition)
├─ Meeting attendance: face_meeting (face-recognition)
└─ Report status: "Attended meeting"
```

---

## Compatibility

### With QR System
- ✅ QR Daily still works
- ✅ QR Meeting still works
- ✅ If face marked, QR blocked (both types)
- ✅ Per-day rule: One of (face/qr/meeting) per day

### With Existing Data
- ✅ Old "face" entries still work
- ✅ No migration needed
- ✅ New entries use updated schema
- ✅ Database backward compatible

---

## Quick Troubleshooting

### Issue: Type selector not showing
- Solution: Ensure mode is "recognize" before clicking "Mark Attendance"

### Issue: Can't select attendance type
- Solution: Click "Mark Attendance" button first (not "Enroll Face")

### Issue: "Already marked today" when first attempt
- Solution: Check database for existing attendance
- Check if face was marked yesterday (time zone issue?)

### Issue: Meeting not counted in report
- Solution: Verify type is "face_meeting" (not just "face")
- Check date is within two-week range

---

## Summary

✅ Users now select **Daily** or **Meeting** before marking attendance  
✅ Daily mode: Single attendance type "face"  
✅ Meeting mode: Two attendance types "face" + "face_meeting"  
✅ Per-day restriction prevents duplicates  
✅ Meeting reports properly count face_meeting entries  
✅ QR backup protected from both types  
✅ All systems synchronized and tested  

**Ready to deploy!** 🚀

---

**Version**: 2.0 (Daily + Meeting Support)  
**Date**: May 12, 2026  
**Status**: ✅ Complete
