"use client";

import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import ThemeToggle from "../../components/ThemeToggle";

const CURRENCY_ICONS = { USD: "$", EUR: "€", CNY: "¥", GBP: "£", TRY: "₺", KZT: "₸", BYN: "Br" };

function fmt(n) { return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n); }

function RateCard({ code, data }) {
  const icon = CURRENCY_ICONS[code] || code;
  const up = data.change > 0;
  const color = up ? "#EF5350" : "#66BB6A";
  return (
    <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color: "var(--ink)" }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginLeft: 8, letterSpacing: 1 }}>{code}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: color + "18", padding: "3px 8px", borderRadius: 6 }}>
          {up ? "▲" : "▼"} {Math.abs(data.change)}%
        </span>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
        {fmt(data.value)} ₽
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        {data.name} · вчера {fmt(data.previous)} ₽
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "var(--muted)" }}>{p.name}:</span>
          <span style={{ color: "var(--ink)", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(p.value)} ₽</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);
  const [showEur, setShowEur] = useState(true);
  const [showCny, setShowCny] = useState(true);

  useEffect(() => { loadRates(); }, []);

  async function loadRates() {
    setLoading(true);
    try {
      const r = await fetch("/api/rates");
      if (!r.ok) throw new Error("Ошибка загрузки");
      setData(await r.json());
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const chartData = useMemo(() => {
    if (!data?.history?.USD) return [];
    const usdMap = {}, eurMap = {}, cnyMap = {};
    data.history.USD.forEach(d => { usdMap[d.date] = d.value; });
    data.history.EUR?.forEach(d => { eurMap[d.date] = d.value; });
    data.history.CNY?.forEach(d => { cnyMap[d.date] = d.value; });
    const dates = Object.keys(usdMap).sort();
    const sliced = dates.slice(-period);
    return sliced.map(date => {
      const [y, m, d] = date.split("-");
      return { name: `${d}.${m}`, usd: usdMap[date], eur: eurMap[date], cny: cnyMap[date] };
    });
  }, [data, period]);

  const usdRange = useMemo(() => {
    if (!chartData.length) return null;
    const vals = chartData.map(d => d.usd).filter(Boolean);
    return { min: Math.min(...vals), max: Math.max(...vals), avg: vals.reduce((s, v) => s + v, 0) / vals.length };
  }, [chartData]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--muted)", fontSize: 14 }}>
      Загрузка курсов ЦБ РФ...
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "#EF5350", fontSize: 14 }}>
      {error} <button onClick={loadRates} style={{ marginLeft: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid #EF5350", background: "transparent", color: "#EF5350", cursor: "pointer" }}>Повторить</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--ink)", padding: "0 0 60px" }}>
      <ThemeToggle />
      {/* Header */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, color: "var(--gold)", letterSpacing: -1, textTransform: "uppercase" }}>Analytics</span>
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase" }}>Курсы валют ЦБ РФ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={loadRates} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}>
            ↻ Обновить
          </button>
          <button onClick={() => window.location.href = "/"} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}>
            ← Портал
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 40px" }}>
        {/* Rate cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
          {data?.rates && Object.entries(data.rates).map(([code, r]) => (
            <RateCard key={code} code={code} data={r} />
          ))}
        </div>

        {/* USD Stats */}
        {usdRange && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { label: "Мин. за период", value: fmt(usdRange.min) + " ₽", color: "#66BB6A" },
              { label: "Макс. за период", value: fmt(usdRange.max) + " ₽", color: "#EF5350" },
              { label: "Средний", value: fmt(usdRange.avg) + " ₽", color: "var(--gold)" },
              { label: "Разброс", value: fmt(usdRange.max - usdRange.min) + " ₽", color: "#818cf8" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 18px", border: "1px solid rgba(255,255,255,0.07)", minWidth: 140 }}>
                <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <div style={{ background: "var(--surface2)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", padding: "24px 24px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--muted)", textTransform: "uppercase" }}>
              Динамика курсов за {period} дней
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {[30, 60, 90].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  border: period === p ? "1px solid #C9A96E" : "1px solid rgba(255,255,255,0.1)",
                  background: period === p ? "rgba(201,169,110,0.1)" : "transparent",
                  color: period === p ? "#C9A96E" : "#7A7880",
                }}>{p}д</button>
              ))}
              <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: showEur ? "#64B5F6" : "#7A7880", cursor: "pointer" }}>
                <input type="checkbox" checked={showEur} onChange={e => setShowEur(e.target.checked)} style={{ accentColor: "#64B5F6" }} /> EUR
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: showCny ? "#FF8A65" : "#7A7880", cursor: "pointer" }}>
                <input type="checkbox" checked={showCny} onChange={e => setShowCny(e.target.checked)} style={{ accentColor: "#FF8A65" }} /> CNY
              </label>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "#7A7880", fontSize: 10 }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} tickLine={false} />
              <YAxis tick={{ fill: "#7A7880", fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
              <Line type="monotone" dataKey="usd" name="USD" stroke="#C9A96E" strokeWidth={2.5} dot={false} />
              {showEur && <Line type="monotone" dataKey="eur" name="EUR" stroke="#64B5F6" strokeWidth={2} dot={false} strokeDasharray="6 3" />}
              {showCny && <Line type="monotone" dataKey="cny" name="CNY" stroke="#FF8A65" strokeWidth={2} dot={false} strokeDasharray="4 2" />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Data source */}
        <div style={{ marginTop: 20, fontSize: 11, color: "var(--muted2)", textAlign: "center" }}>
          Данные: Центральный банк Российской Федерации · обновлено {data?.date ? new Date(data.date).toLocaleString("ru-RU") : "—"}
        </div>
      </div>
    </div>
  );
}
