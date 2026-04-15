"use client";

import dynamic from "next/dynamic";

const FinPlan = dynamic(() => import("../../components/FinPlan"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #080e1a)", color: "var(--muted, #34d399)", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14,
    }}>
      Загрузка финплана...
    </div>
  ),
});

export default function FinPlanPage() {
  return <FinPlan />;
}
