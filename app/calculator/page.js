"use client";

export default function CalculatorPage() {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#0f0f12" }}>
      <iframe
        src="/calculator.html"
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Калькулятор себестоимости"
      />
    </div>
  );
}
