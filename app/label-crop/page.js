"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import ThemeToggle from "../../components/ThemeToggle";

const MM_TO_PT = 72 / 25.4;
const TARGET_W = 60 * MM_TO_PT;
const TARGET_H = 40 * MM_TO_PT;

export default function LabelCropPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback(async (f) => {
    setError(null);
    setResult(null);
    if (!f || !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Нужен PDF файл");
      return;
    }
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      setPageCount(pdf.getPageCount());
    } catch (e) {
      setError("Не удалось прочитать PDF: " + e.message);
      setFile(null);
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const cropPdf = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = pdf.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();

        // Этикетка всегда в верхнем левом углу A4.
        // Центр содержимого: ~104pt по X, ~81pt от верха страницы.
        // Кроп центрируется вокруг содержимого.
        const contentCenterX = 104;
        const contentCenterY = height - 81;
        const cropX = contentCenterX - TARGET_W / 2;
        const cropY = contentCenterY - TARGET_H / 2;

        page.setCropBox(cropX, cropY, TARGET_W, TARGET_H);
        page.setMediaBox(cropX, cropY, TARGET_W, TARGET_H);
      }

      const out = await pdf.save();
      const blob = new Blob([out], { type: "application/pdf" });
      setResult(URL.createObjectURL(blob));
      setProcessing(false);
    } catch (e) {
      setError("Ошибка обработки: " + e.message);
      setProcessing(false);
    }
  }, [file]);

  const download = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    const name = file?.name?.replace(/\.pdf$/i, "") || "labels";
    a.download = name + "_60x40.pdf";
    a.click();
  }, [result, file]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'IBM Plex Sans', sans-serif",
      position: "relative",
    }}>
      <ThemeToggle />

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, var(--gold) 30%, var(--gold) 70%, transparent)", zIndex: 10, opacity: 0.6 }} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 40px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "transparent", border: "none", color: "var(--muted)",
              fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 24,
              fontFamily: "'IBM Plex Sans', sans-serif", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>&larr;</span> Dashboard
          </button>

          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 700, fontSize: 32, letterSpacing: -1,
            textTransform: "uppercase", color: "var(--ink)", lineHeight: 1, marginBottom: 12,
          }}>
            Labels
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Кадрирование этикеток из A4 в формат 60&times;40 мм
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--gold)" : "var(--line)"}`,
            borderRadius: 12,
            padding: "48px 32px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "var(--surface)" : "transparent",
            transition: "all 0.2s",
            marginBottom: 24,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div style={{ fontSize: 36, color: "var(--muted2)", marginBottom: 16 }}>
            {file ? "◩" : "◫"}
          </div>
          {file ? (
            <>
              <div style={{ color: "var(--ink)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {file.name}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {pageCount} {pageCount === 1 ? "страница" : pageCount < 5 ? "страницы" : "страниц"} &middot; {(file.size / 1024).toFixed(0)} KB
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "var(--ink)", fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                Перетащите PDF или нажмите для выбора
              </div>
              <div style={{ color: "var(--muted2)", fontSize: 12 }}>
                Файл обрабатывается локально в браузере
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "var(--red)15", border: "1px solid var(--red)40",
            borderRadius: 8, padding: "12px 16px", marginBottom: 24,
            color: "var(--red)", fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        {file && !result && (
          <button
            onClick={cropPdf}
            disabled={processing}
            style={{
              width: "100%", padding: "14px 24px",
              background: processing ? "var(--surface)" : "var(--gold)",
              color: processing ? "var(--muted)" : "#000",
              border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              fontFamily: "'IBM Plex Sans', sans-serif",
              cursor: processing ? "wait" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {processing ? "Обработка..." : `Обрезать ${pageCount} стр. до 60×40 мм`}
          </button>
        )}

        {result && (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={download}
              style={{
                flex: 1, padding: "14px 24px",
                background: "var(--gold)", color: "#000",
                border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                fontFamily: "'IBM Plex Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              Скачать PDF
            </button>
            <button
              onClick={() => { setFile(null); setResult(null); setPageCount(0); if(fileRef.current) fileRef.current.value = ""; }}
              style={{
                padding: "14px 24px",
                background: "var(--surface)", color: "var(--ink)",
                border: "1px solid var(--line)", borderRadius: 8,
                fontSize: 14, fontWeight: 500,
                fontFamily: "'IBM Plex Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              Новый файл
            </button>
          </div>
        )}

        {/* Info */}
        <div style={{
          marginTop: 48, padding: "20px 24px",
          background: "var(--surface2)", borderRadius: 8,
          border: "1px solid var(--line)",
        }}>
          <div style={{ color: "var(--muted2)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
            Как это работает
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
            PDF с этикетками маркировки (Честный Знак) приходит в формате A4 &mdash;
            одна этикетка на странице в левом верхнем углу. Инструмент обрезает каждую
            страницу до 60&times;40 мм, оставляя только этикетку с DataMatrix-кодом.
          </div>
        </div>
      </div>
    </div>
  );
}
