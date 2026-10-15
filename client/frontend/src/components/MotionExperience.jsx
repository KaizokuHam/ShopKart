import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export default function MotionExperience() {
  const { pathname, hash } = useLocation();
  const lenis = useRef(null);
  const progress = useRef(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const configure = () => {
      lenis.current?.destroy();
      lenis.current = preference.matches ? null : new Lenis({
        autoRaf: true, lerp: 0.085, smoothWheel: true,
        syncTouch: false, anchors: { offset: -100 },
        prevent: node => node.hasAttribute("data-lenis-prevent"),
      });
    };
    configure();
    preference.addEventListener("change", configure);
    const updateProgress = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (progress.current) progress.current.style.transform = `scaleX(${height > 0 ? Math.min(1, window.scrollY / height) : 0})`;
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
    return () => {
      lenis.current?.destroy();
      lenis.current = null;
      preference.removeEventListener("change", configure);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    let anchor = hash.slice(1);
    try { anchor = decodeURIComponent(anchor); } catch { /* Invalid URL fragments are harmless. */ }
    const target = hash ? document.getElementById(anchor) : null;
    if (lenis.current) lenis.current.scrollTo(target || 0, { immediate: true });
    else if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: "instant" });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach(element => {
      element.setAttribute("data-reveal-ready", "");
      observer.observe(element);
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.getElementById("root"), { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [pathname, hash]);

  return <div className="scroll-progress" ref={progress} aria-hidden="true" />;
}
