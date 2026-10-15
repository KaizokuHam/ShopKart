import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getCurrentCustomer } from "../services/api.js";



const AuthContext = createContext()


export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState("")
    const updateUser = useCallback(value => { setUser(value); setAuthError(""); }, []);

    useEffect(() => {
        const controller = new AbortController();
        const fetchUser = async () => {
            try {
                const customer = await getCurrentCustomer(controller.signal)
                if (!controller.signal.aborted) setUser(customer)
            } catch (error) {
                if (!controller.signal.aborted) {
                    setUser(null)
                    if (error.response?.status !== 401) setAuthError("We could not reach your account. Check your connection and try again.")
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        fetchUser()
        return () => controller.abort();
    }, [])

    useEffect(() => {
        const expire = () => { setUser(null); setAuthError(""); };
        window.addEventListener("authExpired", expire);
        return () => window.removeEventListener("authExpired", expire);
    }, []);


    return (
        <AuthContext.Provider value={{ user, setUser: updateUser, loading, authError }}>
            {children}
        </AuthContext.Provider>
    )




}

export const useAuth = () => useContext(AuthContext)
