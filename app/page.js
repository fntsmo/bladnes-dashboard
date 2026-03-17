"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("../components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#18181C", color: "#7A7880", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14,
    }}>
      Загрузка дашборда...
    </div>
  ),
});

export default function Page() {
  return <Dashboard />;
}
