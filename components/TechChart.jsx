"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

function calcSMA(data, period) { return data.map((_, i) => { if (i < period - 1) return null; let s = 0; for (let j = i - period + 1; j <= i; j++) s += data[j].c; return s / period; }); }
function calcBB(data, p = 20, m = 2) { return data.map((_, i) => { if (i < p - 1) return null; let s = 0, sq = 0; for (let j = i - p + 1; j <= i; j++) { s += data[j].c; sq += data[j].c ** 2; } const mn = s / p, std = Math.sqrt(Math.max(0, sq / p - mn ** 2)); return { mid: mn, upper: mn + m * std, lower: mn - m * std }; }); }
function calcRSI(data, p = 14) { const r = new Array(data.length).fill(null); for (let i = p; i < data.length; i++) { let g = 0, l = 0; for (let j = i - p + 1; j <= i; j++) { const d = data[j].c - data[j - 1].c; if (d > 0) g += d; else l -= d; } r[i] = g === 0 && l === 0 ? 50 : 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } return r; }

const FONT = "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif";

export default function TechChart({ price, ticker, supportResistance, shortStrike, histData }) {
  const [period, setPeriod] = useState("6M");
  const [zoom, setZoom] = useState(1);
  const [panOff, setPanOff] = useState(0);
  const [showBB, setShowBB] = useState(true);
  const [showMA, setShowMA] = useState({ sma50: true, sma100: true, sma200: true });
  const [showCandles, setShowCandles] = useState(true);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const svgRef = useRef(null);

  const pDays = { "1M": 22, "3M": 66, "6M": 132, "9M": 198, "1Y": 252 };
  const days = pDays[period] || 132;

  // Reset zoom/pan when ticker changes
  useEffect(() => { setZoom(1); setPanOff(0); }, [ticker]);

  // Use real data if available, or return empty
  const full = useMemo(() => {
    if (!histData || !histData.length) return [];
    return histData.map(d => ({ ...d, date: new Date(d.date) }));
  }, [histData]);

  const sma50 = useMemo(() => calcSMA(full, 50), [full]);
  const sma100 = useMemo(() => calcSMA(full, 100), [full]);
  const sma200 = useMemo(() => calcSMA(full, 200), [full]);
  const bb = useMemo(() => calcBB(full), [full]);
  const rsi = useMemo(() => calcRSI(full), [full]);

  if (!full.length) return <div style={{ background: "#060610", borderRadius: 6, padding: 40, border: "1px solid #1e293b", textAlign: "center", color: "#8892a8" }}>Loading chart data for {ticker}...</div>;

  const visCnt = Math.max(10, Math.round(days / zoom));
  const maxOff = Math.max(0, full.length - visCnt);
  const off = Math.min(Math.max(0, full.length - visCnt - panOff), maxOff);
  const vis = full.slice(off, off + visCnt);
  const v50 = sma50.slice(off, off + visCnt), v100 = sma100.slice(off, off + visCnt), v200 = sma200.slice(off, off + visCnt);
  const vBB = bb.slice(off, off + visCnt), vRSI = rsi.slice(off, off + visCnt);

  const W = 860, H = 400, P = { t: 20, r: 72, b: 55, l: 10 }, cW = W - P.l - P.r, cH = H - P.t - P.b, rH = 50, rT = H - P.b - rH - 5;
  const allP = vis.flatMap(d => [d.h, d.l]);
  if (showBB) vBB.forEach(b => { if (b) { allP.push(b.upper, b.lower); } });
  if (supportResistance) supportResistance.forEach(s => allP.push(s.level));
  if (shortStrike) allP.push(shortStrike);
  const mn = Math.min(...allP) * 0.995, mx = Math.max(...allP) * 1.005, rng = mx - mn || 1;
  const toX = i => P.l + (i / Math.max(1, visCnt - 1)) * cW;
  const toY = p => P.t + (1 - (p - mn) / rng) * (cH - rH - 15);
  const toRY = v => rT + (1 - v / 100) * rH;
  const cndW = Math.max(1, Math.min(8, cW / visCnt * 0.7));

  const onMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round(((x - P.l) / cW) * (visCnt - 1));
    if (idx >= 0 && idx < vis.length) setHoverIdx(idx);
    if (dragging) { const dx = e.clientX - dragX; const sh = Math.round(dx / (cW / visCnt)); setPanOff(p => Math.max(0, Math.min(maxOff, p + sh))); setDragX(e.clientX); }
  };
  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(5, z + (e.deltaY > 0 ? -0.15 : 0.15)))); }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);
  const hd = hoverIdx !== null && vis[hoverIdx] ? vis[hoverIdx] : null;
  const hR = hoverIdx !== null ? vRSI[hoverIdx] : null;

  return (
    <div style={{ background: "#060610", borderRadius: 6, padding: "16px 18px", border: "1px solid #1e293b" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginRight: 10 }}>TECHNICAL CHART — {ticker}</span>
          {["1M", "3M", "6M", "9M", "1Y"].map(p => (
            <button key={p} onClick={() => { setPeriod(p); setPanOff(0); setZoom(1); }} style={{ background: period === p ? "#6366f1" : "#141822", color: period === p ? "#fff" : "#8892a8", border: `1px solid ${period === p ? "#6366f1" : "#293040"}`, padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>{p}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.3))} style={{ background: "#141822", border: "1px solid #293040", color: "#fff", width: 30, height: 30, borderRadius: 4, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>+</button>
          <span style={{ fontSize: 12, color: "#8892a8", minWidth: 36, textAlign: "center" }}>{zoom.toFixed(1)}x</span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.3))} style={{ background: "#141822", border: "1px solid #293040", color: "#fff", width: 30, height: 30, borderRadius: 4, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>−</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[{ k: "sma50", l: "50 MA", c: "#f59e0b" }, { k: "sma100", l: "100 MA", c: "#3b82f6" }, { k: "sma200", l: "200 MA", c: "#22c55e" }].map(m => (
            <button key={m.k} onClick={() => setShowMA(p => ({ ...p, [m.k]: !p[m.k] }))} style={{ background: showMA[m.k] ? `${m.c}18` : "#141822", border: `1px solid ${showMA[m.k] ? `${m.c}60` : "#293040"}`, color: showMA[m.k] ? m.c : "#555", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>{m.l}</button>
          ))}
          <button onClick={() => setShowBB(p => !p)} style={{ background: showBB ? "#a855f718" : "#141822", border: `1px solid ${showBB ? "#a855f760" : "#293040"}`, color: showBB ? "#a855f7" : "#555", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>BB</button>
          <button onClick={() => setShowCandles(p => !p)} style={{ background: "#141822", border: "1px solid #293040", color: showCandles ? "#e2e8f0" : "#555", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>{showCandles ? "Candles" : "Line"}</button>
        </div>
      </div>
      <div style={{ height: 22, marginBottom: 4, display: "flex", gap: 18, fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
        {hd ? (<>
          <span style={{ color: "#8892a8" }}>{hd.date.toLocaleDateString()}</span>
          <span style={{ color: "#c8d0dc" }}>O <span style={{ color: "#fff" }}>{hd.o.toFixed(2)}</span></span>
          <span style={{ color: "#c8d0dc" }}>H <span style={{ color: "#22c55e" }}>{hd.h.toFixed(2)}</span></span>
          <span style={{ color: "#c8d0dc" }}>L <span style={{ color: "#ef4444" }}>{hd.l.toFixed(2)}</span></span>
          <span style={{ color: "#c8d0dc" }}>C <span style={{ color: hd.c >= hd.o ? "#22c55e" : "#ef4444" }}>{hd.c.toFixed(2)}</span></span>
          {hR && <span style={{ color: "#c8d0dc" }}>RSI <span style={{ color: hR < 30 ? "#22c55e" : hR > 70 ? "#ef4444" : "#eab308" }}>{hR.toFixed(1)}</span></span>}
        </>) : <span style={{ color: "#4a5568" }}>Hover for data · Scroll to zoom · Drag to pan</span>}
      </div>
      <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ cursor: dragging ? "grabbing" : "crosshair", userSelect: "none" }} onMouseMove={onMove} onMouseLeave={() => { setHoverIdx(null); setDragging(false); }} onMouseDown={e => { setDragging(true); setDragX(e.clientX); }} onMouseUp={() => setDragging(false)}>
        {[0.2, 0.4, 0.6, 0.8].map(f => { const p = mn + f * rng; return <g key={f}><line x1={P.l} y1={toY(p)} x2={W - P.r} y2={toY(p)} stroke="#1a2030" strokeWidth="1" /><text x={W - P.r + 5} y={toY(p) + 4} fill="#6b7a90" fontSize="10" fontFamily={FONT}>${p.toFixed(0)}</text></g>; })}
        {showBB && (() => { const pts = vBB.map((b, i) => b ? { x: toX(i), u: toY(b.upper), l: toY(b.lower), m: toY(b.mid) } : null).filter(Boolean); if (pts.length < 2) return null; const up = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.u}`).join(" "); const lo = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.l}`).join(" "); const fill = up + " " + [...pts].reverse().map(p => `L${p.x},${p.l}`).join(" ") + " Z"; const mid = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.m}`).join(" "); return <g><path d={fill} fill="#a855f706" /><path d={up} fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.45" strokeDasharray="4,3" /><path d={lo} fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.45" strokeDasharray="4,3" /><path d={mid} fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.25" /></g>; })()}
        {supportResistance?.map((sr, i) => { if (sr.level < mn || sr.level > mx) return null; const y = toY(sr.level), col = sr.type === "support" ? "#22c55e" : "#ef4444"; return <g key={i}><line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke={col} strokeWidth={sr.strength >= 5 ? 2 : 1.2} strokeDasharray={sr.strength >= 4 ? "0" : "6,4"} opacity="0.55" /><text x={W - P.r + 5} y={y + 3} fill={col} fontSize="9" fontWeight="600" fontFamily={FONT}>${sr.level}</text></g>; })}
        {shortStrike && shortStrike >= mn && shortStrike <= mx && <g><line x1={P.l} y1={toY(shortStrike)} x2={W - P.r} y2={toY(shortStrike)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="10,5" opacity="0.75" /><rect x={P.l} y={toY(shortStrike) - 10} width={82} height={20} rx="3" fill="#f59e0b20" stroke="#f59e0b" strokeWidth="0.8" /><text x={P.l + 6} y={toY(shortStrike) + 3} fill="#f59e0b" fontSize="10" fontWeight="700" fontFamily={FONT}>SHORT ${shortStrike}</text></g>}
        {showCandles ? vis.map((d, i) => { const x = toX(i), g = d.c >= d.o, col = g ? "#22c55e" : "#ef4444"; return <g key={i}><line x1={x} y1={toY(d.h)} x2={x} y2={toY(d.l)} stroke={col} strokeWidth="1" /><rect x={x - cndW / 2} y={toY(Math.max(d.o, d.c))} width={cndW} height={Math.max(1, Math.abs(toY(d.o) - toY(d.c)))} fill={col} /></g>; }) : <path d={vis.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.c)}`).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="1.5" />}
        {showMA.sma50 && (() => { const pts = v50.map((v, i) => v ? `${toX(i)},${toY(v)}` : null).filter(Boolean); return pts.length > 1 ? <path d={`M${pts.join(" L")}`} fill="none" stroke="#f59e0b" strokeWidth="1.8" opacity="0.85" /> : null; })()}
        {showMA.sma100 && (() => { const pts = v100.map((v, i) => v ? `${toX(i)},${toY(v)}` : null).filter(Boolean); return pts.length > 1 ? <path d={`M${pts.join(" L")}`} fill="none" stroke="#3b82f6" strokeWidth="1.8" opacity="0.85" /> : null; })()}
        {showMA.sma200 && (() => { const pts = v200.map((v, i) => v ? `${toX(i)},${toY(v)}` : null).filter(Boolean); return pts.length > 1 ? <path d={`M${pts.join(" L")}`} fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.85" /> : null; })()}
        <line x1={P.l} y1={rT} x2={W - P.r} y2={rT} stroke="#1a2030" strokeWidth="1" />
        <text x={W - P.r + 5} y={rT + 10} fill="#6b7a90" fontSize="9" fontFamily={FONT}>RSI</text>
        <line x1={P.l} y1={toRY(70)} x2={W - P.r} y2={toRY(70)} stroke="#ef444430" strokeWidth="1" strokeDasharray="3,3" />
        <line x1={P.l} y1={toRY(30)} x2={W - P.r} y2={toRY(30)} stroke="#22c55e30" strokeWidth="1" strokeDasharray="3,3" />
        {(() => { const pts = vRSI.map((v, i) => v != null ? `${toX(i)},${toRY(v)}` : null).filter(Boolean); return pts.length > 1 ? <path d={`M${pts.join(" L")}`} fill="none" stroke="#eab308" strokeWidth="1.2" /> : null; })()}
        {hoverIdx !== null && <line x1={toX(hoverIdx)} y1={P.t} x2={toX(hoverIdx)} y2={H - P.b} stroke="#ffffff18" strokeWidth="1" />}
        {vis.map((d, i) => [d, i]).filter(([, i]) => i % Math.max(1, Math.floor(visCnt / 6)) === 0).map(([d, idx]) => <text key={idx} x={toX(idx)} y={H - 10} fill="#6b7a90" fontSize="9" textAnchor="middle" fontFamily={FONT}>{d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 12, color: "#6b7a90" }}>
        {showMA.sma50 && <span><span style={{ color: "#f59e0b" }}>━━</span> 50 DMA</span>}
        {showMA.sma100 && <span><span style={{ color: "#3b82f6" }}>━━</span> 100 DMA</span>}
        {showMA.sma200 && <span><span style={{ color: "#22c55e" }}>━━</span> 200 DMA</span>}
        {showBB && <span><span style={{ color: "#a855f7" }}>┄┄</span> Bollinger (20,2)</span>}
        {shortStrike && <span><span style={{ color: "#f59e0b" }}>╌╌</span> Short Put ${shortStrike}</span>}
      </div>
    </div>
  );
}
