"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import EarningsYouTube from "./EarningsYouTube";

const BG = "#0a0e1a", C1 = "#0f1320", C2 = "#141825", BD = "#1e293b", TX = "#f1f5f9", T2 = "#cbd5e1", MU = "#8892a8", AC = "#818cf8";
const F = { fontFamily: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif" };

function fmtM(n) { if (n == null) return "?"; if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`; if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`; return `$${n.toFixed(2)}`; }
function fmtPct(n) { if (n == null) return "—"; return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`; }

// ===== MINI BAR CHART =====
function BarChart({ data, width = 500, height = 180 }) {
  if (!data.length) return null;
  const P = { t: 24, r: 10, b: 50, l: 50 };
  const cW = width - P.l - P.r, cH = height - P.t - P.b;
  const vals = data.map(d => d.value);
  const maxAbs = Math.max(...vals.map(Math.abs), 0.01);
  const barW = Math.max(8, Math.min(36, cW / data.length * 0.7));
  const gap = cW / data.length;
  const zeroY = P.t + cH / 2;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* Zero line */}
      <line x1={P.l} x2={width - P.r} y1={zeroY} y2={zeroY} stroke="#293040" strokeWidth={1} />
      {/* Grid lines */}
      {[-maxAbs, -maxAbs / 2, maxAbs / 2, maxAbs].map((v, i) => {
        const y = zeroY - (v / maxAbs) * (cH / 2);
        return <text key={i} x={P.l - 6} y={y + 4} fill={MU} fontSize={10} textAnchor="end" fontFamily={F.fontFamily}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</text>;
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = P.l + gap * i + (gap - barW) / 2;
        const barH = (d.value / maxAbs) * (cH / 2);
        const y = d.value >= 0 ? zeroY - barH : zeroY;
        const color = d.beat === true ? "#22c55e" : d.beat === false ? "#ef4444" : "#6b7280";
        return (
          <g key={i}>
            <rect x={x} y={d.value >= 0 ? y : zeroY} width={barW} height={Math.abs(barH)} fill={color} rx={2} opacity={0.85} />
            <text x={x + barW / 2} y={d.value >= 0 ? y - 4 : zeroY + Math.abs(barH) + 12} fill={color} fontSize={10} textAnchor="middle" fontWeight={700} fontFamily={F.fontFamily}>{fmtPct(d.value)}</text>
            <text x={x + barW / 2} y={height - P.b + 14} fill={MU} fontSize={9} textAnchor="middle" fontFamily={F.fontFamily} transform={`rotate(-35, ${x + barW / 2}, ${height - P.b + 14})`}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ===== EPS BEAT/MISS CHART =====
function EPSChart({ history, width = 500, height = 200 }) {
  if (!history.length) return null;
  const P = { t: 30, r: 10, b: 50, l: 55 };
  const cW = width - P.l - P.r, cH = height - P.t - P.b;
  const allVals = history.flatMap(h => [h.actual, h.estimate].filter(v => v != null));
  if (!allVals.length) return null;
  const rawMn = Math.min(...allVals);
  const rawMx = Math.max(...allVals);
  const pad = (rawMx - rawMn) * 0.1 || 0.01;
  const mn = rawMn - pad;
  const mx = rawMx + pad;
  const rng = mx - mn || 0.01;
  const gap = cW / Math.max(1, history.length - 1);
  const toY = v => P.t + (1 - (v - mn) / rng) * cH;

  // Estimate line
  const estPts = history.map((h, i) => h.estimate != null ? `${P.l + gap * i},${toY(h.estimate)}` : null).filter(Boolean);
  // Actual dots
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const v = mn + pct * rng, y = toY(v);
        return <g key={pct}><line x1={P.l} x2={width - P.r} y1={y} y2={y} stroke="#1a2030" strokeWidth={1} /><text x={P.l - 6} y={y + 4} fill={MU} fontSize={10} textAnchor="end" fontFamily={F.fontFamily}>${v.toFixed(2)}</text></g>;
      })}
      {/* Estimate line */}
      {estPts.length > 1 && <polyline points={estPts.join(" ")} fill="none" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5,3" />}
      {/* Actual line + dots */}
      {history.map((h, i) => {
        if (h.actual == null) return null;
        const x = P.l + gap * i, y = toY(h.actual);
        const beat = h.beat;
        const color = beat === true ? "#22c55e" : beat === false ? "#ef4444" : "#6b7280";
        return (
          <g key={i}>
            {h.estimate != null && <line x1={x} x2={x} y1={toY(h.estimate)} y2={y} stroke={color} strokeWidth={1.5} strokeDasharray="2,2" />}
            <circle cx={x} cy={y} r={5} fill={color} stroke="#0a0e1a" strokeWidth={2} />
            <text x={x} y={y - 10} fill={color} fontSize={10} textAnchor="middle" fontWeight={700} fontFamily={F.fontFamily}>${h.actual?.toFixed(2)}</text>
            {h.estimate != null && <circle cx={x} cy={toY(h.estimate)} r={3} fill="#6b7280" stroke="#0a0e1a" strokeWidth={1.5} />}
            <text x={x} y={height - P.b + 14} fill={MU} fontSize={9} textAnchor="middle" fontFamily={F.fontFamily} transform={`rotate(-35, ${x}, ${height - P.b + 14})`}>{h.period || `Q${i + 1}`}</text>
          </g>
        );
      })}
      {/* Legend */}
      <circle cx={P.l + 10} cy={12} r={4} fill="#22c55e" /><text x={P.l + 18} y={16} fill={T2} fontSize={10} fontFamily={F.fontFamily}>Actual</text>
      <circle cx={P.l + 70} cy={12} r={3} fill="#6b7280" /><text x={P.l + 78} y={16} fill={MU} fontSize={10} fontFamily={F.fontFamily}>Estimate</text>
    </svg>
  );
}

// ===== ANALYST CONSENSUS BAR =====
function ConsensusBar({ data }) {
  if (!data) return null;
  const total = data.total || 1;
  const segments = [
    { key: "strongBuy", color: "#15803d", label: "Strong Buy", n: data.strongBuy },
    { key: "buy", color: "#22c55e", label: "Buy", n: data.buy },
    { key: "hold", color: "#eab308", label: "Hold", n: data.hold },
    { key: "sell", color: "#f97316", label: "Sell", n: data.sell },
    { key: "strongSell", color: "#ef4444", label: "Strong Sell", n: data.strongSell },
  ];
  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 28, marginBottom: 8 }}>
        {segments.filter(s => s.n > 0).map(s => (
          <div key={s.key} style={{ width: `${(s.n / total) * 100}%`, background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", minWidth: s.n > 0 ? 24 : 0 }}>{s.n}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {segments.filter(s => s.n > 0).map(s => (
          <span key={s.key} style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>● {s.label}: {s.n} ({Math.round(s.n / total * 100)}%)</span>
        ))}
      </div>
    </div>
  );
}

// ===== IMPLIED MOVE GAUGE =====
function ImpliedMoveGauge({ implied, stats }) {
  if (!implied) return null;
  const pct = implied.impliedMovePct;
  const avgReal = stats?.avgAbsMove;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={{ background: "#0a0e1a", borderRadius: 6, padding: 16, border: `1px solid ${BD}` }}>
        <div style={{ fontSize: 12, color: MU, fontWeight: 600, marginBottom: 8 }}>OPTIONS IMPLIED MOVE</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#eab308" }}>±{pct}%</div>
        <div style={{ fontSize: 13, color: T2, marginTop: 4 }}>
          ${implied.impliedMoveDown.toFixed(2)} — ${implied.impliedMoveUp.toFixed(2)}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: MU }}>
          ATM Straddle: ${implied.straddle} · IV: {implied.atmIV}%{implied.dte != null ? ` · ${implied.dte}DTE` : ""}
        </div>
      </div>
      <div style={{ background: "#0a0e1a", borderRadius: 6, padding: 16, border: `1px solid ${BD}` }}>
        <div style={{ fontSize: 12, color: MU, fontWeight: 600, marginBottom: 8 }}>HISTORICAL AVG MOVE</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: avgReal != null ? (avgReal < pct ? "#22c55e" : "#ef4444") : T2 }}>
          {avgReal != null ? `±${avgReal}%` : "—"}
        </div>
        {avgReal != null && pct > 0 && (
          <>
            <div style={{ fontSize: 13, color: avgReal < pct ? "#22c55e" : "#ef4444", fontWeight: 600, marginTop: 4 }}>
              {avgReal < pct
                ? `Options overpricing by ${(pct - avgReal).toFixed(1)}% → SELL PREMIUM`
                : `Options underpricing by ${(avgReal - pct).toFixed(1)}% → CAUTION`}
            </div>
            {/* Visual bar comparing */}
            <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: MU, width: 50 }}>Implied</span>
              <div style={{ flex: 1, height: 8, background: "#1a2030", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct / Math.max(pct, avgReal) * 100)}%`, height: "100%", background: "#eab308", borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
              <span style={{ fontSize: 10, color: MU, width: 50 }}>Actual</span>
              <div style={{ flex: 1, height: 8, background: "#1a2030", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, avgReal / Math.max(pct, avgReal) * 100)}%`, height: "100%", background: avgReal < pct ? "#22c55e" : "#ef4444", borderRadius: 4 }} />
              </div>
            </div>
          </>
        )}
        {stats && <div style={{ marginTop: 8, fontSize: 12, color: MU }}>Max move: ±{stats.maxAbsMove}% · Beat rate: {stats.beatRate}% · {stats.count} qtrs</div>}
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export default function EarningsDash({ stocks, onAnalyze }) {
  const [calendar, setCalendar] = useState([]);
  const [calLoading, setCalLoading] = useState(true);
  const [selTicker, setSelTicker] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [calView, setCalView] = useState("upcoming"); // upcoming | recent | all
  const [ytData, setYtData] = useState(null); // { videoId, title, channel, searchUrl, source }
  const [ytLoading, setYtLoading] = useState(false);
  const [activeTxId, setActiveTxId] = useState(null); // which transcript is open
  const [txError, setTxError] = useState(null);
  const txContentRef = useRef(null);

  // Fetch calendar
  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await fetch("/api/earnings");
      const data = await res.json();
      setCalendar(data.calendar || []);
    } catch (e) { console.error("Calendar error:", e); }
    setCalLoading(false);
  }, []);

  // Fetch detail for a ticker
  const loadDetail = useCallback(async (ticker) => {
    setSelTicker(ticker);
    setDetailLoading(true);
    setTranscript(null);
    setYtData(null);
    setActiveTxId(null);
    setTxError(null);
    try {
      const res = await fetch(`/api/earnings?ticker=${encodeURIComponent(ticker)}`);
      const data = await res.json();
      setDetail(data);
    } catch (e) { console.error("Detail error:", e); setDetail(null); }
    setDetailLoading(false);
  }, []);

  // Fetch YouTube video for an earnings call
  const loadYouTube = useCallback(async (ticker, year, quarter) => {
    setYtLoading(true);
    setYtData(null);
    try {
      const params = new URLSearchParams({ ticker });
      if (year) params.set("year", year);
      if (quarter) params.set("quarter", quarter);
      const res = await fetch(`/api/earnings/audio?${params}`);
      const data = await res.json();
      setYtData(data);
    } catch (e) {
      console.error("YouTube error:", e);
      setYtData({ videoId: null, source: "error" });
    }
    setYtLoading(false);
  }, []);

  // Submit manually pasted YouTube URL
  const submitYouTubeUrl = useCallback(async (videoUrl) => {
    if (!videoUrl || !selTicker) return;
    const t = detail?.transcripts?.find(x => x.id === activeTxId);
    try {
      const res = await fetch("/api/earnings/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selTicker, year: t?.year, quarter: t?.quarter, videoUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setYtData(data);
      }
    } catch (e) { console.error("Manual YouTube error:", e); }
  }, [selTicker, activeTxId, detail]);

  // Fetch a transcript + YouTube video
  const loadTranscript = useCallback(async (id, year, quarter) => {
    // Toggle: if clicking the already-active transcript, close it
    if (id === activeTxId) {
      setActiveTxId(null);
      setTranscript(null);
      setYtData(null);
      setTxError(null);
      return;
    }
    setTxLoading(true);
    setActiveTxId(id);
    setTranscript(null);
    setYtData(null);
    setTxError(null);
    try {
      const res = await fetch(`/api/earnings?transcript=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTranscript(data.transcript || null);
    } catch (e) {
      console.error("Transcript error:", e);
      setTxError(e.message || "Failed to load transcript");
    }
    setTxLoading(false);
    // Scroll transcript area into view
    setTimeout(() => {
      txContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
    // Also find YouTube video in parallel
    if (selTicker) {
      loadYouTube(selTicker, year, quarter);
    }
  }, [selTicker, activeTxId, loadYouTube]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  // Group calendar by week
  const calFiltered = calendar.filter(e => {
    if (calView === "upcoming") return e.daysUntil >= 0;
    if (calView === "recent") return e.daysUntil < 0;
    return true;
  });

  // Group by date
  const byDate = {};
  calFiltered.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
  const dates = Object.keys(byDate).sort();

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span>📅</span> Earnings Dashboard
          </h2>
          <div style={{ fontSize: 12, color: MU, marginTop: 4 }}>
            Calendar · Analyst Consensus · Historical Moves · Implied Vol · Transcripts
          </div>
        </div>
        <button onClick={loadCalendar} style={{ background: AC, color: "#fff", border: "none", padding: "9px 20px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>{calLoading ? "⟳ Loading..." : "↻ Refresh"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selTicker ? "320px 1fr" : "1fr", gap: 16 }}>
        {/* LEFT: CALENDAR */}
        <div>
          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
            {[["upcoming", "Upcoming"], ["recent", "Recent"], ["all", "All"]].map(([k, l]) => (
              <button key={k} onClick={() => setCalView(k)} style={{ background: calView === k ? AC : "transparent", color: calView === k ? "#fff" : MU, border: `1px solid ${calView === k ? AC : BD}`, padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, ...F }}>{l}</button>
            ))}
          </div>

          {calLoading && !calendar.length ? (
            <div style={{ padding: 40, textAlign: "center", color: MU }}>Loading earnings calendar...</div>
          ) : !dates.length ? (
            <div style={{ padding: 40, textAlign: "center", color: MU }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TX, marginBottom: 6 }}>No earnings found</div>
              <div style={{ fontSize: 12 }}>Add FINNHUB_API_KEY for earnings calendar data</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: selTicker ? "calc(100vh - 200px)" : "auto", overflowY: selTicker ? "auto" : "visible" }}>
              {dates.map(date => {
                const items = byDate[date];
                const d = new Date(date + "T12:00:00");
                const isToday = new Date().toISOString().split("T")[0] === date;
                const isPast = items[0]?.daysUntil < 0;
                return (
                  <div key={date} style={{ background: isToday ? `${AC}10` : C1, border: `1px solid ${isToday ? `${AC}40` : BD}`, borderRadius: 6, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? AC : isPast ? MU : "#eab308", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                      <span>{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      {isToday && <span style={{ background: AC, color: "#fff", padding: "1px 8px", borderRadius: 3, fontSize: 10 }}>TODAY</span>}
                      {items[0]?.daysUntil > 0 && <span style={{ color: MU, fontSize: 11 }}>in {items[0].daysUntil}d</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {items.map((e, idx) => {
                        const isSelected = selTicker === e.ticker;
                        return (
                          <div key={`${e.ticker}-${idx}`} onClick={() => loadDetail(e.ticker)}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 5, cursor: "pointer", background: isSelected ? `${AC}18` : "#0a0e1a", border: `1px solid ${isSelected ? `${AC}40` : "transparent"}` }}
                            onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = "#1a203040"; }} onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = "#0a0e1a"; }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginRight: 8 }}>{e.ticker}</span>
                              <span style={{ fontSize: 11, color: MU }}>{e.hour}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {e.reported ? (
                                <div>
                                  {e.beat === true && <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>BEAT</span>}
                                  {e.beat === false && <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>MISS</span>}
                                  {e.beat == null && <span style={{ fontSize: 12, fontWeight: 700, color: MU }}>REPORTED</span>}
                                  {e.surprise != null && <span style={{ fontSize: 11, color: e.surprise > 0 ? "#22c55e" : "#ef4444", marginLeft: 6 }}>{e.surprise > 0 ? "+" : ""}{e.surprise.toFixed(1)}%</span>}
                                </div>
                              ) : (
                                <div>
                                  {e.epsEstimate != null && <span style={{ fontSize: 12, color: T2 }}>EPS: ${e.epsEstimate.toFixed(2)}</span>}
                                  {e.revenueEstimate != null && <span style={{ fontSize: 11, color: MU, marginLeft: 6 }}>{fmtM(e.revenueEstimate)}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: DETAIL PANEL */}
        {selTicker && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {detailLoading ? (
              <div style={{ padding: 80, textAlign: "center" }}>
                <div style={{ fontSize: 16, color: AC, fontWeight: 600 }}>Loading earnings data for {selTicker}...</div>
                <div style={{ fontSize: 13, color: MU, marginTop: 6 }}>Fetching historical EPS, price moves, options, analysts</div>
              </div>
            ) : !detail ? (
              <div style={{ padding: 60, textAlign: "center", color: MU }}>Failed to load data for {selTicker}</div>
            ) : (
              <>
                {/* TICKER HEADER */}
                <div style={{ background: C1, borderRadius: 6, padding: "16px 20px", border: `1px solid ${BD}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>{detail.ticker} Earnings Analysis</h3>
                    <div style={{ fontSize: 12, color: MU, marginTop: 4 }}>
                      {detail.moveStats ? `${detail.moveStats.count} quarters · ${detail.moveStats.beatRate}% beat rate · Avg move ±${detail.moveStats.avgAbsMove}%` : "Loading stats..."}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => loadDetail(selTicker)} style={{ background: "#1a2030", border: `1px solid ${BD}`, padding: "7px 16px", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600, color: TX, ...F }}>↻ Refresh</button>
                    {onAnalyze && <button onClick={() => onAnalyze(selTicker)} style={{ background: AC, color: "#fff", border: "none", padding: "7px 18px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>⚡ Gemini Analysis</button>}
                  </div>
                </div>

                {/* IMPLIED VS REALIZED MOVE */}
                <ImpliedMoveGauge implied={detail.impliedMove} stats={detail.moveStats} />

                {/* ANALYST CONSENSUS */}
                {detail.analysts && (
                  <div style={{ background: C1, borderRadius: 6, padding: "16px 20px", border: `1px solid ${BD}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.03em" }}>📊 ANALYST CONSENSUS</div>
                      {detail.priceTargets && detail.priceTargets.mean != null && (
                        <div style={{ fontSize: 13, color: T2 }}>
                          Target: <b style={{ color: "#22c55e" }}>${detail.priceTargets.mean.toFixed(0)}</b>
                          {detail.priceTargets.low != null && detail.priceTargets.high != null && (
                            <span style={{ color: MU, marginLeft: 6 }}>({`$${detail.priceTargets.low.toFixed(0)} — $${detail.priceTargets.high.toFixed(0)}`})</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ConsensusBar data={detail.analysts} />
                  </div>
                )}

                {/* EPS ESTIMATES */}
                {detail.epsEstimates && detail.epsEstimates.length > 0 && (
                  <div style={{ background: C1, borderRadius: 6, padding: "16px 20px", border: `1px solid ${BD}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#06b6d4", letterSpacing: "0.03em", marginBottom: 12 }}>📈 FORWARD ESTIMATES</div>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, detail.epsEstimates.length)}, 1fr)`, gap: 10 }}>
                      {detail.epsEstimates.map((e, i) => (
                        <div key={i} style={{ background: "#0a0e1a", borderRadius: 5, padding: "12px 14px", border: `1px solid ${BD}` }}>
                          <div style={{ fontSize: 11, color: MU, fontWeight: 600, marginBottom: 6 }}>{e.period}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{e.avgEstimate != null ? `$${e.avgEstimate.toFixed(2)}` : "?"}</div>
                          {e.lowEstimate != null && e.highEstimate != null && (
                            <div style={{ fontSize: 11, color: MU, marginTop: 4 }}>
                              Range: ${e.lowEstimate.toFixed(2)} — ${e.highEstimate.toFixed(2)}
                            </div>
                          )}
                          {detail.revenueEstimates?.[i] && (
                            <div style={{ fontSize: 11, color: T2, marginTop: 4 }}>
                              Rev: {fmtM(detail.revenueEstimates[i].avgEstimate)}
                            </div>
                          )}
                          {e.analysts && <div style={{ fontSize: 10, color: MU, marginTop: 2 }}>{e.analysts} analysts</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HISTORICAL EPS */}
                {detail.earningsHistory?.length > 0 && (
                  <div style={{ background: C1, borderRadius: 6, padding: "16px 20px", border: `1px solid ${BD}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", letterSpacing: "0.03em", marginBottom: 6 }}>💰 EPS HISTORY — ACTUAL vs ESTIMATE</div>
                    <div style={{ fontSize: 11, color: MU, marginBottom: 10 }}>
                      Green = beat · Red = miss · Dashed = consensus estimate
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <EPSChart history={detail.earningsHistory} width={Math.max(400, detail.earningsHistory.length * 65)} />
                    </div>
                    {/* Table */}
                    <div style={{ marginTop: 12, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, ...F }}>
                        <thead><tr>
                          {["Quarter", "EPS Est", "EPS Actual", "Surprise", "Beat?"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: MU, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${BD}` }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>{detail.earningsHistory.map((h, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${BD}20` }}>
                            <td style={{ padding: "7px 10px", fontWeight: 600, color: T2 }}>{h.period}</td>
                            <td style={{ padding: "7px 10px", color: MU }}>{h.estimate != null ? `$${h.estimate.toFixed(2)}` : "—"}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 700, color: h.beat ? "#22c55e" : h.beat === false ? "#ef4444" : T2 }}>{h.actual != null ? `$${h.actual.toFixed(2)}` : "—"}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 600, color: (h.surprisePct || 0) > 0 ? "#22c55e" : "#ef4444" }}>{h.surprisePct != null ? `${h.surprisePct > 0 ? "+" : ""}${h.surprisePct.toFixed(1)}%` : "—"}</td>
                            <td style={{ padding: "7px 10px" }}>
                              {h.beat === true && <span style={{ color: "#22c55e", fontWeight: 700 }}>✓ Beat</span>}
                              {h.beat === false && <span style={{ color: "#ef4444", fontWeight: 700 }}>✗ Miss</span>}
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* HISTORICAL PRICE MOVES */}
                {detail.historicalMoves?.length > 0 && (
                  <div style={{ background: C1, borderRadius: 6, padding: "16px 20px", border: `1px solid ${BD}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#eab308", letterSpacing: "0.03em", marginBottom: 6 }}>📊 POST-EARNINGS PRICE MOVES</div>
                    <div style={{ fontSize: 11, color: MU, marginBottom: 10 }}>
                      {detail.moveStats ? `Avg ±${detail.moveStats.avgAbsMove}% · Max ±${detail.moveStats.maxAbsMove}% · Positive ${detail.moveStats.positiveRate}% of the time` : ""}
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <BarChart
                        data={detail.historicalMoves.map(m => ({
                          value: m.move,
                          label: m.period || "",
                          beat: m.beat,
                        }))}
                        width={Math.max(400, detail.historicalMoves.length * 55)}
                        height={200}
                      />
                    </div>
                    {/* Implied move overlay */}
                    {detail.impliedMove && (
                      <div style={{ marginTop: 10, padding: "10px 14px", background: `#eab30810`, border: `1px solid #eab30830`, borderRadius: 5, display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#eab308", fontWeight: 700 }}>IMPLIED:</span>
                        <span style={{ fontSize: 13, color: T2 }}>
                          Options pricing ±{detail.impliedMove.impliedMovePct}% move
                          {detail.moveStats && detail.impliedMove.impliedMovePct > detail.moveStats.avgAbsMove
                            ? <span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 8 }}>→ OVERPRICED vs history (sell premium)</span>
                            : detail.moveStats
                            ? <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 8 }}>→ UNDERPRICED vs history (caution)</span>
                            : null}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* EARNINGS CALL TRANSCRIPTS */}
                {detail.transcripts?.length > 0 && (
                  <div style={{ background: C1, borderRadius: 6, padding: "16px 20px", border: `1px solid ${BD}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.03em", marginBottom: 12 }}>🎙️ EARNINGS CALLS</div>

                    {/* Transcript list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {detail.transcripts.map(t => {
                        const isActive = activeTxId === t.id;
                        return (
                          <div key={t.id}
                            onClick={(e) => { e.stopPropagation(); loadTranscript(t.id, t.year, t.quarter); }}
                            role="button" tabIndex={0}
                            onKeyDown={e => { if (e.key === "Enter") loadTranscript(t.id, t.year, t.quarter); }}
                            style={{ padding: "10px 14px", background: isActive ? "#818cf818" : "#0a0e1a", borderRadius: 5, border: `1px solid ${isActive ? "#818cf840" : BD}`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16 }}>{isActive ? "🔊" : "📄"}</span>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: 14, color: isActive ? "#fff" : TX }}>{t.title || `Q${t.quarter} ${t.year}`}</span>
                                <span style={{ fontSize: 11, color: MU, marginLeft: 10 }}>{t.time ? new Date(t.time).toLocaleDateString() : ""}</span>
                              </div>
                            </div>
                            <span style={{ fontSize: 12, color: isActive ? "#22c55e" : AC, fontWeight: 600 }}>
                              {txLoading && activeTxId === t.id ? "⟳ Loading..." : isActive ? "▲ Close" : "Read →"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* YouTube embed + Transcript content (shown when a transcript is selected) */}
                    {activeTxId && (
                      <div ref={txContentRef} style={{ marginTop: 12 }}>
                        {txLoading && (
                          <div style={{ background: "#0d1117", borderRadius: 8, padding: "16px 20px", border: `1px solid ${BD}`, textAlign: "center" }}>
                            <span style={{ fontSize: 13, color: AC }}>⟳ Loading transcript...</span>
                          </div>
                        )}

                        {!txLoading && txError && (
                          <div style={{ background: "#ef444410", borderRadius: 8, padding: "12px 16px", border: "1px solid #ef444430" }}>
                            <span style={{ fontSize: 12, color: "#ef4444" }}>⚠ {txError}</span>
                          </div>
                        )}

                        {!txLoading && !txError && (
                          <>
                            {/* YouTube embed */}
                            {ytLoading ? (
                              <div style={{ background: "#0d1117", borderRadius: 8, padding: "12px 16px", border: `1px solid ${BD}`, textAlign: "center" }}>
                                <span style={{ fontSize: 12, color: MU }}>⟳ Finding audio...</span>
                              </div>
                            ) : (
                              <EarningsYouTube
                                videoId={ytData?.videoId || null}
                                title={ytData?.title}
                                channel={ytData?.channel}
                                thumbnail={ytData?.thumbnail}
                                searchUrl={ytData?.searchUrl}
                                onPasteUrl={submitYouTubeUrl}
                              />
                            )}

                            {/* Transcript text content */}
                            {transcript ? (
                              <div style={{ marginTop: 12, padding: "16px 18px", background: "#0a0e1a", borderRadius: 6, border: `1px solid ${BD}`, maxHeight: 600, overflowY: "auto" }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{transcript.title}</div>
                                <div style={{ fontSize: 11, color: MU, marginBottom: 12 }}>{transcript.time ? new Date(transcript.time).toLocaleDateString() : ""}</div>
                                {transcript.participants?.length > 0 && (
                                  <div style={{ marginBottom: 12, padding: "8px 12px", background: C1, borderRadius: 5 }}>
                                    <div style={{ fontSize: 11, color: MU, fontWeight: 600, marginBottom: 4 }}>PARTICIPANTS</div>
                                    <div style={{ fontSize: 12, color: T2, lineHeight: 1.7 }}>
                                      {transcript.participants.map((p, i) => (
                                        <span key={i}>{p.name}{p.role ? ` (${p.role})` : ""}{i < transcript.participants.length - 1 ? " · " : ""}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {transcript.sections?.map((s, i) => (
                                  <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < transcript.sections.length - 1 ? `1px solid ${BD}` : "none" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: s.role?.toLowerCase().includes("analyst") ? "#eab308" : AC, marginBottom: 4 }}>
                                      {s.name} {s.role ? <span style={{ fontWeight: 400, color: MU }}>({s.role})</span> : ""}
                                    </div>
                                    <div style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>{s.speech}</div>
                                  </div>
                                ))}
                                {transcript.sections?.length >= 20 && (
                                  <div style={{ fontSize: 12, color: MU, textAlign: "center", padding: 10 }}>{transcript.sectionCount || transcript.sections.length} total sections</div>
                                )}
                              </div>
                            ) : (
                              <div style={{ marginTop: 12, padding: "16px 18px", background: "#0a0e1a", borderRadius: 6, border: `1px solid ${BD}`, textAlign: "center" }}>
                                <div style={{ fontSize: 13, color: MU }}>Transcript text not available for this call</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* NO FINNHUB WARNING */}
                {!detail.sources?.finnhub && (
                  <div style={{ padding: "16px 20px", background: "#eab30810", border: "1px solid #eab30830", borderRadius: 6, fontSize: 13, color: "#eab308" }}>
                    ⚠️ Add FINNHUB_API_KEY for earnings history, analyst consensus, and transcripts. Currently showing options-derived data from Yahoo Finance only.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
