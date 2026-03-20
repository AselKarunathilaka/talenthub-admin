# AI-Powered Logbook Validation and Real-time Feedback System

## Description

This PR introduces a robust, multi-tier validation system for intern logbook entries. It combines fast local heuristics with state-of-the-art AI validation (Gemini 3.1 Flash Lite) to ensure that all submitted logs are professional, specific, and genuinely work-related.

The system provides real-time feedback to interns as they type, helping them improve their documentation quality before submission. It also enforces strict quality standards by blocking the submission of low-quality or irrelevant entries.

## Key Features

### 1. Tiered Quality Assessment (Levels 1–3)
- **Level 1 (RED - Poor Quality)**: Fails basic heuristic rules (keyboard smashing, too short, repetitive patterns, or placeholder content like "lorem ipsum").
- **Level 2 (YELLOW - Needs Improvement)**: Passes basic rules but is flagged by Gemini AI as non-work-related or lacking technical specificity.
- **Level 3 (GREEN - Good Entry)**: High-quality, professional, and descriptive work logs.

### 2. Real-time Feedback UI
- **EntryFeedbackIndicator Component**: A "signal-strength" style visual indicator displayed below textarea fields.
- **Actionable Advice**: Provides specific feedback based on Formative Feedback Theory (Hattie & Timperley) to guide interns on *how* to improve their entries.
- **Dual-Stage Debouncing**:
  - **Local Check (500ms)**: Instant feedback for RED entries without hitting the API.
  - **AI Check (2.5s)**: Deep analysis of content relevance with Gemini 3.1 Flash Lite.

### 3. Strict Submission Enforcement
- Submission is **blocked** for any field that is rated as Level 1 (Red) or Level 2 (Yellow).
- Interns are required to reach Level 3 (Green) for all mandatory fields to successfully submit their daily log.

### 4. Backend Validation Infrastructure
- **Gemini 3.1 Flash Lite Integration**: A dedicated utility to evaluate the professional context of entries.
- **Standalone Validation Endpoint**: `POST /api/records/validate-entry` allows the frontend to request quality assessments independently of the record creation flow.
- **Fail-Open Reliability**: If the Gemini API is unreachable, the system gracefully falls back to local word-ratio heuristics to avoid blocking users unnecessarily.

## Technical Changes

### Backend
- **[NEW]** [backend/utils/llmValidator.js](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/backend/utils/llmValidator.js): Core AI validation logic using `@google/generative-ai`.
- **[MODIFIED]** [backend/utils/heuristics.js](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/backend/utils/heuristics.js): Comprehensive rule-based filters for keyboard smash and placeholder detection.
- **[MODIFIED]** [backend/controllers/dailyRecordController.js](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/backend/controllers/dailyRecordController.js): Added [validateLogbookEntry](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/backend/controllers/dailyRecordController.js#265-293) controller method.
- **[MODIFIED]** [backend/routes/dailyRecordRoutes.js](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/backend/routes/dailyRecordRoutes.js): Exported the validation endpoint.

### Frontend
- **[NEW]** [frontend/src/components/EntryFeedbackIndicator.jsx](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/frontend/src/components/EntryFeedbackIndicator.jsx): Real-time feedback UI component.
- **[NEW]** [frontend/src/utils/entryHeuristics.js](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/frontend/src/utils/entryHeuristics.js): Client-side assessment logic and API integration.
- **[MODIFIED]** [frontend/src/pages/LogBook.jsx](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/frontend/src/pages/LogBook.jsx): Integrated the indicator and added strict blocking logic to [handleSubmit](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/frontend/src/pages/LogBook.jsx#69-178).
- **[MODIFIED]** [frontend/src/api/apiConfig.js](file:///c:/Users/User/OneDrive/Documents/S%20L%20T/TalentHub/frontend/src/api/apiConfig.js): Added the `RECORDS.VALIDATE` endpoint definition.

## Verification Plan

### Automated Verification
- **Manual API Test**: Verify the validation endpoint with diverse inputs:
  - Gibberish: `asdfasdfasdfasdfasdf` -> Expected: Level 1 (Red)
  - Personal: `I ate a sandwich today` -> Expected: Level 2 (Yellow)
  - Professional: `Refactored the auth middleware to use JWT` -> Expected: Level 3 (Green)

### Manual Verification
1.  Open the **Daily Logbook** page.
2.  Type "test" in the Tasks field.
    *   **Verify**: Red indicator appears saying the entry is too short.
    *   **Verify**: Submit button shows an error message.
3.  Type "I watched a movie and slept".
    *   **Verify**: After 2.5s, the indicator turns Yellow, stating the entry is non-work-related.
    *   **Verify**: Submit button remains blocked.
4.  Type a detailed technical entry.
    *   **Verify**: Indicator turns Green.
    *   **Verify**: Logbook submits successfully.

---
> [!NOTE]
> Ensure that `GEMINI_API_KEY` is set in the backend `.env` file for the AI features to function correctly.
