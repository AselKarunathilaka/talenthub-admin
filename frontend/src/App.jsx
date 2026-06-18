import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from 'react-hot-toast'; 
import AppRoutes from "./routes/AppRoutes";  

const App = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID; 

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Router>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
          containerStyle={{
            zIndex: 9999999,
          }}
        />
        <AppRoutes />
      </Router>
    </GoogleOAuthProvider>
  );
};

export default App;
