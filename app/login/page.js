"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#18181C", fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#1E1E24", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: "40px 48px", display: "flex", flexDirection: "column", gap: 20, minWidth: 320,
      }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <span style={{ color: "#C9A96E", fontWeight: 700, fontSize: 22, letterSpacing: 2, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>Turbo</span>
          </div>
          <div style={{ color: "#7A7880", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
            Production Dashboard
          </div>
        </div>

        <input
          type="password"
          placeholder="Пароль доступа"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            background: "#141418", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "12px 16px", color: "#E8E6E1",
            fontSize: 14, fontFamily: "inherit", outline: "none",
          }}
        />

        {error && (
          <div style={{ color: "#FF6B6B", fontSize: 13, textAlign: "center" }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            background: loading || !password ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
            padding: "12px 16px", color: loading || !password ? "#7A7880" : "#E8E6E1",
            fontSize: 14, fontFamily: "inherit", cursor: loading || !password ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
