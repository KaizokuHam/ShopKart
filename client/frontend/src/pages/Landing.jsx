import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import Icon from "../components/Icon.jsx";

const collections = [
  { name: "At home", detail: "Objects that make a space yours", category: "Home", image: "photo-1600210492486-724fe5c67fb0" },
  { name: "Everyday wear", detail: "A little comfort. A lot of character.", category: "Fashion", image: "photo-1483985988355-763728e1935b" },
  { name: "Good connections", detail: "Clever upgrades for everyday life", category: "Electronics", image: "photo-1505740420928-5e560c06d30e" },
  { name: "Slow moments", detail: "Find your next favourite read", category: "Books", image: "photo-1507842217343-583bb7270b66" },
];

export default function Landing() {
  return <div className="landing-page">
    <div className="announcement">Good things, thoughtfully selected <span>✦</span> Welcome to your everyday edit</div>
    <Navbar />
    <section className="premium-hero">
      <div className="hero-copy" data-reveal>
        <p className="eyebrow hero-kicker">The art of everyday living</p>
        <h1 className="hero-title">Everyday,<br /><em>extraordinary.</em></h1>
        <p className="hero-description">For the spaces you love. The rituals you keep.<br />Discover considered essentials that make the everyday feel a little more special.</p>
        <div className="hero-actions"><Link className="primary-button" to="/products">Explore the collection <Icon name="arrow" size={18} /></Link><a className="text-link" href="#collections">Find your edit</a></div>
        <div className="hero-footnote"><span className="mini-mark"><Icon name="leaf" size={16} /></span><p><strong>Less noise. More good things.</strong>Useful design, with a little soul.</p></div>
      </div>
      <div className="hero-scene" data-reveal>
        <img className="hero-photo" src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1100&q=85" alt="A sunlit living room with considered furniture and natural textures" fetchPriority="high" />
        <div className="scene-label"><span>A considered collection</span><strong>Make room for good.</strong></div>
        <div className="scene-seal" aria-hidden="true"><span>ShopKart</span><b>the edit</b><span>Everyday essentials</span></div>
        <div className="scene-caption"><strong>01 / The everyday edit</strong><span>Made for your kind of living</span></div>
      </div>
    </section>
    <div className="marquee" aria-label="Thoughtful design, everyday essentials, a little more considered"><div className="marquee-track" aria-hidden="true">{[0,1].map(i => <span key={i}>THOUGHTFUL DESIGN <i>✦</i> EVERYDAY ESSENTIALS <i>✦</i> A LITTLE MORE CONSIDERED <i>✦</i> GOOD THINGS, FAIRLY PRICED <i>✦</i></span>)}</div></div>
    <section className="collection-section" id="collections">
      <div className="section-heading" data-reveal><div><span className="eyebrow">Find your everyday favourites</span><h2>A collection for <em>your life.</em></h2></div><Link className="text-link" to="/products">Discover all products ↗</Link></div>
      <div className="category-grid">{collections.map((collection, index) => <Link className="category-tile" data-reveal key={collection.name} to={"/products?category=" + collection.category}>
        <div className="category-image"><img loading="lazy" src={"https://images.unsplash.com/" + collection.image + "?auto=format&fit=crop&w=600&q=80"} alt={collection.name + " collection"} /><span className="category-number">0{index + 1}</span></div>
        <div className="category-meta"><div><h3>{collection.name}</h3><small>{collection.detail}</small></div><Icon name="arrow" size={19} /></div>
      </Link>)}</div>
    </section>
    <section className="brand-story" id="our-story">
      <img className="story-image" loading="lazy" src="https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1100&q=80" alt="A warm, quiet home filled with natural light" />
      <div className="story-copy" data-reveal><span className="eyebrow">Our philosophy</span><h2>Good things.<br /><em>Chosen with care.</em></h2><p>We believe the things you bring into your life should earn their place. Beautiful to look at. A joy to use. And always, fairly priced.</p><Link to="/products" className="text-link">Find something worth keeping ↗</Link></div>
    </section>
    <SiteFooter />
  </div>;
}
