"use client";

import { useEffect } from "react";

// Reveals elements with the `oji-reveal` class as they scroll into view.
// Works on every device (IntersectionObserver). Handles SPA navigation via a
// MutationObserver, and a safety pass for anything already on screen.
export default function AutoReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    const observeAll = (root: ParentNode) => {
      root.querySelectorAll?.(".oji-reveal:not(.in)").forEach((el) => io.observe(el));
    };
    observeAll(document);

    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) {
            if (n.classList?.contains("oji-reveal") && !n.classList.contains("in")) io.observe(n);
            observeAll(n);
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Safety: reveal anything already within the viewport shortly after load.
    const t = setTimeout(() => {
      document.querySelectorAll(".oji-reveal:not(.in)").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
      });
    }, 1000);

    return () => {
      io.disconnect();
      mo.disconnect();
      clearTimeout(t);
    };
  }, []);

  return null;
}
