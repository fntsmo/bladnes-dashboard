"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const inputSt = {
  background: "var(--surface2, #141418)", border: "1px solid var(--line2, var(--line2))", borderRadius: 8,
  padding: "10px 14px", color: "var(--ink, #E8E6E1)", fontSize: 13,
  fontFamily: "'IBM Plex Sans', sans-serif", outline: "none", width: "100%", boxSizing: "border-box",
};
const labelSt = { fontSize: 11, color: "var(--muted, #7A7880)", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 5 };
const btnBase = { borderRadius: 8, padding: "10px 20px", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer", border: "none", fontWeight: 600 };

export default function SpecModal({ order, onClose }) {
  const [contracts, setContracts] = useState([]);
  const [existing, setExisting] = useState(null);
  const [selectedContract, setSelectedContract] = useState("");
  const [deliveryDays, setDeliveryDays] = useState(30);
  const [deliveryNote, setDeliveryNote] = useState("после 100% оплаты");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddContract, setShowAddContract] = useState(false);
  const [newContract, setNewContract] = useState({ number: "", date: new Date().toISOString().slice(0,10), counterparty: "", requisites: "" });

  useEffect(() => {
    // Загрузить договоры
    fetch("/api/contracts").then(r => r.json()).then(data => {
      const clientContracts = data.filter(c => c.client_id === order.clientId || !order.clientId);
      setContracts(clientContracts);
      if (clientContracts.length > 0) setSelectedContract(clientContracts[0].id);
    });
    // Проверить есть ли уже спецификация
    fetch(`/api/specifications?order_uid=${order.uid}`).then(r => r.json()).then(data => {
      if (data && data.length > 0) setExisting(data[0]);
    });
  }, [order]);

  async function handleFileUpload(e) {
    const picked = Array.from(e.target.files);
    setUploading(true);
    const uploaded = [];
    for (const file of picked) {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("spec-files").upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("spec-files").getPublicUrl(path);
        uploaded.push({ file_name: file.name, file_url: publicUrl || path, path });
      }
    }
    setFiles(prev => [...prev, ...uploaded]);
    setUploading(false);
  }

  async function handleSaveContract() {
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newContract, client_id: order.clientId || "bladnes" }),
    });
    const c = await res.json();
    setContracts(prev => [c, ...prev]);
    setSelectedContract(c.id);
    setShowAddContract(false);
    setNewContract({ number: "", date: new Date().toISOString().slice(0,10), counterparty: "", requisites: "" });
  }

  async function handleCreate() {
    if (!selectedContract) return;
    setSaving(true);
    const res = await fetch("/api/specifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: selectedContract,
        order_uid: order.uid,
        delivery_days: deliveryDays,
        delivery_note: deliveryNote,
      }),
    });
    const spec = await res.json();
    // Прикрепить файлы
    for (const f of files) {
      await supabase.from("spec_files").insert({ spec_id: spec.id, file_name: f.file_name, file_url: f.file_url });
    }
    setExisting(spec);
    setSaving(false);
  }

  async function handleDownload() {
    const specId = existing?.id;
    if (!specId) return;
    window.open(`/api/specifications/pdf?id=${specId}`, "_blank");
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--line2)", borderRadius: 14,
        padding: 32, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--ink)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Спецификация</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Заказ: {order.id} · {order.product}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        {existing ? (
          /* Уже создана */
          <div>
            <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ color: "#34d399", fontWeight: 700, marginBottom: 4 }}>
                Спецификация № {existing.number} создана
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Договор № {existing.contracts?.number} от {existing.contracts?.date ? new Date(existing.contracts.date).toLocaleDateString("ru-RU") : "—"}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                Срок: {existing.delivery_days} р.д. {existing.delivery_note}
              </div>
            </div>
            <button onClick={handleDownload} style={{ ...btnBase, background: "#C9A96E", color: "#0E0E10", width: "100%" }}>
              ↓ Скачать PDF
            </button>
          </div>
        ) : (
          /* Форма создания */
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Договор */}
            <div>
              <label style={labelSt}>Договор</label>
              {contracts.length > 0 ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={selectedContract} onChange={e => setSelectedContract(e.target.value)}
                    style={{ ...inputSt, flex: 1 }}>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        № {c.number} от {new Date(c.date).toLocaleDateString("ru-RU")} · {c.counterparty}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setShowAddContract(!showAddContract)}
                    style={{ ...btnBase, background: "var(--surface2)", color: "var(--ink)", padding: "10px 14px", border: "1px solid var(--line2)" }}>
                    +
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAddContract(true)}
                  style={{ ...btnBase, background: "rgba(201,169,110,0.1)", color: "#C9A96E", border: "1px solid rgba(201,169,110,0.2)", width: "100%", marginTop: 6 }}>
                  + Добавить договор
                </button>
              )}
            </div>

            {/* Форма нового договора */}
            {showAddContract && (
              <div style={{ background: "var(--surface2)", border: "1px solid var(--line2)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A96E", marginBottom: 4 }}>Новый договор</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={labelSt}>Номер</label>
                    <input value={newContract.number} onChange={e => setNewContract(p => ({...p, number: e.target.value}))} style={inputSt} placeholder="12/2024" />
                  </div>
                  <div>
                    <label style={labelSt}>Дата</label>
                    <input type="date" value={newContract.date} onChange={e => setNewContract(p => ({...p, date: e.target.value}))} style={{ ...inputSt, colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label style={labelSt}>Контрагент</label>
                  <input value={newContract.counterparty} onChange={e => setNewContract(p => ({...p, counterparty: e.target.value}))} style={inputSt} placeholder="ООО Bladnes" />
                </div>
                <div>
                  <label style={labelSt}>Реквизиты контрагента</label>
                  <textarea value={newContract.requisites} onChange={e => setNewContract(p => ({...p, requisites: e.target.value}))} style={{ ...inputSt, height: 72, resize: "vertical" }} placeholder="ИНН, р/с, банк..." />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowAddContract(false)} style={{ ...btnBase, flex: 1, background: "var(--surface2)", color: "var(--muted)" }}>Отмена</button>
                  <button onClick={handleSaveContract} disabled={!newContract.number || !newContract.counterparty}
                    style={{ ...btnBase, flex: 1, background: "#C9A96E", color: "#0E0E10" }}>Сохранить</button>
                </div>
              </div>
            )}

            {/* Условия доставки */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div>
                <label style={labelSt}>Срок (р.д.)</label>
                <input type="number" value={deliveryDays} onChange={e => setDeliveryDays(Number(e.target.value))} style={inputSt} min={1} />
              </div>
              <div>
                <label style={labelSt}>Условие</label>
                <input value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} style={inputSt} placeholder="после 100% оплаты" />
              </div>
            </div>

            {/* Файлы */}
            <div>
              <label style={labelSt}>Прикрепить файлы (техзадание, чертежи)</label>
              <label style={{
                display: "block", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 8,
                padding: "14px", textAlign: "center", cursor: "pointer", color: "var(--muted)", fontSize: 12,
              }}>
                {uploading ? "Загрузка..." : "Нажмите для выбора файлов (JPG, PNG, PDF)"}
                <input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: "none" }} />
              </label>
              {files.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>✓</span> {f.file_name}
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", marginLeft: "auto" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Кнопки */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={onClose} style={{ ...btnBase, flex: 1, background: "var(--surface2)", color: "var(--muted)" }}>Отмена</button>
              <button onClick={handleCreate} disabled={saving || !selectedContract}
                style={{ ...btnBase, flex: 2, background: saving ? "rgba(201,169,110,0.4)" : "#C9A96E", color: "#0E0E10" }}>
                {saving ? "Создание..." : "Создать спецификацию"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
