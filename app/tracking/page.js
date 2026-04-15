"use client";
import { useState, useEffect } from "react";
import ThemeToggle from "../../components/ThemeToggle";

function formatMinutes(m) {
  if (!m) return "0м";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}ч ${min}м` : `${min}м`;
}

function getEfficiency(stat) {
  if (!stat.presence_minutes) return null;
  if (stat.expected_behavior === "active") {
    return Math.round((stat.motion_minutes / stat.presence_minutes) * 100);
  }
  // Для стационарных — присутствие = эффективность
  return Math.round((stat.presence_minutes / 480) * 100); // 480 = 8ч
}

function getColor(efficiency) {
  if (efficiency === null) return "#6b7280";
  if (efficiency >= 80) return "#22c55e";
  if (efficiency >= 50) return "#eab308";
  return "#ef4444";
}

export default function TrackingPage() {
  const [stats, setStats] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tracking/stats?date=${date}`)
      .then((r) => r.json())
      .then((data) => setStats(data.stats || []))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--ink)" }}>
      <ThemeToggle />
      {/* Header */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, color: "#06b6d4", letterSpacing: -1, textTransform: "uppercase" }}>Tracking</span>
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase" }}>Мониторинг рабочих зон</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--line2)",
              borderRadius: 8,
              fontSize: 13,
              background: "var(--surface2)",
              color: "var(--ink)",
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          />
          <button onClick={() => window.location.href = "/"} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--line2)", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}>
            ← Портал
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 40px", maxWidth: 1200, margin: "0 auto" }}>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Загрузка...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {stats.map((stat) => {
            const eff = getEfficiency(stat);
            const color = getColor(eff);

            return (
              <div
                key={stat.zone_id}
                style={{
                  border: "1px solid var(--line2)",
                  borderRadius: 12,
                  padding: 20,
                  background: "var(--surface2)",
                  borderLeft: `4px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                      {stat.zone_name}
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>
                      {stat.worker_name || "Сотрудник не назначен"}
                      {" · "}
                      {stat.expected_behavior === "active" ? "активная зона" : "стационарная зона"}
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: "bold",
                      fontFamily: "'IBM Plex Mono', monospace",
                      color,
                    }}
                  >
                    {eff !== null ? `${eff}%` : "—"}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
                  <div style={{ background: "var(--subtle)", borderRadius: 8, padding: 10, textAlign: "center", border: "1px solid var(--line)" }}>
                    <div style={{ color: "var(--muted)" }}>Присутствие</div>
                    <div style={{ fontWeight: 600, fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", color: "var(--ink)" }}>
                      {formatMinutes(stat.presence_minutes)}
                    </div>
                  </div>
                  <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 8, padding: 10, textAlign: "center", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <div style={{ color: "var(--muted)" }}>Движение</div>
                    <div style={{ fontWeight: 600, fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", color: "#22c55e" }}>
                      {formatMinutes(stat.motion_minutes)}
                    </div>
                  </div>
                  <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: 10, textAlign: "center", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div style={{ color: "var(--muted)" }}>Простой</div>
                    <div style={{ fontWeight: 600, fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", color: "#ef4444" }}>
                      {formatMinutes(stat.idle_minutes)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted2)" }}>
                  {stat.total_events > 0
                    ? `${stat.total_events} событий · первое ${stat.first_seen ? new Date(stat.first_seen).toLocaleTimeString("ru") : "—"} · последнее ${stat.last_seen ? new Date(stat.last_seen).toLocaleTimeString("ru") : "—"}`
                    : "Нет данных за этот день"}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
