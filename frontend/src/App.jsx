import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import LandingPage from './pages/LandingPage'
import ProtectedCanvas from './protected/ProtectedCanvas'
import ProtectedHome from './protected/ProtectedHome'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/home" element={<ProtectedHome />} />
      <Route path="/canvas" element={<ProtectedCanvas />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return (
    <BrowserRouter>
      <AuthProvider>
        {clientId ? (
          <GoogleOAuthProvider clientId={clientId}>
            <AppRoutes />
          </GoogleOAuthProvider>
        ) : (
          <AppRoutes />
        )}
      </AuthProvider>
    </BrowserRouter>
  )
}
