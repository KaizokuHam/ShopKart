
import { useAuth } from '../context/AuthContext'

import { Navigate, useLocation } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const { user, loading, authError } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div role="status" className="min-h-screen grid place-items-center">Loading your account…</div>
  }
  if (authError && !user) return <main className="min-h-screen grid place-items-center p-6 text-center"><div role="alert"><h1 className="text-3xl">Your account is temporarily unavailable.</h1><p>{authError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></div></main>

  //    navigate to home
  if (!user) {
    return <Navigate to='/login' replace state={{ from: location.pathname + location.search }} />
  }

  // if not we stay on children - login signup or lanidng

  return children

}

export default ProtectedRoute
