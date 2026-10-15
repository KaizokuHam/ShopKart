import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

export default function NotFound() {
  return <div className="commerce-page route-enter min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 px-5 py-24 text-center">
      <p className="eyebrow">404 · A little off course</p>
      <h1 className="mt-4 font-[var(--display)] text-5xl text-[var(--ink)]">This page wandered away.</h1>
      <p className="mx-auto mt-4 mb-8 max-w-md">The link may have changed. There is still plenty to discover in the collection.</p>
      <Link className="primary-button" to="/products">Explore the collection →</Link>
    </main>
    <SiteFooter />
  </div>;
}
