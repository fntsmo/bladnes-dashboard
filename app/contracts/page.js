"use client";

export default function ContractsPage() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#0f0f12" }}>
      <iframe
        src="/contracts.html"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Генератор договоров"
      />
    </div>
  );
}
