"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "../lib/supabase";

const STAGES = ["Разработка","Изготовление образцов","Согласование образцов","Доставка материалов","В производстве","Упаковка","Отгружен"];
const STAGE_COLORS = {
  "Разработка":              { bg:"rgba(255,179,0,0.1)",  text:"#FFB300", dot:"#FFB300" },
  "Изготовление образцов":   { bg:"rgba(66,165,245,0.1)", text:"#64B5F6", dot:"#42A5F5" },
  "Согласование образцов":   { bg:"rgba(0,191,165,0.1)",  text:"#4DD0B8", dot:"#26A69A" },
  "Доставка материалов":     { bg:"rgba(255,138,101,0.1)", text:"#FF8A65", dot:"#FF7043" },
  "В производстве":          { bg:"rgba(171,71,188,0.1)", text:"#CE93D8", dot:"#AB47BC" },
  "Упаковка":                { bg:"rgba(102,187,106,0.1)", text:"#81C784", dot:"#66BB6A" },
  "Отгружен":                { bg:"rgba(141,110,99,0.15)", text:"#BCAAA4", dot:"#8D6E63" },
};
const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmt(n) { return new Intl.NumberFormat("ru-RU").format(n); }
function fmtMoney(n) { return fmt(n) + " ₽"; }
function fmtDate(d) { if (!d) return "—"; const [y,m,day] = d.split("-"); return `${day}.${m}.${y}`; }
function monthLabel(key) { const [y,m] = key.split("-"); return `${MONTHS_RU[parseInt(m)-1]} ${y}`; }
function monthShort(key) { const [,m] = key.split("-"); return MONTHS_RU[parseInt(m)-1].slice(0,3); }
function stageIdx(s) { return STAGES.indexOf(s); }

/* ── DB helpers ── */
function rowToOrder(r) {
  return { uid:r.uid, id:r.order_id, invoice:r.invoice, product:r.product, amount:r.amount, qty:r.qty, launchDate:r.launch_date, dueDate:r.due_date, stage:r.stage, shipDate:r.ship_date||"", payPercent:r.pay_percent, month:r.month, comment:r.comment||"" };
}
function orderToRow(o) {
  return { order_id:o.id, invoice:o.invoice, product:o.product, amount:o.amount, qty:o.qty, launch_date:o.launchDate, due_date:o.dueDate, stage:o.stage, ship_date:o.shipDate||null, pay_percent:o.payPercent, month:o.month, comment:o.comment||"" };
}

/* ── Stage Progress Bar ── */
function StageBar({ stage }) {
  const idx = stageIdx(stage); const total = STAGES.length;
  const pct = ((idx+1)/total)*100;
  const c = STAGE_COLORS[stage]||{dot:"#888"};
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:110 }}>
      <div style={{ flex:1, height:5, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", borderRadius:3, background:c.dot, transition:"width 0.4s ease" }} />
      </div>
      <span style={{ fontSize:10, color:"#7A7880", whiteSpace:"nowrap", minWidth:28, textAlign:"right" }}>{idx+1}/{total}</span>
    </div>
  );
}

