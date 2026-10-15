import { useAuth } from '../context/AuthContext'
import { Navigate, useLocation } from "react-router-dom"
import { returnPath } from "../utils/navigation.js"


function PublicRoute({children}) {
   
   const { user, loading } = useAuth()
   const location = useLocation()
   if (loading) return <div role="status" className="min-h-screen grid place-items-center">Loading your account…</div>

   //    navigate to home
   if(user){
   return <Navigate to={returnPath(location.state?.from)} replace state={{ message: "Welcome back!" }} />
   }

  return children

}

export default PublicRoute
