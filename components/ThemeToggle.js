"use client";
import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = localStorage.getItem("turbo-theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("turbo-theme", next);
    document.documentElement.setAttribute("data-theme", next === "light" ? "light" : "");
  };
  return (
    <button onClick={toggle} style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 100,
      width: 44, height: 44, borderRadius: "50%",
      background: "var(--surface)", border: "1px solid var(--line2)",
      color: "var(--muted)", fontSize: 18, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)", transition: "all 0.2s",
    }}
    title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