/* ── Inline Stage Picker ── */
function StagePicker({ stage, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const c = STAGE_COLORS[stage]||{ bg:"rgba(255,255,255,0.05)", text:"#888", dot:"#666" };
  return (
    <div ref={ref} style={{ position:"relative", display:"inline-block" }}>
      <span onClick={e => { e.stopPropagation(); setOpen(!open); }} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:20, background:c.bg, color:c.text, fontSize:11, fontWeight:600, letterSpacing:0.3, whiteSpace:"nowrap", border:`1px solid ${c.dot}33`, cursor:"pointer" }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:c.dot, flexShrink:0 }} />
        {stage}
        <span style={{ fontSize:9, marginLeft:2, opacity:0.6 }}>▾</span>
      </span>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:100, background:"#2A2A32", borderRadius:12, padding:6, border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 12px 40px rgba(0,0,0,0.5)", minWidth:210 }}>
          {STAGES.map(s => {
            const sc = STAGE_COLORS[s]; const active = s === stage;
            return (
              <button key={s} onClick={e => { e.stopPropagation(); onChange(s); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 12px", borderRadius:8, border:"none", background: active ? sc.bg : "transparent", color: active ? sc.text : "#A0A0A6", fontSize:12, fontWeight: active ? 700 : 500, cursor:"pointer", textAlign:"left", fontFamily:"'IBM Plex Sans', sans-serif" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width:6, height:6, borderRadius:"50%", background:sc.dot, flexShrink:0 }} />
                {s}
                {active && <span style={{ marginLeft:"auto", fontSize:11 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputDark = { width:"100%", padding:"10px 14px", borderRadius:8, border:"1px solid rgba(255,255,255,0.14)", fontSize:14, fontFamily:"'IBM Plex Sans', sans-serif", background:"#222228", color:"#E8E6E1", outline:"none", boxSizing:"border-box", marginBottom:16 };
const labelSt = { display:"block", fontSize:10, fontWeight:700, letterSpacing:2, color:"#8A8890", textTransform:"uppercase", marginBottom:6 };
const btnBase = { padding:"12px 0", borderRadius:8, border:"none", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.2s", fontFamily:"'IBM Plex Sans', sans-serif", letterSpacing:0.5 };

/* ── Edit Modal ── */
function EditModal({ order, onSave, onClose }) {
  const [form, setForm] = useState({ id:order.id, invoice:order.invoice, product:order.product, amount:order.amount, qty:order.qty, stage:order.stage, shipDate:order.shipDate||"", payPercent:order.payPercent, comment:order.comment||"" });
  const upd = (k,v) => setForm(p => ({ ...p, [k]:v }));
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)" }}>
      <div style={{ background:"#1C1C22", borderRadius:16, padding:"32px 36px", width:480, maxWidth:"92vw", boxShadow:"0 32px 80px rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)", fontFamily:"'IBM Plex Sans', sans-serif", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:3, color:"#C9A96E", textTransform:"uppercase", marginBottom:20 }}>Редактирование заказа</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <div><label style={labelSt}>Номер заказа</label><input value={form.id} onChange={e => upd("id",e.target.value)} style={inputDark} /></div>
          <div><label style={labelSt}>Номер счёта</label><input value={form.invoice} onChange={e => upd("invoice",e.target.value)} style={inputDark} /></div>
        </div>
        <label style={labelSt}>Изделие</label>
        <input value={form.product} onChange={e => upd("product",e.target.value)} style={inputDark} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <div><label style={labelSt}>Сумма (₽)</label><input type="number" value={form.amount} onChange={e => upd("amount",Number(e.target.value))} style={inputDark} /></div>
          <div><label style={labelSt}>Кол-во изделий</label><input type="number" value={form.qty} onChange={e => upd("qty",Number(e.target.value))} style={inputDark} /></div>
        </div>
        <label style={labelSt}>Оплата: {form.payPercent}%</label>
        <input type="range" min={0} max={100} step={5} value={form.payPercent} onChange={e => upd("payPercent",Number(e.target.value))} style={{ width:"100%", accentColor:"#C9A96E", marginBottom:20 }} />
        <label style={labelSt}>Стадия</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
          {STAGES.map(s => { const active = form.stage===s; const c = STAGE_COLORS[s]; return (
            <button key={s} onClick={() => upd("stage",s)} style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${active?c.dot:"rgba(255,255,255,0.08)"}`, background:active?c.bg:"transparent", color:active?c.text:"#8A8890", fontSize:11, fontWeight:600, cursor:"pointer" }}>{s}</button>
          ); })}
        </div>
        {form.stage === "Отгружен" && (<><label style={labelSt}>Дата отгрузки</label><input type="date" value={form.shipDate} onChange={e => upd("shipDate",e.target.value)} style={{ ...inputDark, colorScheme:"dark" }} /></>)}
        <label style={labelSt}>Комментарий</label>
        <textarea value={form.comment} onChange={e => upd("comment",e.target.value)} placeholder="Комментарий к заказу..." rows={3} style={{ ...inputDark, resize:"vertical", minHeight:60, lineHeight:1.5 }} />
        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={onClose} style={{ ...btnBase, flex:1, background:"rgba(255,255,255,0.1)", color:"#A0A0A6" }}>Отмена</button>
          <button onClick={() => onSave({ ...order, id:form.id, invoice:form.invoice, product:form.product, amount:form.amount, qty:form.qty, stage:form.stage, shipDate:form.stage==="Отгружен"?form.shipDate:"", payPercent:form.payPercent, comment:form.comment })} style={{ ...btnBase, flex:1, background:"#C9A96E", color:"#0E0E10" }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Month Modal ── */
function AddMonthModal({ existingMonths, onAdd, onClose }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const key = `${year}-${String(month+1).padStart(2,"0")}`;
  const exists = existingMonths.has(key);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#1C1C22", borderRadius:16, padding:"32px 36px", width:400, maxWidth:"92vw", boxShadow:"0 32px 80px rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)", fontFamily:"'IBM Plex Sans', sans-serif" }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:3, color:"#C9A96E", textTransform:"uppercase", marginBottom:20 }}>Новый месяц</div>
        <label style={labelSt}>Год</label>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => (
            <button key={y} onClick={() => setYear(y)} style={{ padding:"8px 18px", borderRadius:8, border:`1.5px solid ${year===y?"#C9A96E":"rgba(255,255,255,0.08)"}`, background:year===y?"rgba(201,169,110,0.1)":"transparent", color:year===y?"#C9A96E":"#8A8890", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'IBM Plex Mono', monospace" }}>{y}</button>
          ))}
        </div>
        <label style={labelSt}>Месяц</label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:20 }}>
          {MONTHS_RU.map((m,i) => { const mKey = `${year}-${String(i+1).padStart(2,"0")}`; const taken = existingMonths.has(mKey); const active = month===i; return (
            <button key={i} onClick={() => !taken && setMonth(i)} style={{ padding:"8px 4px", borderRadius:8, border:`1.5px solid ${active&&!taken?"#C9A96E":"rgba(255,255,255,0.06)"}`, background:taken?"rgba(255,255,255,0.02)":active?"rgba(201,169,110,0.1)":"transparent", color:taken?"#3E3C42":active?"#C9A96E":"#8A8890", fontSize:11, fontWeight:600, cursor:taken?"not-allowed":"pointer", fontFamily:"'IBM Plex Sans', sans-serif" }}>{m.slice(0,3)}</button>
          ); })}
        </div>
        {exists && <div style={{ fontSize:11, color:"#EF5350", marginBottom:12 }}>Этот месяц уже существует</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ ...btnBase, flex:1, background:"rgba(255,255,255,0.1)", color:"#A0A0A6" }}>Отмена</button>
          <button disabled={exists} onClick={() => { onAdd(key); onClose(); }} style={{ ...btnBase, flex:1, background:exists?"#3E3C42":"#C9A96E", color:exists?"#6B6870":"#0E0E10", cursor:exists?"not-allowed":"pointer" }}>Добавить</button>
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#2A2A32", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"12px 16px", fontFamily:"'IBM Plex Sans', sans-serif", fontSize:12 }}>
      <div style={{ fontWeight:700, color:"#E8E6E1", marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:p.color }} />
          <span style={{ color:"#A0A0A6" }}>{p.name}:</span>
          <span style={{ color:"#E8E6E1", fontWeight:600 }}>{p.name.includes("Сумма") ? fmtMoney(p.value) : fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════ DASHBOARD ══════════════════════════ */
export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [search, setSearch] = useState("");
  const [addingMonth, setAddingMonth] = useState(false);
  const [emptyMonths, setEmptyMonths] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  /* ── Load orders from Supabase on mount ── */
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("orders").select("*").order("month", { ascending: false });
      if (error) { console.error("Supabase load error:", error); }
      else { setOrders(data.map(rowToOrder)); }
      setLoading(false);
    }
    load();
  }, []);

  /* ── Save order to Supabase (update by uid) ── */
  const handleSave = useCallback(async (updated) => {
    const row = orderToRow(updated);
    const { error } = await supabase.from("orders").update(row).eq("uid", updated.uid);
    if (error) { console.error("Save error:", error); return; }
    setOrders(prev => prev.map(o => o.uid === updated.uid ? updated : o));
    setEditing(null);
  }, []);

  /* ── Change stage inline ── */
  const changeStage = useCallback(async (uid, newStage) => {
    const shipDate = newStage !== "Отгружен" ? null : undefined;
    const upd = shipDate === null ? { stage: newStage, ship_date: null } : { stage: newStage };
    const { error } = await supabase.from("orders").update(upd).eq("uid", uid);
    if (error) { console.error("Stage update error:", error); return; }
    setOrders(prev => prev.map(o => o.uid === uid ? { ...o, stage: newStage, shipDate: newStage !== "Отгружен" ? "" : o.shipDate } : o));
  }, []);

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q ? orders.filter(o =>
      o.id.toLowerCase().includes(q) || o.invoice.toLowerCase().includes(q) ||
      o.product.toLowerCase().includes(q) || o.launchDate.includes(q) || o.dueDate.includes(q) ||
      fmtDate(o.launchDate).includes(q) || fmtDate(o.dueDate).includes(q) ||
      (o.shipDate && fmtDate(o.shipDate).includes(q))
    ) : orders;
    const map = {};
    filtered.forEach(o => { if (!map[o.month]) map[o.month]=[]; map[o.month].push(o); });
    emptyMonths.forEach(m => { if (!map[m]) map[m]=[]; });
    return Object.entries(map).sort(([a],[b]) => b.localeCompare(a));
  }, [orders, search, emptyMonths]);

  const existingMonthSet = useMemo(() => {
    const set = new Set();
    orders.forEach(o => set.add(o.month));
    emptyMonths.forEach(m => set.add(m));
    return set;
  }, [orders, emptyMonths]);

  const chartData = useMemo(() => {
    const map = {};
    const today = new Date().toISOString().slice(0,10);
    orders.forEach(o => {
      if (!map[o.month]) map[o.month] = { amount:0, qty:0, onTime:0, overdue:0 };
      const d = map[o.month];
      d.amount += o.amount; d.qty += o.qty;
      if (o.stage === "Отгружен" && o.shipDate) { if (o.shipDate <= o.dueDate) d.onTime++; else d.overdue++; }
      else if (o.stage !== "Отгружен" && o.dueDate < today) { d.overdue++; }
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([m,d]) => ({ name:monthShort(m), ...d }));
  }, [orders]);

  const handleAddMonth = useCallback((monthKey) => {
    if (!existingMonthSet.has(monthKey)) setEmptyMonths(prev => [...prev, monthKey]);
  }, [existingMonthSet]);

  const toggle = (m) => setCollapsed(p => ({ ...p, [m]:!p[m] }));

  if (loading) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#18181C", color:"#7A7880", fontSize:14 }}>Загрузка данных...</div>;

  return (
    <div style={{ minHeight:"100vh", background:"#18181C", fontFamily:"'IBM Plex Sans', sans-serif", color:"#E8E6E1", padding:"0 0 60px" }}>
      {/* Header */}
      <div style={{ background:"#1E1E24", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"24px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
          <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:26, fontWeight:700, color:"#FFFFFF", letterSpacing:-1, textTransform:"uppercase" }}>Bladnes</span>
          <span style={{ color:"#C9A96E", fontSize:20, fontWeight:300 }}>×</span>
          <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:26, fontWeight:700, color:"#C9A96E", letterSpacing:-1, textTransform:"uppercase" }}>Turbo</span>
        </div>
        <div style={{ fontSize:10, color:"#7A7880", letterSpacing:2, textTransform:"uppercase", fontWeight:600 }}>Production Dashboard</div>
      </div>

      {/* Chart */}
      <div style={{ padding:"24px 40px 0", maxWidth:1440, margin:"0 auto" }}>
        <div style={{ background:"#222228", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)", padding:"24px 24px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#7A7880", textTransform:"uppercase", marginBottom:16 }}>Динамика заказов по месяцам</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <div>
              <div style={{ fontSize:11, color:"#8A8890", marginBottom:8, fontWeight:600 }}>Сумма заказов и количество изделий</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill:"#7A7880", fontSize:11 }} axisLine={{ stroke:"rgba(255,255,255,0.06)" }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill:"#7A7880", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => v>=1000?(v/1000)+"к":v} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill:"#7A7880", fontSize:10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, color:"#A0A0A6" }} />
                  <Line yAxisId="left" type="monotone" dataKey="amount" name="Сумма (₽)" stroke="#C9A96E" strokeWidth={2.5} dot={{ fill:"#C9A96E", r:4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="qty" name="Кол-во изделий" stroke="#64B5F6" strokeWidth={2} dot={{ fill:"#64B5F6", r:3.5 }} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#8A8890", marginBottom:8, fontWeight:600 }}>Сдача заказов: в срок / просрочено</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill:"#7A7880", fontSize:11 }} axisLine={{ stroke:"rgba(255,255,255,0.06)" }} tickLine={false} />
                  <YAxis tick={{ fill:"#7A7880", fontSize:10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, color:"#A0A0A6" }} />
                  <Line type="monotone" dataKey="onTime" name="В срок" stroke="#66BB6A" strokeWidth={2.5} dot={{ fill:"#66BB6A", r:4 }} />
                  <Line type="monotone" dataKey="overdue" name="Просрочено" stroke="#EF5350" strokeWidth={2.5} dot={{ fill:"#EF5350", r:4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Add Month */}
      <div style={{ padding:"20px 40px 0", maxWidth:1440, margin:"0 auto", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:240, maxWidth:420 }}>
          <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, color:"#6B6870", pointerEvents:"none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по заказам, изделиям, датам..."
            style={{ width:"100%", padding:"11px 14px 11px 38px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", fontSize:13, fontFamily:"'IBM Plex Sans', sans-serif", background:"#222228", color:"#E8E6E1", outline:"none", boxSizing:"border-box" }}
            onFocus={e => e.target.style.borderColor="#C9A96E"} onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.1)"} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:6, width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", color:"#A0A0A6", fontSize:12, cursor:"pointer" }}>✕</button>}
        </div>
        <button onClick={() => setAddingMonth(true)} style={{ padding:"10px 20px", borderRadius:10, border:"1.5px solid rgba(201,169,110,0.3)", background:"rgba(201,169,110,0.08)", color:"#C9A96E", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'IBM Plex Sans', sans-serif", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}
          onMouseEnter={e => e.currentTarget.style.background="rgba(201,169,110,0.15)"} onMouseLeave={e => e.currentTarget.style.background="rgba(201,169,110,0.08)"}>
          <span style={{ fontSize:16, lineHeight:1 }}>+</span> Новый месяц
        </button>
        {search && <div style={{ fontSize:11, color:"#7A7880", width:"100%" }}>Найдено: {grouped.reduce((s,[,it]) => s+it.length, 0)} заказов</div>}
      </div>

      {/* Monthly groups */}
      <div style={{ padding:"20px 40px 24px", maxWidth:1440, margin:"0 auto" }}>
        {grouped.map(([month, items]) => {
          const monthTotal = items.reduce((s,o) => s+o.amount, 0);
          const isCollapsed = collapsed[month];
          return (
            <div key={month} style={{ marginBottom:20, borderRadius:12, overflow:"hidden", background:"#222228", border:"1px solid rgba(255,255,255,0.07)" }}>
              <div onClick={() => toggle(month)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", cursor:"pointer", background:"linear-gradient(135deg, #2A2A32 0%, #222228 100%)", userSelect:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:12, color:"#C9A96E", fontWeight:700, transition:"transform 0.3s", transform:isCollapsed?"rotate(-90deg)":"rotate(0)", display:"inline-block" }}>▾</span>
                  <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:16, fontWeight:700, color:"#FFFFFF", letterSpacing:-0.3, textTransform:"uppercase" }}>{monthLabel(month)}</span>
                  <span style={{ background:"rgba(201,169,110,0.1)", color:"#C9A96E", fontSize:10, fontWeight:700, padding:"2px 10px", borderRadius:10, border:"1px solid rgba(201,169,110,0.15)" }}>{items.length}</span>
                </div>
                <div style={{ fontSize:10, color:"#8A8890", letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>
                  Итого: <span style={{ color:"#C9A96E", fontSize:15, fontFamily:"'IBM Plex Mono', monospace", fontWeight:700 }}>{fmtMoney(monthTotal)}</span>
                </div>
              </div>
              {!isCollapsed && (
                items.length === 0 ? <div style={{ padding:"32px 24px", textAlign:"center", color:"#6B6870", fontSize:13 }}>Нет заказов за этот месяц</div> : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr>
                          {["Заказ / Счёт","Изделие","Кол-во","Сумма / Оплата","Запуск","Сдача","Стадия","Прогресс",""].map((h,i) => (
                            <th key={i} style={{ padding:"11px 16px", textAlign:"left", fontSize:9, fontWeight:700, letterSpacing:2, color:"#7A7880", textTransform:"uppercase", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((o, idx) => {
                          const rowKey = o.uid;
                          const isExpanded = expandedRow === rowKey;
                          return [
                          <tr key={rowKey} style={{ borderBottom: isExpanded?"none":(idx<items.length-1?"1px solid rgba(255,255,255,0.05)":"none"), transition:"background 0.15s", cursor:"pointer" }}
                            onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                            <td style={{ padding:"14px 16px", verticalAlign:"top" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontSize:10, color:"#5A5860", transition:"transform 0.2s", transform:isExpanded?"rotate(90deg)":"rotate(0)", display:"inline-block" }}>▸</span>
                                <div>
                                  <div style={{ fontWeight:700, fontSize:13, color:"#E8E6E1", fontFamily:"'IBM Plex Mono', monospace" }}>{o.id}</div>
                                  <div style={{ fontSize:11, color:"#8A8890", marginTop:2 }}>{o.invoice}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding:"14px 16px", fontWeight:500, maxWidth:220, color:"#DAD8D2" }}>{o.product}</td>
                            <td style={{ padding:"14px 16px", whiteSpace:"nowrap", fontFamily:"'IBM Plex Mono', monospace", color:"#A0A0A6", fontWeight:600 }}>{fmt(o.qty)} шт</td>
                            <td style={{ padding:"14px 16px", verticalAlign:"top" }}>
                              <div style={{ fontWeight:700, whiteSpace:"nowrap", fontFamily:"'IBM Plex Mono', monospace", color:"#E8E6E1" }}>{fmtMoney(o.amount)}</div>
                              <div style={{ fontSize:11, marginTop:3, color: o.payPercent>=100?"#66BB6A":o.payPercent>=50?"#FFB300":"#EF5350", fontWeight:600 }}>оплата {o.payPercent}%</div>
                            </td>
                            <td style={{ padding:"14px 16px", whiteSpace:"nowrap", color:"#A0A0A6", fontSize:12 }}>{fmtDate(o.launchDate)}</td>
                            <td style={{ padding:"14px 16px", whiteSpace:"nowrap", color:"#A0A0A6", fontSize:12 }}>{fmtDate(o.dueDate)}</td>
                            <td style={{ padding:"14px 16px" }} onClick={e => e.stopPropagation()}>
                              <StagePicker stage={o.stage} onChange={s => changeStage(o.uid, s)} />
                              {o.stage==="Отгружен" && o.shipDate && <div style={{ fontSize:10, color:"#8D6E63", marginTop:4, paddingLeft:4 }}>✓ {fmtDate(o.shipDate)}</div>}
                            </td>
                            <td style={{ padding:"14px 16px", minWidth:130 }}><StageBar stage={o.stage} /></td>
                            <td style={{ padding:"14px 16px" }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => setEditing(o)} style={{ width:30, height:30, borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#6B6870", transition:"all 0.2s" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor="#C9A96E"; e.currentTarget.style.color="#C9A96E"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; e.currentTarget.style.color="#6B6870"; }}>✎</button>
                            </td>
                          </tr>,
                          isExpanded && (
                            <tr key={rowKey+"_c"} style={{ borderBottom:idx<items.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
                              <td colSpan={9} style={{ padding:"0 16px 16px 46px" }}>
                                <div style={{ background:"rgba(255,255,255,0.025)", borderRadius:10, padding:"14px 18px", border:"1px solid rgba(255,255,255,0.05)" }}>
                                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:"#5A5860", textTransform:"uppercase", marginBottom:6 }}>Комментарий</div>
                                  <div style={{ fontSize:13, color: o.comment?"#B0AEA8":"#4A484E", lineHeight:1.6, fontStyle: o.comment?"normal":"italic" }}>
                                    {o.comment || "Нет комментария. Нажмите ✎ чтобы добавить."}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )];
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          );
        })}
        {grouped.length===0 && !loading && <div style={{ textAlign:"center", padding:"48px 24px", color:"#6B6870" }}>{search ? `Ничего не найдено по запросу «${search}»` : "Нет заказов. Добавьте данные в Supabase."}</div>}
      </div>

      {editing && <EditModal order={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
      {addingMonth && <AddMonthModal existingMonths={existingMonthSet} onAdd={handleAddMonth} onClose={() => setAddingMonth(false)} />}
    </div>
  );
}
