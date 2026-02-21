"use client";

export default function Bullets({ text, color }) {
  if (!text) return null;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {lines.map((line, i) => {
        const isBullet = line.startsWith("•") || line.startsWith("-");
        const isNumbered = /^\d+\)/.test(line);
        const isHeader = /^[A-Z][A-Z\s\-—:]+:?\s*$/.test(line) || (line.endsWith(":") && !isBullet && line === line.toUpperCase());
        const isSectionHead = /^(THE SETUP|WHY THE MARKET|THE VOLATILITY|FUNDAMENTAL FLOOR|BOTTOM LINE|KEY |SUPPORT|RESISTANCE)/i.test(line);
        const clean = line.replace(/^[•\-]\s*/, "").replace(/^\d+\)\s*/, "");

        if (isHeader || isSectionHead) {
          return (
            <div key={i} style={{ fontSize: 13, fontWeight: 700, color: color || "#94a3b8", marginTop: i > 0 ? 10 : 0, marginBottom: 2, letterSpacing: "0.03em", textTransform: "uppercase" }}>
              {line.replace(/:$/, "")}
            </div>
          );
        }
        if (isBullet || isNumbered) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingLeft: 4 }}>
              <span style={{ color: color || "#6b7a90", fontSize: 7, marginTop: 8, flexShrink: 0, opacity: 0.7 }}>●</span>
              <span style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.75 }}>{clean}</span>
            </div>
          );
        }
        return <p key={i} style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.75, margin: "2px 0" }}>{line}</p>;
      })}
    </div>
  );
}
