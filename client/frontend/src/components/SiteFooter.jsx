import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

export default function SiteFooter() {
  return <footer className="premium-footer">
    <div className="footer-top" data-reveal>
      <div><Link to="/" className="brand">shopkart<span className="brand-dot">.</span></Link><p>Good design. Everyday living.<br />A little more considered.</p></div>
      <div className="footer-links"><span className="eyebrow">Make yourself at home</span><Link to="/products">Explore the collection <Icon name="arrow" size={16} /></Link><Link to="/wishlist">Your favourites</Link><Link to="/orders">Your orders</Link></div>
      <div className="footer-note"><Icon name="leaf" size={28} /><p>Buy less, choose well.<br />Find something worth keeping.</p></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} ShopKart</span><span>Thoughtfully selected. Fairly priced.</span><a href="#top">Back to top ↑</a></div>
  </footer>;
}
