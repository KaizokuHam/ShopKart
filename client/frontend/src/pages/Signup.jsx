import Navbar from "../components/Navbar.jsx";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerCustomer } from "../services/api.js";
const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });
  
  const [loader, setLoader] = useState(false);
  const [err, setErr] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loader) return;
    setErr(null);

    setLoader(true);
    try {
      await registerCustomer(form);
        navigate("/login", {
          state: { message: "Account created. Please log in." },
        });
    } catch (error) {
      setErr(error.response?.data?.message || "Unable to create your account.");
    } finally {
      setLoader(false);
    }
  };

  return (
    <>
    <Navbar />
    <div className="auth-page route-enter grid min-h-[750px] w-full lg:grid-cols-2 bg-stone-50/50">
      {/* Left Aside Section - Expanded vertical padding & layout */}
      <div className="auth-aside signup-aside flex flex-col justify-between px-6 py-16 sm:px-16 lg:px-[10vw] lg:py-28 bg-stone-900 text-stone-50">
        <div>
          <p className="eyebrow text-xs font-semibold tracking-widest uppercase text-stone-400 mb-4">
            Join the club
          </p>

          <h1 className="text-5xl font-light tracking-tight leading-[1.05] sm:text-6xl lg:text-7xl">
            <span className="block sm:inline">More good things, </span>
            <em className="font-serif italic font-normal text-stone-300 block sm:inline whitespace-nowrap">
              coming your way.
            </em>
          </h1>
        </div>
        <p className="text-stone-400 text-base sm:text-lg max-w-md mt-12 lg:mt-0 leading-relaxed">
          Save favourites, track orders, and get first look at the pieces we are
          excited about.
        </p>
      </div>

      <div className="auth-panel mx-auto w-full max-w-lg self-center px-6 py-16 sm:px-16">
        <div className="mb-8">
          <p className="eyebrow text-xs font-semibold tracking-widest uppercase text-stone-500 mb-1.5">
            Create account
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            Make yourself at home
          </h2>
          <p className="auth-muted text-sm sm:text-base text-stone-500 mt-1.5">
            It only takes a minute.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-xs font-bold tracking-wide uppercase text-[var(--ink)]">
            Full name
            <input
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-white px-4 py-3.5 text-sm font-normal text-stone-800 outline-none transition-all duration-200 focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/20 shadow-sm placeholder:text-stone-400"
              type="text"
              placeholder="Your name"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block text-xs font-bold tracking-wide uppercase text-[var(--ink)]">
            Email address
            <input
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-white px-4 py-3.5 text-sm font-normal text-stone-800 outline-none transition-all duration-200 focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/20 shadow-sm placeholder:text-stone-400"
              type="email"
              placeholder="you@example.com"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block text-xs font-bold tracking-wide uppercase text-[var(--ink)]">
            Phone number
            <input
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-white px-4 py-3.5 text-sm font-normal text-stone-800 outline-none transition-all duration-200 focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/20 shadow-sm placeholder:text-stone-400"
              type="tel"
              placeholder="Your phone number"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block text-xs font-bold tracking-wide uppercase text-[var(--ink)]">
            Password
            <input
              className="mt-2 w-full rounded-md border border-[var(--line)] bg-white px-4 py-3.5 text-sm font-normal text-stone-800 outline-none transition-all duration-200 focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/20 shadow-sm placeholder:text-stone-400"
              type="password"
              placeholder="At least 6 characters"
              name="password"
              value={form.password}
              onChange={handleChange}
              minLength={6}
              required
            />
          </label>


          {err && (
            <p className="text-sm text-red-600" role="alert">
              {err}
            </p>
          )}

          <button
            className="primary-button group mt-6 flex w-full items-center justify-center gap-3 rounded-md py-4 text-sm font-medium transition-all duration-200 hover:opacity-95 active:scale-[0.99]"
            type="submit"
            disabled={loader}
          >
            {loader ? "Creating account..." : "Create account"}
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </button>
        </form>

        <p className="auth-switch text-center text-sm text-stone-500 mt-8">
          Already a member?{" "}
          <Link
            to="/login"
            className="font-semibold text-[var(--ink)] hover:underline underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
    </>
  );
};

export default Signup;
