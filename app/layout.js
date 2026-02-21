import "./globals.css";

export const metadata = {
  title: "ThetaEdge — Put Spread & Iron Condor Screener",
  description: "AI-powered options premium selling screener with technical analysis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
