"use client";

import { useEffect, useRef } from "react";

// Fixed, full-screen animated background: drifting color orbs + masked grid
// + a glow that smoothly follows the cursor (interactive). Pure transform/
// opacity for performance. Sits behind all content (z-index: -2).
export default function AnimatedBackground() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    function loop() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el!.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    }
    function onMove(e: PointerEvent) {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function onTouch(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      tx = t.clientX;
      ty = t.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="oji-bg-fx">
      <div className="oji-orb oji-orb-1" />
      <div className="oji-orb oji-orb-2" />
      <div className="oji-orb oji-orb-3" />
      <div className="oji-grid" />
      <div ref={glowRef} className="oji-cursor-glow" />
    </div>
  );
}
