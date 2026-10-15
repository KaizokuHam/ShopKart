import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { logoutCustomer } from "../services/api.js";

// Clear the session outside a protected route so its redirect cannot preserve
// the page being left as the destination of the customer's next login.
export default function Logout() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const request = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    request.current ??= logoutCustomer().catch(failure => {
      if (failure.response?.status !== 401) throw failure;
    });
    request.current.then(() => {
      if (!active) return;
      setUser(null);
      navigate("/login", { replace: true, state: null });
    }).catch(() => {
      if (active) setError("Unable to log out. Please try again.");
    });
    return () => { active = false; };
  }, [attempt, navigate, setUser]);

  return <main className="min-h-screen grid place-items-center p-6 text-center">
    {error ? <div role="alert"><p>{error}</p><button className="primary-button" onClick={() => {
      request.current = null;
      setError("");
      setAttempt(value => value + 1);
    }}>Try again</button><Link className="text-link" to="/products">Back to the collection</Link></div>
      : <p role="status">Signing you out…</p>}
  </main>;
}
