"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";

const TOOLS = [
  {
    href: "/dashboard",
    title: "Dashboard",
    sub: "Производство",
    description: "Заказы, статусы, отгрузки по клиентам",
    icon: "▦",
    color: "#C9A96E",
    num: "01",
  },
  {
    href: "/finplan",
    title: "FinPlan",
    sub: "Финансы",
    description: "Ежедневное планирование выручки и расходов",
    icon: "◈",
    color: "#34d399",
    num: "02",
  },
  {
    href: "/calculator",
    title: "Calc",
    sub: "Себестоимость",
    description: "Расчёт стоимости заказа по материалам и работе",
    icon: "⊞",
    color: "#818cf8",
    num: "03",
  },
  {
    href: "/contracts",
    title: "Docs",
    sub: "Договоры",
    description: "Быстрое создание договоров оказания услуг и поставки",
    icon: "◻",
    color: "#f472b6",
    num: "04",
  },
  {
    href: "/analytics",
    title: "Analytics",
    sub: "Аналитика",
    description: "Курсы валют ЦБ РФ, динамика доллара, евро, юаня",
    icon: "◇",
    color: "#f59e0b",
    num: "05",
  },
  {
    href: "/tracking",
    title: "Tracking",
    sub: "Мониторинг",
    description: "Присутствие и активность сотрудников по зонам",
    icon: "◉",
    color: "#06b6d4",
    num: "06",
  },
  {
    href: "/procurement",
    title: "Procure",
    sub: "Закупки",
    description: "Калькуляция расходников по заказам для закупщика",
    icon: "⊡",
    color: "#a78bfa",
    num: "07",
  },
  {
    href: "/label-crop",
    title: "Labels",
    sub: "Этикетки",
    description: "Кадрирование этикеток маркировки из A4 в 60×40 мм",
    icon: "⬒",
    color: "#fb923c",
    num: "08",
  },
];

export default function PortalPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      setUser(d);
      if (d.role === "viewer") router.replace("/dashboard");
    });
  }, [router]);

  if (!user) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }} />
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'IBM Plex Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      <ThemeToggle />
      <button onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }} style={{
        position: "fixed", top: 20, right: 72, zIndex: 10,
        padding: "7px 14px", borderRadius: 8, border: "1px solid var(--line)",
        background: "transparent", color: "var(--muted)", fontSize: 12,
        fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer",
      }}>Выйти</button>

      {/* Gold accent line top */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, var(--gold) 30%, var(--gold) 70%, transparent)", zIndex: 10, opacity: 0.6 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "80px 40px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 16 }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700, fontSize: 48, letterSpacing: -2,
              textTransform: "uppercase", color: "var(--ink)", lineHeight: 1,
            }}>
              Turbo
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700, fontSize: 48, letterSpacing: -2,
              textTransform: "uppercase", color: "var(--gold)", lineHeight: 1,
            }}>
              ×
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ height: 1, width: 40, background: "var(--line)" }} />
            <div style={{ color: "var(--muted)", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Internal Portal
            </div>
          </div>
        </div>

        {/* Tools grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1 }}>
          {TOOLS.map((tool, i) => (
            <ToolCard key={tool.href} {...tool} index={i} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 80, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ height: 1, flex: 1, background: "var(--line)" }} />
          <div style={{ fontSize: 10, color: "var(--muted2)", letterSpacing: 3, textTransform: "uppercase" }}>
            Turbo Production Systems
          </div>
          <div style={{ height: 1, flex: 1, background: "var(--line)" }} />
        </div>
      </div>
    </div>
  );
}

function ToolCard({ href, title, sub, description, icon, color, num }) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--surface)" : "var(--surface2)",
        border: "1px solid var(--line)",
        borderTop: `1px solid ${hovered ? color : "var(--line)"}`,
        padding: "32px 32px 28px",
        cursor: "pointer",
        transition: "all 0.25s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Number watermark */}
      <div style={{
        position: "absolute", top: 16, right: 24,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, fontWeight: 700, color: hovered ? color + "33" : "var(--line2)",
        letterSpacing: 2, transition: "color 0.25s",
      }}>
        {num}
      </div>

      {/* Icon */}
      <div style={{
        fontSize: 22, marginBottom: 20, color: hovered ? color : "var(--muted2)",
        transition: "color 0.25s",
      }}>{icon}</div>

      {/* Title */}
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          color: "var(--ink)", fontWeight: 700, fontSize: 20,
          textTransform: "uppercase", letterSpacing: -0.5,
        }}>{title}</span>
      </div>

      {/* Sub label */}
      <div style={{
        color: "var(--muted2)", fontSize: 10, letterSpacing: 2,
        textTransform: "uppercase", fontWeight: 600, marginBottom: 14,
        transition: "color 0.25s",
      }}>
        {sub}
      </div>

      {/* Description */}
      <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{description}</div>

      {/* Accent line bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
        background: hovered ? `linear-gradient(90deg, ${color}40, transparent)` : "transparent",
        transition: "background 0.25s",
      }} />
    </div>
  );
}
