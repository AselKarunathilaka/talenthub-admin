# Environment Variables Setup

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

### Required for Logbook Validation
```
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### Other Environment Variables
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/talentHub
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Getting Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key and add it to your `.env` file

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory with:

```
VITE_BACKEND_URL=http://localhost:5000
```
