import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useWishlistIds } from "../hooks/useWishlistIds.js";
import Icon from "./Icon.jsx";

const Navbar = () => {
  const { user } = useAuth();
  const { totalCount } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const wishlistCount = useWishlistIds().length;


  const handleLogout = () => navigate("/logout");
  const handleProfile = () => navigate("/profile");
  const links = [...(user ? [{ to: "/home", label: "Home" }] : []), { to: "/products", label: "Products" }, ...(user ? [{ to: "/orders", label: "My Orders" }] : [{ to: "/#our-story", label: "Our philosophy" }])];
  return <>
    <header className="site-header">
      <Link className="brand" to={user ? "/home" : "/"} aria-label="ShopKart home">shopkart<span className="brand-dot">.</span></Link>
      <nav className="main-nav" aria-label="Main navigation">{links.map(link => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}</nav>
      <div className="header-actions">
        <Link className="header-icon" to="/products" aria-label="Search the collection"><Icon name="search" size={19} /></Link>
        <Link className="header-icon" to="/wishlist" aria-label={"Wishlist, " + wishlistCount + " items"}><Icon name="heart" size={19} /><span className="header-label">Wishlist ({wishlistCount})</span></Link>
        <Link className="header-icon" to="/cart" aria-label={"Shopping bag, " + totalCount + " items"}><Icon name="bag" size={19} /><span className="header-label">Cart</span><span className="cart-count">{user ? totalCount : 0}</span></Link>
        {user ? <div className="account-actions"><button className="header-icon" type="button" onClick={handleProfile} aria-label="Your account"><Icon name="user" size={18} /><span className="account-name">{user.fullName}</span></button><button type="button" className="logout-button" onClick={handleLogout}>Log out</button></div> : <Link className="header-login" to="/login">Sign in</Link>}
        <button type="button" className="header-icon menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen(open => !open)}><Icon name={menuOpen ? "close" : "menu"} size={20} /></button>
      </div>
    </header>
    {menuOpen && <nav id="mobile-navigation" className="mobile-nav route-enter" aria-label="Mobile navigation" data-lenis-prevent onKeyDown={event => { if (event.key === "Escape") setMenuOpen(false); }}>
      {links.map(link => <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
      <Link to="/wishlist" onClick={() => setMenuOpen(false)}>Wishlist ({user ? wishlistCount : 0})</Link><Link to="/cart" onClick={() => setMenuOpen(false)}>Cart ({user ? totalCount : 0})</Link>
      {user ? <><Link to="/profile" onClick={() => setMenuOpen(false)}>Your account</Link><button type="button" onClick={() => { setMenuOpen(false); handleLogout(); }}>Log out</button></> : <Link to="/register" onClick={() => setMenuOpen(false)}>Create an account</Link>}
    </nav>}
  </>;
};

export default Navbar;
