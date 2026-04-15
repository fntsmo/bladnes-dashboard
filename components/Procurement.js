"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import ThemeToggle from "./ThemeToggle";

const STAGES = ["Разработка","Изготовление образцов","Согласование образцов","Доставка материалов","В производстве","Упаковка","Ожидание оплаты","Отгружен"];
const UNITS = ["кг","м","шт","пог.м","компл.","упак.","л"];

function fmt(n) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n); }

export default function Procurement() {
  const [tab, setTab] = useState("procurement"); // "specs" | "procurement"
  const [specs, setSpecs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStages, setFilterStages] = useState(["Доставка материалов"]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [specRes, ordRes] = await Promise.all([
      supabase.from("procurement_specs").select("*, procurement_materials(*)").order("name"),
      supabase.from("orders").select("*").order("month"),
    ]);
    if (specRes.data) setSpecs(specRes.data);
    if (ordRes.data) setOrders(ordRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--ink)" }}>
      <ThemeToggle />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 28, letterSpacing: -1, textTransform: "uppercase" }}>
              Procure<span style={{ color: "var(--gold)" }}>×</span>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
              Калькуляция расходников
            </div>
          </div>
          <button onClick={() => window.location.href = "/"} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--muted)", fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer" }}>← Портал</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24 }}>
          {[["procurement", "📦 Закупки"], ["specs", "📋 Спецификации"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "10px 20px", border: "none", cursor: "pointer",
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600,
              background: tab === key ? "var(--surface)" : "var(--surface2)",
              color: tab === key ? "var(--gold)" : "var(--muted)",
              borderBottom: tab === key ? "2px solid var(--gold)" : "2px solid transparent",
              transition: "all .15s",
            }}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: 40, textAlign: "center" }}>Загрузка...</div>
        ) : tab === "specs" ? (
          <SpecsEditor specs={specs} onUpdate={loadData} />
        ) : (
          <ProcurementView specs={specs} orders={orders} filterStages={filterStages} setFilterStages={setFilterStages} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SPECS EDITOR — CRUD спецификаций
   ═══════════════════════════════════════════════════ */

function SpecsEditor({ specs, onUpdate }) {
  const [editing, setEditing] = useState(null); // null | spec object
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState([]);

  function startNew() {
    setEditing("new");
    setName("");
    setDescription("");
    setMaterials([{ material_name: "", supplier: "", unit: "кг", consumption: "", price: "" }]);
  }

  function startEdit(spec) {
    setEditing(spec);
    setName(spec.name);
    setDescription(spec.description || "");
    setMaterials(spec.procurement_materials?.length
      ? spec.procurement_materials.map(m => ({ ...m }))
      : [{ material_name: "", supplier: "", unit: "кг", consumption: "", price: "" }]
    );
  }

  function addMaterial() {
    setMaterials([...materials, { material_name: "", supplier: "", unit: "кг", consumption: "", price: "" }]);
  }

  function removeMaterial(i) {
    const arr = [...materials];
    arr.splice(i, 1);
    setMaterials(arr.length ? arr : [{ material_name: "", supplier: "", unit: "кг", consumption: "", price: "" }]);
  }

  function updateMaterial(i, field, value) {
    const arr = [...materials];
    arr[i] = { ...arr[i], [field]: value };
    setMaterials(arr);
  }

  async function save() {
    if (!name.trim()) return;
    const mats = materials.filter(m => m.material_name.trim()).map(m => ({
      material_name: m.material_name,
      supplier: m.supplier || "",
      unit: m.unit || "кг",
      consumption: parseFloat(m.consumption) || 0,
      price: parseFloat(m.price) || 0,
    }));

    if (editing === "new") {
      await fetch("/api/procurement/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, materials: mats }),
      });
    } else {
      await fetch("/api/procurement/specs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name, description, materials: mats }),
      });
    }
    setEditing(null);
    onUpdate();
  }

  async function deleteSpec(id) {
    if (!confirm("Удалить спецификацию?")) return;
    await fetch("/api/procurement/specs?id=" + id, { method: "DELETE" });
    onUpdate();
  }

  if (editing) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--ink)" }}>
          {editing === "new" ? "Новая спецификация" : "Редактирование"}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Название</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Футболка оверсайз 190 GSM" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Описание</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Кулирка, бирка, пакет" style={inputStyle} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
          Материалы
        </div>

        {materials.map((m, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 80px 80px 80px 28px", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <input value={m.material_name} onChange={e => updateMaterial(i, "material_name", e.target.value)} placeholder="Материал" style={inputSmStyle} />
            <input value={m.supplier} onChange={e => updateMaterial(i, "supplier", e.target.value)} placeholder="Поставщик" style={inputSmStyle} />
            <select value={m.unit} onChange={e => updateMaterial(i, "unit", e.target.value)} style={inputSmStyle}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" value={m.consumption} onChange={e => updateMaterial(i, "consumption", e.target.value)} placeholder="Расход" style={inputSmStyle} />
            <input type="number" value={m.price} onChange={e => updateMaterial(i, "price", e.target.value)} placeholder="Цена" style={inputSmStyle} />
            <button onClick={() => removeMaterial(i)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ))}

        <button onClick={addMaterial} style={addBtnStyle}>＋ Добавить материал</button>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={save} style={{ ...btnStyle, background: "var(--gold)", color: "#fff" }}>Сохранить</button>
          <button onClick={() => setEditing(null)} style={{ ...btnStyle, background: "var(--surface2)", color: "var(--muted)" }}>Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={startNew} style={{ ...btnStyle, background: "var(--gold)", color: "#fff", marginBottom: 16 }}>
        ＋ Новая спецификация
      </button>

      {!specs.length ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: 32, textAlign: "center", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" }}>
          Нет спецификаций. Создайте первую.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {specs.map(spec => (
            <div key={spec.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{spec.name}</div>
                  {spec.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{spec.description}</div>}
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                    {(spec.procurement_materials || []).map(m =>
                      `${m.material_name} (${m.consumption} ${m.unit})`
                    ).join(" · ") || "Нет материалов"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(spec)} style={smBtnStyle}>Изменить</button>
                  <button onClick={() => deleteSpec(spec.id)} style={{ ...smBtnStyle, borderColor: "#EF5350", color: "#EF5350" }}>Удалить</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PROCUREMENT VIEW — Сводная таблица для закупщика
   ═══════════════════════════════════════════════════ */

function ProcurementView({ specs, orders, filterStages, setFilterStages }) {
  // Only show orders that have a procurement_spec_id and match filter stages
  const linkedOrders = orders.filter(o =>
    o.procurement_spec_id && filterStages.includes(o.stage)
  );

  // Build per-order materials
  const orderMaterials = linkedOrders.map(o => {
    const spec = specs.find(s => s.id === o.procurement_spec_id);
    if (!spec) return null;
    return {
      order: o,
      spec,
      materials: (spec.procurement_materials || []).map(m => ({
        ...m,
        total: (m.consumption || 0) * (o.qty || 0),
        totalPrice: (m.consumption || 0) * (o.qty || 0) * (m.price || 0),
      })),
    };
  }).filter(Boolean);

  // Consolidated by supplier + material
  const consolidated = {};
  orderMaterials.forEach(om => {
    om.materials.forEach(m => {
      const key = `${m.supplier || "Без поставщика"}|||${m.material_name}|||${m.unit}`;
      if (!consolidated[key]) {
        consolidated[key] = { supplier: m.supplier || "Без поставщика", material_name: m.material_name, unit: m.unit, total: 0, totalPrice: 0, price: m.price, orders: [] };
      }
      consolidated[key].total += m.total;
      consolidated[key].totalPrice += m.totalPrice;
      consolidated[key].orders.push({ product: om.order.product, qty: om.order.qty, amount: m.total });
    });
  });

  // Group by supplier
  const bySupplier = {};
  Object.values(consolidated).forEach(c => {
    if (!bySupplier[c.supplier]) bySupplier[c.supplier] = [];
    bySupplier[c.supplier].push(c);
  });

  function toggleStage(s) {
    setFilterStages(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  return (
    <div>
      {/* Stage filter */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          Фильтр по этапам
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STAGES.map(s => (
            <button key={s} onClick={() => toggleStage(s)} style={{
              padding: "6px 14px", border: "1px solid var(--line)", borderRadius: 20,
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s",
              fontFamily: "'IBM Plex Sans', sans-serif",
              background: filterStages.includes(s) ? "rgba(167,139,250,.15)" : "var(--surface2)",
              color: filterStages.includes(s) ? "#a78bfa" : "var(--muted)",
              borderColor: filterStages.includes(s) ? "#a78bfa" : "var(--line)",
            }}>{s}</button>
          ))}
        </div>
      </div>

      {!linkedOrders.length ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: 32, textAlign: "center", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--line)" }}>
          Нет заказов с привязанными спецификациями на выбранных этапах.
          <br /><span style={{ fontSize: 11, marginTop: 6, display: "inline-block" }}>Привяжите спецификацию к заказу в дашборде.</span>
        </div>
      ) : (
        <>
          {/* Per-order breakdown */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            По заказам ({linkedOrders.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {orderMaterials.map((om, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{om.order.product}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{om.order.qty} шт</span>
                    <span style={{ fontSize: 11, color: "#a78bfa", marginLeft: 8 }}>{om.spec.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{om.order.order_id}</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      <th style={thStyle}>Материал</th>
                      <th style={thStyle}>Поставщик</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Расход/ед.</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Итого</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {om.materials.map((m, j) => (
                      <tr key={j} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={tdStyle}>{m.material_name}</td>
                        <td style={{ ...tdStyle, color: "var(--muted)" }}>{m.supplier || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>{m.consumption} {m.unit}</td>
                        <td style={{ ...tdStyle, textAlign: "center", fontWeight: 600 }}>{fmt(m.total)} {m.unit}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: "var(--gold)" }}>{m.price ? fmt(m.totalPrice) + " ₽" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Consolidated by supplier */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            Сводная по поставщикам
          </div>
          {Object.entries(bySupplier).map(([supplier, items]) => (
            <div key={supplier} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>📦 {supplier}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <th style={thStyle}>Материал</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Кол-во</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Цена/ед.</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Сумма</th>
                    <th style={thStyle}>Заказы</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, j) => (
                    <tr key={j} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={tdStyle}>{item.material_name}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{fmt(item.total)} {item.unit}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "var(--muted)" }}>{item.price ? fmt(item.price) + " ₽" : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>{item.totalPrice ? fmt(item.totalPrice) + " ₽" : "—"}</td>
                      <td style={{ ...tdStyle, fontSize: 10, color: "var(--muted)" }}>
                        {item.orders.map(o => `${o.product} (${fmt(o.amount)} ${item.unit})`).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>Итого</td>
                    <td colSpan={2} />
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>
                      {fmt(items.reduce((s, it) => s + it.totalPrice, 0))} ₽
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Shared styles ── */
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, marginBottom: 4 };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, borderRadius: 8, outline: "none" };
const inputSmStyle = { padding: "7px 8px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, borderRadius: 6, outline: "none", boxSizing: "border-box" };
const btnStyle = { padding: "9px 18px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, fontWeight: 600, transition: "all .15s" };
const smBtnStyle = { padding: "5px 12px", border: "1px solid var(--line)", borderRadius: 6, background: "none", cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--muted)", transition: "all .15s" };
const addBtnStyle = { background: "none", border: "1px dashed var(--line)", borderRadius: 8, padding: "8px 16px", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif", width: "100%", marginTop: 6 };
const thStyle = { padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase" };
const tdStyle = { padding: "8px 8px", color: "var(--ink)" };
