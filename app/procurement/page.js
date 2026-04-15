"use client";

import dynamic from "next/dynamic";

const Procurement = dynamic(() => import("../../components/Procurement"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #18181C)", color: "var(--muted, #7A7880)", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14,
    }}>
      Загрузка модуля закупок...
    </div>
  ),
});

export default function Page() {
  return <Procurement />;
}
