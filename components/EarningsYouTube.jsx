"use client";
import { useState } from "react";

const BD = "#1e293b", TX = "#f1f5f9", T2 = "#cbd5e1", MU = "#8892a8", AC = "#818cf8";

export default function EarningsYouTube({ videoId, title, channel, thumbnail, searchUrl, onPasteUrl }) {
  const [expanded, setExpanded] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasteVal, setPasteVal] = useState("");

  // No video found — show search link + paste option
  if (!videoId) {
    return (
      <div style={{ background: "#0d1117", borderRadius: 8, padding: "12px 16px", border: `1px solid ${BD}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎧</span>
            <span style={{ fontSize: 12, color: MU }}>No audio found automatically</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {searchUrl && (
              <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, color: "#ef4444", textDecoration: "none", fontWeight: 600, padding: "4px 12px",
                background: "#ef444410", borderRadius: 4, border: "1px solid #ef444430",
              }}>
                ▶ Find on YouTube
              </a>
            )}
            <button onClick={() => setPasting(!pasting)} style={{
              fontSize: 11, color: AC, background: `${AC}10`, border: `1px solid ${AC}30`,
              padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontWeight: 600,
            }}>
              {pasting ? "✕" : "🔗 Paste URL"}
            </button>
          </div>
        </div>
        {pasting && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              type="url" placeholder="Paste YouTube URL"
              value={pasteVal} onChange={e => setPasteVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && pasteVal.trim()) { onPasteUrl?.(pasteVal.trim()); setPasting(false); setPasteVal(""); } }}
              style={{ flex: 1, background: "#0a0e1a", border: `1px solid ${BD}`, borderRadius: 5, padding: "6px 10px", color: TX, fontSize: 12, outline: "none" }}
            />
            <button
              onClick={() => { if (pasteVal.trim()) { onPasteUrl?.(pasteVal.trim()); setPasting(false); setPasteVal(""); } }}
              disabled={!pasteVal.trim()}
              style={{ background: pasteVal.trim() ? AC : "#1a2030", color: pasteVal.trim() ? "#fff" : MU, border: "none", padding: "6px 14px", borderRadius: 5, cursor: pasteVal.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 600 }}
            >
              ▶ Load
            </button>
          </div>
        )}
      </div>
    );
  }

  // Video found — collapsible embed
  return (
    <div style={{ background: "#0d1117", borderRadius: 8, border: `1px solid ${BD}`, overflow: "hidden" }}>
      {/* Header bar — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
          background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14 }}>{expanded ? "🔽" : "▶️"}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title || "Earnings Call Audio"}
        </span>
        {channel && <span style={{ fontSize: 10, color: MU, flexShrink: 0 }}>{channel}</span>}
        <span style={{ fontSize: 10, background: "#ff000018", color: "#ef4444", padding: "2px 8px", borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>
          YouTube
        </span>
        <span style={{ fontSize: 11, color: AC, fontWeight: 600, flexShrink: 0 }}>
          {expanded ? "Hide ▲" : "Listen ▼"}
        </span>
      </button>

      {/* Embedded player — shown when expanded */}
      {expanded && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 6, overflow: "hidden" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title={title || "Earnings Call"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 10, color: "#5a6478" }}>Use YouTube's built-in speed control (⚙ → Playback speed)</span>
            <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: MU, textDecoration: "none" }}>
              Open in YouTube ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
