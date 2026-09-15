"use client";

import { useCallback, useEffect, useState } from "react";

const PAD = 8;
const GAP = 12;
const TW = 280;

export interface TourStep {
  selector: string | null;
  title: string;
  desc: string;
}

interface Box { left: number; top: number; width: number; height: number; }
type Side = "top" | "bottom" | "left" | "right";

function getBox(selector: string | null): Box | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function bestSide(box: Box): Side {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TH = 190;
  if (vw - box.left - box.width - PAD > TW + GAP) return "right";
  if (vh - box.top - box.height - PAD > TH + GAP) return "bottom";
  if (box.left - PAD > TW + GAP) return "left";
  return "top";
}

function tooltipPos(box: Box, side: Side) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TH = 190;
  const cx = (x: number) => Math.max(16, Math.min(x, vw - TW - 16));
  const cy = (y: number) => Math.max(16, Math.min(y, vh - TH - 16));
  switch (side) {
    case "right":  return { top: cy(box.top + box.height / 2 - TH / 2), left: box.left + box.width + PAD + GAP };
    case "left":   return { top: cy(box.top + box.height / 2 - TH / 2), left: box.left - PAD - GAP - TW };
    case "bottom": return { top: box.top + box.height + PAD + GAP,       left: cx(box.left + box.width / 2 - TW / 2) };
    case "top":    return { top: box.top - PAD - GAP - TH,               left: cx(box.left + box.width / 2 - TW / 2) };
  }
}

function Arrow({ side }: { side: Side }) {
  const base: React.CSSProperties = { position: "absolute", width: 10, height: 10, backgroundColor: "var(--card, white)" };
  const s: Record<Side, React.CSSProperties> = {
    right:  { ...base, left: -5,   top: "50%", transform: "translateY(-50%) rotate(45deg)", borderLeft: "1px solid var(--card-border)", borderBottom: "1px solid var(--card-border)" },
    left:   { ...base, right: -5,  top: "50%", transform: "translateY(-50%) rotate(45deg)", borderTop:  "1px solid var(--card-border)", borderRight:  "1px solid var(--card-border)" },
    bottom: { ...base, top: -5,    left: "50%", transform: "translateX(-50%) rotate(45deg)", borderTop: "1px solid var(--card-border)", borderLeft:  "1px solid var(--card-border)" },
    top:    { ...base, bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", borderBottom: "1px solid var(--card-border)", borderRight: "1px solid var(--card-border)" },
  };
  return <div style={s[side]} />;
}

export default function SpotlightTour({ steps, storageKey }: { steps: TourStep[]; storageKey: string }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [side, setSide] = useState<Side>("bottom");

  const refresh = useCallback((s: number) => {
    const sel = steps[s].selector;
    if (sel) document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => {
      const b = getBox(steps[s].selector);
      setBox(b);
      if (b) setSide(bestSide(b));
    }, 300);
  }, [steps]);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) { setVisible(true); refresh(0); }
  }, [storageKey, refresh]);

  useEffect(() => {
    if (!visible) return;
    const h = () => { const b = getBox(steps[step].selector); setBox(b); if (b) setSide(bestSide(b)); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [visible, step, steps]);

  function dismiss() { localStorage.setItem(storageKey, "1"); setVisible(false); }
  function go(n: number) { setStep(n); refresh(n); }

  if (!visible) return null;

  const cur = steps[step];
  const isLast = step === steps.length - 1;
  const hasTarget = !!box && !!cur.selector;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const pos = hasTarget ? tooltipPos(box!, side) : { top: vh / 2 - 95, left: vw / 2 - TW / 2 };

  return (
    <>
      <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998, width: "100vw", height: "100vh" }}>
        {hasTarget ? (
          <>
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x={box!.left - PAD} y={box!.top - PAD} width={box!.width + PAD * 2} height={box!.height + PAD * 2} rx="8" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.38)" mask="url(#tour-mask)" />
            <rect x={box!.left - PAD} y={box!.top - PAD} width={box!.width + PAD * 2} height={box!.height + PAD * 2} rx="8" fill="none" stroke="var(--accent)" strokeWidth="2" />
          </>
        ) : (
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.38)" />
        )}
      </svg>

      <div className="fixed inset-0" style={{ zIndex: 9999 }} onClick={dismiss} />

      <div
        className="fixed bg-card border border-card-border rounded-xl shadow-xl"
        style={{ zIndex: 10000, width: TW, top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {hasTarget && <Arrow side={side} />}
        <div className="p-4 space-y-3">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-card-border"}`} />
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-accent uppercase tracking-widest">{step + 1} / {steps.length}</p>
            <h3 className="font-bold text-sm mt-0.5">{cur.title}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{cur.desc}</p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button onClick={dismiss} className="text-[11px] text-muted hover:text-foreground transition-colors mr-auto">Skip</button>
            {step > 0 && (
              <button onClick={() => go(step - 1)} className="px-3 py-1 text-xs border border-card-border rounded-lg hover:bg-card-border/30 transition-colors">Back</button>
            )}
            <button onClick={isLast ? dismiss : () => go(step + 1)} className="px-3 py-1 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium">
              {isLast ? "Done" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
