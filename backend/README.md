# Backend API - Interns external source

This backend can fetch interns either from MongoDB (default) or directly from the external Trainees API.

## Environment variables

Add these to your backend .env file:

- TRAINEES_API_BASE_URL=https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees
- TRAINEES_API_SECRET_KEY=REPLACE_WITH_SECRET
- TRAINEES_API_TIMEOUT_MS=15000
- TRAINEES_API_MODE=db # db | external

If TRAINEES_API_MODE=external, GET /api/interns will proxy data from the external API instead of MongoDB.

## New endpoints

- GET /api/interns/external/active (auth required) -> returns external active trainees without persisting
- POST /api/interns/external/sync (auth required) -> upserts external trainees into local MongoDB by traineeId

## Mapping

External response:
{
"Trainee_ID": "2438",
"Trainee_Name": "J.M. Nandun Deepaka Jayamanna",
"Trainee_HomeAddress": "...",
"Training_StartDate": "2024-11-20",
"Training_EndDate": "2025-10-20",
"Trainee_Email": "...",
"Institute": "...",
"field_of_spec_name": "Python"
}

Internal model fields:

- traineeId <- Trainee_ID
- traineeName <- Trainee_Name
- homeAddress <- Trainee_HomeAddress
- trainingStartDate <- Training_StartDate
- trainingEndDate <- Training_EndDate
- email <- Trainee_Email
- institute <- Institute
- fieldOfSpecialization <- field_of_spec_name

Attendance and team are not provided by the external API and remain managed locally.
