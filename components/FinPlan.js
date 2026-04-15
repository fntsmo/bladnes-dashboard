"use client";

import { useState, useCallback, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import ThemeToggle from "./ThemeToggle";

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DOW_LABELS  = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

const getDays = (y,m) => new Date(y,m+1,0).getDate();
const mkKey   = (y,m) => `${y}-${String(m).padStart(2,"0")}`;
const RU_ANNUAL = ["01-01","01-02","01-03","01-04","01-05","01-06","01-07","01-08","02-23","03-08","05-01","05-09","06-12","11-04"];
const RU_EXTRA  = {
  2025:["01-24","03-10","04-30","05-02","05-08","06-13","11-03","12-31"],
  2026:["01-09","02-24","03-09","05-04","06-22","11-03"],
};
const isHoliday = (y,m,d) => {
  const mmdd = `${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  return RU_ANNUAL.includes(mmdd)||(RU_EXTRA[y]||[]).includes(mmdd);
};
const getDayInfos = (y,m) => Array.from({length:getDays(y,m)},(_,i)=>{
  const dow=new Date(y,m,i+1).getDay(), weekend=dow===0||dow===6, holiday=isHoliday(y,m,i+1);
  return {workday:!weekend&&!holiday,weekend,holiday,dow};
});
const countWorkdays = (y,m) => getDayInfos(y,m).filter(d=>d.workday).length;


// ── БИТРИКС24 ────────────────────────────────────────────────────────────────
const B24_PROXY = "/api/bitrix";

const b24fetch = async (method, params={}) => {
  const res = await fetch(B24_PROXY, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({method, params}),
  });
  if(!res.ok) throw new Error(`Прокси вернул ${res.status}. Убедитесь что b24-proxy.js запущен (node b24-proxy.js)`);
  const data = await res.json();
  if(data.error) throw new Error(data.error_description||data.error);
  return data.result;
};

// Получить все воронки и их стадии (для диагностики)
const loadB24Pipelines = async () => {
  const cats = await b24fetch("crm.dealcategory.list", {});
  const allCats = [{ID:"0", NAME:"Основная воронка"}, ...(Array.isArray(cats)?cats:(cats?.dealCategories||[]))];
  const result = [];
  for(const cat of allCats){
    const stages = await b24fetch("crm.dealcategory.stage.list", {id: cat.ID});
    result.push({id:cat.ID, name:cat.NAME, stages: Array.isArray(stages)?stages:[]});
  }
  return result;
};

// Загрузить все сделки из "Оплачено" (для выбора вручную)
const loadB24AllPaid = async () => {
  // Загружаем сделки из "Оплачено"
  const deals = await b24fetch("crm.deal.list", {
    filter:{ "CATEGORY_ID": "16", "STAGE_ID": "C16:UC_OELMN9" },
    select:["ID","TITLE","OPPORTUNITY","UF_CRM_1773342360920","UF_CRM_TOTALPROFIT","ASSIGNED_BY_ID"],
    order:{"DATE_MODIFY":"DESC"},
    start: 0,
  });
  if(!deals||deals.length===0) return [];
  // Получаем имена менеджеров по ASSIGNED_BY_ID
  const userIds=[...new Set(deals.map(d=>d.ASSIGNED_BY_ID).filter(Boolean))];
  const userMap={};
  for(const uid of userIds){
    try{
      const u=await b24fetch("user.get",{filter:{ID:uid}});
      if(u&&u[0]) userMap[uid]=`${u[0].NAME||""} ${u[0].LAST_NAME||""}`.trim();
    }catch(e){}
  }
  return deals.map(d=>({...d, _managerName: userMap[d.ASSIGNED_BY_ID]||""}));
};

const mkOrder   = () => ({id:Date.now()+Math.random(),num:"",client:"",manager:"",revenue:"",cost:""});
const mkExpItem = (type="fixed") => ({id:Date.now()+Math.random(),name:"",amount:"",type,dueDate:"",paid:false});
const mkDay     = () => ({orders:[mkOrder()],expItems:[]});
const mkEmpty   = (days) => ({days:Array.from({length:days},()=>mkDay()),expItems:[],startBal:""});

const fmt = v => {
  if(v===""||v===null||v===undefined||isNaN(v)) return "—";
  const n=Number(v);
  if(Math.abs(n)>=1_000_000) return `${(n/1_000_000).toFixed(2)} млн ₽`;
  if(Math.abs(n)>=1_000)     return `${(n/1_000).toFixed(0)} тыс ₽`;
  return `${n.toLocaleString("ru")} ₽`;
};
const pct = (f,p) => p?((f/p)*100).toFixed(1):null;
const sc  = p => p===null||p===undefined?"#7A7880":p>=100?"#34d399":p>=80?"#fbbf24":"#f87171";

const dayRevenue     = d => d.orders.reduce((s,o)=>s+(o.revenue===""?0:Number(o.revenue)),0);
const orderGP        = o => (Number(o.revenue)||0)-(Number(o.cost)||0);
const orderMargin    = o => { const r=Number(o.revenue)||0; return r?((orderGP(o)/r)*100).toFixed(1):null; };
const dayGrossProfit = d => d.orders.reduce((s,o)=>s+orderGP(o),0);
const dayAvgMargin   = d => { const r=dayRevenue(d); return r?(dayGrossProfit(d)/r*100).toFixed(1):null; };

const inpFocus = e => e.target.style.borderColor="rgba(52,211,153,0.5)";
const inpBlur  = e => e.target.style.borderColor="rgba(52,211,153,0.2)";
const inp = {width:"100%",background:"var(--surface2)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:7,color:"var(--ink)",outline:"none",padding:"7px 10px",fontFamily:"'IBM Plex Sans',sans-serif",fontSize:13,boxSizing:"border-box",transition:"border-color 0.2s"};

const TT = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return <div style={{background:"rgba(8,14,26,0.97)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:8,padding:"10px 14px",fontSize:12}}>
    <p style={{color:"#34d399",fontWeight:700,marginBottom:4}}>{label}</p>
    {payload.map((p,i)=><p key={i} style={{color:p.color||"#A0A0A6",margin:"2px 0"}}>{p.name}: <b>{fmt(p.value)}</b></p>)}
  </div>;
};

function Kpi({label,value,sub,accent,pctVal}) {
  const c=pctVal!==undefined?sc(pctVal):(accent||"#34d399");
  return <div style={{flex:"1 1 160px",background:"var(--surface2)",border:`1px solid ${c}88`,borderRadius:12,padding:"16px 18px"}}>
    <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>{label}</div>
    <div style={{fontSize:20,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,color:"var(--ink)"}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"#7788aa",marginTop:4}}>{sub}</div>}
  </div>;
}

const STitle = ({children}) => <div style={{fontSize:12,fontWeight:700,color:"#34d399",letterSpacing:2,textTransform:"uppercase",margin:"22px 0 10px",opacity:0.7}}>{children}</div>;

function DayTile({dayIdx,info,dayData,planPerWorkday,onClick}) {
  const rev=dayRevenue(dayData),gp=dayGrossProfit(dayData),avgM=dayAvgMargin(dayData);
  const hasData=dayData.orders.some(o=>o.revenue!==""||o.num!==""||o.client!=="");
  const p=rev>0&&info.workday?parseFloat(pct(rev,planPerWorkday)):null,c=sc(p);
  const ordCnt=dayData.orders.filter(o=>o.revenue!=="").length;
  const bg=info.holiday?"rgba(255,107,107,0.1)":info.weekend?"rgba(100,116,139,0.1)":hasData?`rgba(${c==="#34d399"?"52,211,153":c==="#fbbf24"?"251,191,36":"248,113,113"},0.1)`:"var(--subtle)";
  const bd=info.holiday?"rgba(255,107,107,0.35)":info.weekend?"rgba(100,116,139,0.3)":hasData?c+"aa":"var(--line2)";
  return <div onClick={onClick} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";}} style={{background:bg,border:`1px solid ${bd}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",userSelect:"none",transition:"border-color 0.2s,transform 0.1s",boxSizing:"border-box",minWidth:0}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <span style={{fontSize:18,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:info.holiday?"#f87171":info.weekend?"#64748b":hasData?"var(--ink)":"var(--muted)"}}>{dayIdx+1}</span>
        <span style={{fontSize:10,color:info.holiday?"#f87171":info.weekend?"#64748b":"#7A7880",marginLeft:4}}>{DOW_LABELS[info.dow]}{info.holiday?" 🎉":""}</span>
      </div>
      {p!==null&&<span style={{fontSize:10,fontWeight:700,color:c,background:c+"22",borderRadius:20,padding:"1px 6px"}}>{p}%</span>}
    </div>
    <div style={{marginTop:7}}>
      <div style={{fontSize:12,fontFamily:"'IBM Plex Mono',monospace",color:hasData?"var(--ink)":"var(--muted)",fontWeight:hasData?600:400}}>{hasData?fmt(rev):(info.workday?`план ${fmt(planPerWorkday)}`:(info.holiday?"праздник":"выходной"))}</div>
      {hasData&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{ordCnt} зак. {avgM!==null?`· ${avgM}%`:""}</div>}
      {hasData&&<div style={{fontSize:11,color:"#34d399",fontFamily:"'IBM Plex Mono',monospace",marginTop:1}}>{fmt(gp)}</div>}
      {info.workday&&<div style={{background:"var(--line2)",borderRadius:3,height:3,marginTop:6}}>{p!==null&&<div style={{width:`${Math.min(p,100)}%`,height:"100%",background:c,borderRadius:3}}/>}</div>}
      <div style={{fontSize:10,color:"var(--muted2)",marginTop:4,textAlign:"center"}}>нажмите для заказов</div>
    </div>
  </div>;
}

function DayModal({dayIdx,info,dayData,planPerWorkday,onUpdateDay,onClose,monthLabel,curYear,curMonth}) {
  const rev=dayRevenue(dayData),gp=dayGrossProfit(dayData),avgM=dayAvgMargin(dayData);
  const p=rev>0?parseFloat(pct(rev,planPerWorkday)):null,c=sc(p);
  const [b24loading,setB24loading]=useState(false);
  const [b24error,setB24error]=useState(null);
  const [b24deals,setB24deals]=useState(null);   // null=не загружено, []=пусто
  const [b24selected,setB24selected]=useState({});
  const [b24debug,setB24debug]=useState(false);
  const [b24pipes,setB24pipes]=useState(null);
  const [b24pipeLoading,setB24pipeLoading]=useState(false);
  const [b24search,setB24search]=useState("");

  const showPipelines = async () => {
    setB24debug(true); setB24pipeLoading(true);
    try { setB24pipes(await loadB24Pipelines()); }
    catch(e){ setB24pipes([{id:"err",name:"Ошибка: "+e.message,stages:[]}]); }
    setB24pipeLoading(false);
  };

  const loadFromB24 = async () => {
    setB24loading(true); setB24error(null); setB24deals(null); setB24selected({});
    try {
      const deals = await loadB24AllPaid();
      setB24deals(deals);
    } catch(err){
      setB24error(err.message||"Ошибка. Запустите: node b24-proxy.js");
    }
    setB24loading(false);
  };

  const toggleDeal = (id) => setB24selected(s=>({...s,[id]:!s[id]}));

  const addSelectedDeals = () => {
    const chosen = (b24deals||[]).filter(d=>b24selected[d.ID]);
    if(!chosen.length) return;
    const newOrders = chosen.map(deal=>({
      id: Date.now()+Math.random(),
      num: String(deal.ID||""),
      client: deal.TITLE||"",
      manager: deal._managerName||"",
      revenue: deal.OPPORTUNITY||"",
      cost: deal.UF_CRM_1773342360920||"",
    }));
    onUpdateDay(d=>{
      const existing=d.orders.filter(o=>o.revenue!==""||o.num!==""||o.client!=="");
      return {...d,orders:[...existing,...newOrders]};
    });
    setB24deals(null); setB24selected({});
  };

  const b24filtered = (b24deals||[]).filter(d=>
    !b24search || d.TITLE?.toLowerCase().includes(b24search.toLowerCase()) || String(d.ID).includes(b24search)
  );

  const addOrder  = () => onUpdateDay(d=>({...d,orders:[...d.orders,mkOrder()]}));
  const delOrder  = id => onUpdateDay(d=>({...d,orders:d.orders.filter(o=>o.id!==id)}));
  const setOField = (id,f,v) => onUpdateDay(d=>({...d,orders:d.orders.map(o=>o.id===id?{...o,[f]:v}:o)}));
  const addDExp   = () => onUpdateDay(d=>({...d,expItems:[...(d.expItems||[]),mkExpItem()]}));
  const delDExp   = id => onUpdateDay(d=>({...d,expItems:(d.expItems||[]).filter(e=>e.id!==id)}));
  const setDExp   = (id,f,v) => onUpdateDay(d=>({...d,expItems:(d.expItems||[]).map(e=>e.id===id?{...e,[f]:v}:e)}));
  const dei=dayData.expItems||[];
  const det=dei.reduce((s,e)=>s+(e.amount===""?0:Number(e.amount)),0);
  return <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,8,18,0.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"24px 16px",overflowY:"auto"}}>
    <div style={{width:"100%",maxWidth:900,background:"var(--surface)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}}>
      <div style={{padding:"20px 28px",borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(52,211,153,0.04)"}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:"var(--ink)"}}>{dayIdx+1} {DOW_LABELS[info.dow]}, {monthLabel}</div>
          <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>План на день: <span style={{color:"#34d399",fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>{fmt(planPerWorkday)}</span></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {p!==null&&<div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--muted)"}}>Выполнение</div><div style={{fontSize:24,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:c}}>{p}%</div></div>}
          <button onClick={onClose} style={{background:"var(--surface2)",border:"1px solid var(--line2)",color:"var(--muted)",borderRadius:10,width:40,height:40,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
      </div>

      {/* B24 toolbar */}
      <div style={{padding:"10px 28px",borderBottom:"1px solid var(--line)",background:"rgba(99,102,241,0.04)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <button onClick={loadFromB24} disabled={b24loading}
          style={{padding:"7px 18px",background:b24loading?"rgba(99,102,241,0.08)":"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.4)",borderRadius:8,color:"#818cf8",fontSize:13,fontWeight:700,cursor:b24loading?"default":"pointer",display:"flex",alignItems:"center",gap:8,opacity:b24loading?0.7:1}}>
          {b24loading?"⏳ Загружаю...":"⬇ Выбрать сделки из Битрикс24"}
        </button>
        <button onClick={showPipelines} disabled={b24pipeLoading}
          style={{padding:"7px 14px",background:"var(--surface2)",border:"1px solid var(--line2)",borderRadius:8,color:"var(--muted)",fontSize:12,cursor:"pointer"}}>
          {b24pipeLoading?"⏳":"🔍"} Воронки и стадии
        </button>
        {b24error&&<span style={{fontSize:12,color:"#f87171"}}>✗ {b24error}</span>}
      </div>

      {/* B24 deal picker */}
      {b24deals!==null&&(
        <div style={{margin:"0 0 0 0",borderBottom:"1px solid var(--line)",background:"rgba(99,102,241,0.03)"}}>
          <div style={{padding:"12px 28px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <input
              placeholder="🔍 Поиск по названию или ID..."
              value={b24search}
              onChange={e=>setB24search(e.target.value)}
              onFocus={inpFocus} onBlur={inpBlur}
              style={{...inp,maxWidth:320,fontSize:13}}
            />
            <span style={{fontSize:12,color:"var(--muted)"}}>
              Найдено: {b24filtered.length} сделок · Выбрано: {Object.values(b24selected).filter(Boolean).length}
            </span>
            <button onClick={addSelectedDeals}
              disabled={!Object.values(b24selected).some(Boolean)}
              style={{padding:"7px 18px",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.4)",borderRadius:8,color:"#34d399",fontSize:13,fontWeight:700,cursor:"pointer",marginLeft:"auto",opacity:Object.values(b24selected).some(Boolean)?1:0.4}}>
              ✓ Добавить выбранные
            </button>
            <button onClick={()=>{setB24deals(null);setB24selected({});setB24search("");}}
              style={{padding:"7px 14px",background:"var(--surface2)",border:"1px solid var(--line2)",borderRadius:8,color:"var(--muted)",fontSize:12,cursor:"pointer"}}>
              Закрыть
            </button>
          </div>
          <div style={{maxHeight:260,overflowY:"auto",padding:"0 28px 12px"}}>
            {b24filtered.length===0&&(
              <div style={{padding:"20px 0",textAlign:"center",color:"var(--muted2)",fontSize:13}}>
                {b24deals.length===0?"В стадии «Оплачено» нет сделок":"Ничего не найдено"}
              </div>
            )}
            {b24filtered.map(deal=>{
              const sel=!!b24selected[deal.ID];
              return (
                <div key={deal.ID} onClick={()=>toggleDeal(deal.ID)}
                  style={{display:"grid",gridTemplateColumns:"32px 1fr 140px 120px",gap:12,alignItems:"center",padding:"9px 12px",marginBottom:4,borderRadius:8,cursor:"pointer",background:sel?"rgba(52,211,153,0.08)":"var(--subtle)",border:`1px solid ${sel?"rgba(52,211,153,0.3)":"var(--line)"}`,transition:"all 0.15s"}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${sel?"#34d399":"#4A484E"}`,background:sel?"#34d399":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {sel&&<span style={{color:"#18181C",fontSize:13,fontWeight:900}}>✓</span>}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:sel?"var(--ink)":"var(--muted)"}}>{deal.TITLE||"Без названия"}</div>
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>ID: {deal.ID}{deal.ASSIGNED_BY_NAME?` · ${deal.ASSIGNED_BY_NAME}`:""}</div>
                  </div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:sel?"#34d399":"#7A7880",textAlign:"right"}}>{deal.OPPORTUNITY?fmt(Number(deal.OPPORTUNITY)):"—"}</div>
                  <div style={{fontSize:11,color:"var(--muted)",textAlign:"right"}}>{deal.UF_CRM_COST?"себест: "+fmt(Number(deal.UF_CRM_COST)):""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debug: список воронок и стадий */}
      {b24debug&&b24pipes&&(
        <div style={{margin:"0 28px 16px",padding:"14px 18px",background:"var(--surface2)",border:"1px solid var(--line2)",borderRadius:10,maxHeight:300,overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:"#889aaa",letterSpacing:1,textTransform:"uppercase"}}>Воронки и стадии вашего Б24</span>
            <button onClick={()=>setB24debug(false)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:16}}>×</button>
          </div>
          {b24pipeLoading?<div style={{color:"var(--muted)",fontSize:13}}>Загрузка...</div>:b24pipes.map(pipe=>(
            <div key={pipe.id} style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:"#818cf8",marginBottom:4}}>
                📋 {pipe.name} <span style={{fontSize:10,color:"var(--muted2)",fontFamily:"'IBM Plex Mono',monospace"}}>(ID: {pipe.id})</span>
              </div>
              {pipe.stages.map(st=>(
                <div key={st.STATUS_ID||st.ID} style={{fontSize:12,color:"var(--muted)",padding:"2px 12px",display:"flex",gap:12}}>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",color:"var(--muted)",minWidth:180}}>{st.STATUS_ID||st.ID}</span>
                  <span>{st.NAME}</span>
                  <span style={{color:st.SEMANTICS==="S"?"#34d399":st.SEMANTICS==="F"?"#f87171":"#556677",marginLeft:"auto"}}>{st.SEMANTICS==="S"?"✓ Выиграна":st.SEMANTICS==="F"?"✗ Проиграна":"◦ В работе"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{padding:"20px 28px"}}>

        {dayData.orders.map((order,oi)=>{
          const oRev=Number(order.revenue)||0,oGP=orderGP(order),oM=orderMargin(order);
          const mc=oM!==null?(Number(oM)>=50?"#34d399":Number(oM)>=30?"#fbbf24":"#f87171"):"#7A7880";
          return <div key={order.id} style={{background:"var(--subtle)",border:"1px solid var(--line2)",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
            {/* Строка 1: номер, клиент, менеджер, кнопка удалить */}
            <div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr 1fr 36px",gap:8,padding:"10px 12px",borderBottom:"1px solid var(--line)",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:800,color:"var(--muted2)",fontFamily:"'IBM Plex Mono',monospace",textAlign:"center"}}>{oi+1}</span>
              <div>
                <div style={{fontSize:10,color:"var(--muted)",marginBottom:3,letterSpacing:0.5}}>№ ЗАКАЗА</div>
                <input placeholder="Номер" value={order.num} onChange={e=>setOField(order.id,"num",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--muted)",marginBottom:3,letterSpacing:0.5}}>КЛИЕНТ</div>
                <input placeholder="Название" value={order.client} onChange={e=>setOField(order.id,"client",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#818cf8",marginBottom:3,letterSpacing:0.5}}>МЕНЕДЖЕР</div>
                <input placeholder="Имя" value={order.manager||""} onChange={e=>setOField(order.id,"manager",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13,borderColor:"rgba(129,140,248,0.3)"}}/>
              </div>
              {dayData.orders.length>1
                ?<button onClick={()=>delOrder(order.id)} style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",color:"#f87171",borderRadius:7,width:32,height:32,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                :<div/>}
            </div>
            {/* Строка 2: выручка, себест, прибыль, рентабельность */}
            <div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr 120px 100px",gap:8,padding:"10px 12px",alignItems:"center",background:"var(--surface2)"}}>
              <div/>
              <div>
                <div style={{fontSize:10,color:"var(--muted)",marginBottom:3,letterSpacing:0.5}}>ВЫРУЧКА, ₽</div>
                <input type="number" placeholder="0" value={order.revenue} onChange={e=>setOField(order.id,"revenue",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:14,fontWeight:600}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--muted)",marginBottom:3,letterSpacing:0.5}}>СЕБЕСТОИМОСТЬ, ₽</div>
                <input type="number" placeholder="0" value={order.cost} onChange={e=>setOField(order.id,"cost",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:14}}/>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"var(--muted)",marginBottom:6,letterSpacing:0.5}}>ПРИБЫЛЬ</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:15,fontWeight:700,color:oGP>0?"#34d399":oGP<0?"#f87171":"#7A7880"}}>{oRev>0?fmt(oGP):"—"}</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:10,color:"var(--muted)",marginBottom:4,letterSpacing:0.5}}>РЕНТ-ТЬ</div>
                {oM!==null
                  ?<span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:800,color:mc,background:mc+"18",borderRadius:20,padding:"3px 10px"}}>{oM}%</span>
                  :<span style={{color:"var(--muted2)",fontSize:14}}>—</span>}
              </div>
            </div>
          </div>;
        })}
        <button onClick={addOrder} style={{width:"100%",marginTop:4,padding:"10px",background:"rgba(52,211,153,0.06)",border:"1px dashed rgba(52,211,153,0.3)",borderRadius:9,color:"#34d399",fontSize:14,fontWeight:700,cursor:"pointer"}}>+ Добавить заказ</button>
        {dayData.orders.some(o=>o.revenue!=="")&&<div style={{marginTop:20,padding:"16px 20px",background:"rgba(52,211,153,0.05)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {[{l:"Выручка",v:fmt(rev),c:"var(--ink)"},{l:"Вал. прибыль",v:fmt(gp),c:"#34d399"},{l:"Ср. рентабельность",v:avgM?`${avgM}%`:"—",c:avgM?(Number(avgM)>=50?"#34d399":Number(avgM)>=30?"#fbbf24":"#f87171"):"var(--muted)"},{l:"Заказов",v:dayData.orders.filter(o=>o.revenue!=="").length,c:"var(--muted)"}].map(({l,v,c})=><div key={l}><div style={{fontSize:11,color:"var(--muted)",marginBottom:4}}>{l}</div><div style={{fontSize:20,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:c}}>{v}</div></div>)}
        </div>}
        <div style={{marginTop:28,borderTop:"1px solid var(--line)",paddingTop:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>Расходы дня</div>
            <button onClick={addDExp} style={{padding:"6px 14px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:7,color:"#f87171",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить расход</button>
          </div>
          {dei.length===0&&<div style={{fontSize:13,color:"var(--muted2)",padding:"12px 0"}}>Нет расходов за этот день</div>}
          {dei.map(item=><div key={item.id} style={{display:"grid",gridTemplateColumns:"1fr 180px 36px",gap:10,alignItems:"center",marginBottom:6}}>
            <input placeholder="Статья расхода" value={item.name} onChange={e=>setDExp(item.id,"name",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13}}/>
            <input type="number" placeholder="0" value={item.amount} onChange={e=>setDExp(item.id,"amount",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13}}/>
            <button onClick={()=>delDExp(item.id)} style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.2)",color:"#f87171",borderRadius:7,width:32,height:32,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>)}
          {dei.some(e=>e.amount!=="")&&<div style={{marginTop:8,padding:"8px 14px",background:"rgba(248,113,113,0.05)",borderRadius:8,display:"flex",justifyContent:"space-between",fontSize:13}}>
            <span style={{color:"var(--muted)"}}>Итого расходов за день:</span>
            <b style={{fontFamily:"'IBM Plex Mono',monospace",color:"#f87171"}}>{fmt(det)}</b>
          </div>}
        </div>
      </div>
    </div>
  </div>;
}

export default function App() {
  const now=new Date();
  const [curYear,setCurYear]=useState(now.getFullYear());
  const [curMonth,setCurMonth]=useState(now.getMonth());
  const [tab,setTab]=useState("daily");
  const [openDay,setOpenDay]=useState(null);
  const [openPayDay,setOpenPayDay]=useState(null);
  const [goalRevenue,setGoalRevenue]=useState(()=>{
    try{const v=localStorage.getItem("finplan-goal");return v?Number(v):6000000;}catch{return 6000000;}
  });
  const [editingGoal,setEditingGoal]=useState(false);
  const [goalInput,setGoalInput]=useState(()=>String(goalRevenue));
  const [allData,setAllData]=useState(()=>{
    try{const s=localStorage.getItem("finplan-data");if(s)return JSON.parse(s);}catch{}
    const key=mkKey(now.getFullYear(),now.getMonth());
    return {[key]:mkEmpty(getDays(now.getFullYear(),now.getMonth()))};
  });

  useEffect(()=>{try{localStorage.setItem("finplan-data",JSON.stringify(allData));}catch{}},[allData]);
  useEffect(()=>{try{localStorage.setItem("finplan-goal",String(goalRevenue));}catch{}},[goalRevenue]);

  const key=mkKey(curYear,curMonth),DAYS=getDays(curYear,curMonth);

  // Если месяца ещё нет — копируем постоянные расходы из ближайшего предыдущего
  const initMonth=useCallback((k,days)=>{
    const empty=mkEmpty(days);
    const keys=Object.keys(allData).filter(k2=>k2!==k&&(allData[k2].expItems||[]).some(e=>e.type==="fixed"&&e.name)).sort().reverse();
    if(!keys.length) return empty;
    const src=allData[keys[0]];
    const copied=(src.expItems||[]).filter(e=>e.type==="fixed"&&e.name).map(e=>({...e,id:Date.now()+Math.random(),paid:false,dueDate:""}));
    return {...empty,expItems:[...copied,...empty.expItems]};
  },[allData]);

  // При переходе на новый месяц — инициализируем и сохраняем в allData
  useEffect(()=>{
    if(!allData[key]){
      setAllData(prev=>{if(prev[key])return prev;const m=initMonth(key,DAYS);return {...prev,[key]:m};});
    }
  },[key,DAYS,allData,initMonth]);

  const monthData=allData[key]||mkEmpty(DAYS);

  const updateMonth=useCallback(upd=>{
    setAllData(prev=>({...prev,[key]:upd(prev[key]||mkEmpty(DAYS))}));
  },[key,DAYS]);

  const updateDay=useCallback((idx,upd)=>{
    updateMonth(m=>{const days=[...m.days];while(days.length<DAYS)days.push(mkDay());days[idx]=upd(days[idx]||mkDay());return {...m,days};});
  },[updateMonth,DAYS]);

  const setStartBal = useCallback(v=>updateMonth(m=>({...m,startBal:v})),[updateMonth]);
  const addExpItem  = useCallback((type="fixed")=>updateMonth(m=>({...m,expItems:[...(m.expItems||[]),mkExpItem(type)]})),[updateMonth]);
  const delExpItem  = useCallback(id=>updateMonth(m=>({...m,expItems:(m.expItems||[]).filter(e=>e.id!==id)})),[updateMonth]);
  const setExpField = useCallback((id,f,v)=>updateMonth(m=>({...m,expItems:(m.expItems||[]).map(e=>e.id===id?{...e,[f]:v}:e)})),[updateMonth]);

  const prevMonth=()=>curMonth===0?(setCurMonth(11),setCurYear(y=>y-1)):setCurMonth(m=>m-1);
  const nextMonth=()=>curMonth===11?(setCurMonth(0),setCurYear(y=>y+1)):setCurMonth(m=>m+1);

  const expItems=monthData.expItems||[],startBal=monthData.startBal;
  const dayInfos=getDayInfos(curYear,curMonth),WORKDAYS=countWorkdays(curYear,curMonth);
  const planPerWorkday=WORKDAYS>0?goalRevenue/WORKDAYS:0;
  const daysArr=Array.from({length:DAYS},(_,i)=>monthData.days?.[i]||mkDay());
  const totalRevFact=daysArr.reduce((s,d)=>s+dayRevenue(d),0);
  const totalGPFact=daysArr.reduce((s,d)=>s+dayGrossProfit(d),0);
  const avgMarginAll=totalRevFact>0?(totalGPFact/totalRevFact*100).toFixed(1):null;
  const daysIn=daysArr.filter(d=>dayRevenue(d)>0).length;
  const totalExpFixed=expItems.filter(e=>e.type==="fixed").reduce((s,e)=>s+(e.amount===""?0:Number(e.amount)),0);
  const totalExpVariable=expItems.filter(e=>e.type==="variable").reduce((s,e)=>s+(e.amount===""?0:Number(e.amount)),0);
  const totalExpFact=totalExpFixed+totalExpVariable;
  const profit=totalGPFact-totalExpFact;
  const sb=startBal===""?0:Number(startBal);
  const goalPct=goalRevenue?Math.min((totalRevFact/goalRevenue)*100,100):0;
  const remainToGoal=Math.max(goalRevenue-totalRevFact,0);
  const workdaysLeft=dayInfos.slice(daysIn).filter(d=>d.workday).length;
  const neededPerDay=workdaysLeft>0?remainToGoal/workdaysLeft:0;
  // ── МЕНЕДЖЕРЫ ─────────────────────────────────────────────────────────────
  const managerStats = (() => {
    const map = {};
    daysArr.forEach(d => {
      d.orders.forEach(o => {
        const name = (o.manager||"").trim() || "Без менеджера";
        if(!map[name]) map[name] = {name, revenue:0, gp:0, orders:0};
        map[name].revenue += Number(o.revenue)||0;
        map[name].gp      += orderGP(o);
        map[name].orders  += (o.revenue!=="")?1:0;
      });
    });
    return Object.values(map)
      .filter(m => m.revenue > 0)
      .sort((a,b) => b.revenue - a.revenue)
      .map(m => ({...m, margin: m.revenue>0?(m.gp/m.revenue*100).toFixed(1):null}));
  })();

  const monthLabel=`${MONTH_NAMES[curMonth]} ${curYear}`;

  const TABS=[{id:"daily",label:"📅 Ежедневный план"},{id:"expenses",label:"💸 Расходы"},{id:"cashflow",label:"💰 ДДС"},{id:"pl",label:"📊 P&L"},{id:"managers",label:"👤 Менеджеры"}];

  return <div style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"'IBM Plex Sans',sans-serif",color:"var(--ink)"}}>
    <ThemeToggle />
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"radial-gradient(ellipse at 15% 10%,rgba(52,211,153,0.07) 0%,transparent 45%),radial-gradient(ellipse at 85% 85%,rgba(99,102,241,0.06) 0%,transparent 45%)"}}/>
    <div style={{position:"relative",zIndex:1,maxWidth:1280,margin:"0 auto",padding:"28px 20px"}}>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:26,fontWeight:800,color:"var(--ink)",letterSpacing:-0.5}}>Финплан <span style={{color:"#34d399"}}>· {monthLabel}</span></h1>
          <div style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Рабочих дней: {WORKDAYS} · план/день: {fmt(planPerWorkday)}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={() => window.location.href = "/"} style={{background:"var(--surface2)",border:"1px solid var(--line2)",color:"var(--muted)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13}}>← Портал</button>
          <button onClick={prevMonth} style={{background:"var(--surface2)",border:"1px solid var(--line2)",color:"var(--muted)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:14}}>‹</button>
          <span style={{fontSize:14,color:"var(--muted)",minWidth:120,textAlign:"center"}}>{monthLabel}</span>
          <button onClick={nextMonth} style={{background:"var(--surface2)",border:"1px solid var(--line2)",color:"var(--muted)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:14}}>›</button>
        </div>
      </div>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
        <Kpi label="Выручка (факт)" value={fmt(totalRevFact)} sub={`цель: ${fmt(goalRevenue)}`} pctVal={goalPct}/>
        <Kpi label="Вал. прибыль" value={fmt(totalGPFact)} sub={avgMarginAll?`маржа ${avgMarginAll}%`:"нет данных"}/>
        <Kpi label="Расходы (факт)" value={fmt(totalExpFact)} sub={`статей: ${expItems.length}`} accent="#f87171"/>
        <Kpi label="Прибыль (предв.)" value={fmt(profit)} sub="вал.прибыль − расходы" accent={profit>=0?"#34d399":"#f87171"}/>
        <Kpi label="Остаток ДС" value={fmt(sb+profit)} sub="нач.остаток + прибыль" accent="#60a5fa"/>
      </div>

      <div style={{marginBottom:22,padding:"16px 20px",background:"rgba(52,211,153,0.04)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:12,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>🎯 Целевой оборот</div>
            {editingGoal?<div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="number" value={goalInput} onChange={e=>setGoalInput(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,width:180,fontSize:16,fontWeight:700}}/>
              <button onClick={()=>{setGoalRevenue(Number(goalInput)||6000000);setEditingGoal(false);}} style={{padding:"6px 14px",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.4)",borderRadius:7,color:"#34d399",cursor:"pointer",fontWeight:700}}>✓</button>
            </div>:<div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:22,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:"#34d399"}}>{fmt(goalRevenue)}</span>
              <button onClick={()=>setEditingGoal(true)} style={{background:"transparent",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:16}}>✎</button>
            </div>}
          </div>
          <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--muted)"}}>Выполнено</div><div style={{fontSize:20,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:sc(goalPct)}}>{goalPct.toFixed(1)}%</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--muted)"}}>Осталось</div><div style={{fontSize:20,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:"#f87171"}}>{fmt(remainToGoal)}</div></div>
            {workdaysLeft>0&&<div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--muted)"}}>Нужно/день</div><div style={{fontSize:20,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:"#fbbf24"}}>{fmt(neededPerDay)}</div></div>}
          </div>
        </div>
        <div style={{marginTop:12,background:"var(--line2)",borderRadius:6,height:6}}>
          <div style={{width:`${goalPct}%`,height:"100%",background:sc(goalPct),borderRadius:6,transition:"width 0.5s"}}/>
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 18px",background:tab===t.id?"rgba(52,211,153,0.18)":"var(--surface2)",border:`1px solid ${tab===t.id?"rgba(52,211,153,0.5)":"var(--line2)"}`,borderRadius:9,color:tab===t.id?"#34d399":"var(--muted)",fontSize:13,fontWeight:tab===t.id?700:400,cursor:"pointer"}}>{t.label}</button>)}
      </div>

      {tab==="daily"&&<div>
        <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
          {[{lbl:"≥100% плана",bg:"rgba(52,211,153,0.2)",bd:"rgba(52,211,153,0.4)"},{lbl:"80–99%",bg:"rgba(251,191,36,0.15)",bd:"rgba(251,191,36,0.35)"},{lbl:"<80%",bg:"rgba(248,113,113,0.12)",bd:"rgba(248,113,113,0.3)"},{lbl:"Выходной",bg:"rgba(100,116,139,0.08)",bd:"rgba(100,116,139,0.2)"},{lbl:"Праздник 🎉",bg:"rgba(255,107,107,0.08)",bd:"rgba(255,107,107,0.3)"}].map(({lbl,bg,bd})=><div key={lbl} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:bg,border:`1px solid ${bd}`}}/><span style={{fontSize:11,color:"var(--muted)"}}>{lbl}</span></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:d==="Сб"||d==="Вс"?"#64748b":"#7A7880",letterSpacing:1,paddingBottom:4}}>{d}</div>)}
          {Array.from({length:(new Date(curYear,curMonth,1).getDay()+6)%7},(_,i)=><div key={"e"+i}/>)}
          {Array.from({length:DAYS},(_,i)=><DayTile key={i} dayIdx={i} info={dayInfos[i]} dayData={daysArr[i]} planPerWorkday={planPerWorkday} onClick={()=>setOpenDay(i)}/>)}
        </div>
        {openDay!==null&&<DayModal dayIdx={openDay} info={dayInfos[openDay]} dayData={daysArr[openDay]} planPerWorkday={planPerWorkday} onUpdateDay={upd=>updateDay(openDay,upd)} onClose={()=>setOpenDay(null)} monthLabel={monthLabel} curYear={curYear} curMonth={curMonth}/>}
      </div>}

      {tab==="expenses"&&<div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:24}}>
          {[
            {label:"Постоянные",value:fmt(totalExpFixed),sub:`${expItems.filter(e=>e.type==="fixed"&&e.amount!=="").length} статей`,color:"#a78bfa"},
            {label:"Переменные",value:fmt(totalExpVariable),sub:`${expItems.filter(e=>e.type==="variable"&&e.amount!=="").length} статей`,color:"#fb923c"},
            {label:"Итого расходов",value:fmt(totalExpFact),sub:totalRevFact>0?`${(totalExpFact/totalRevFact*100).toFixed(1)}% от выручки`:"нет выручки",color:"#f87171"},
            ...(totalRevFact>0?[{label:"Чистая прибыль",value:fmt(profit),sub:"вал.прибыль − расходы",color:profit>=0?"#34d399":"#f87171"}]:[]),
          ].map(({label,value,sub,color})=><div key={label} style={{flex:"1 1 160px",background:"var(--surface2)",border:`1px solid ${color}66`,borderRadius:12,padding:"14px 18px"}}>
            <div style={{fontSize:11,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>{label}</div>
            <div style={{fontSize:20,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color}}>{value}</div>
            <div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>{sub}</div>
          </div>)}
        </div>

        {[
          {type:"fixed",   label:"Постоянные расходы",hint:"Аренда, зарплата, подписки — не зависят от объёма",ac:"#a78bfa",bg:"rgba(167,139,250,0.06)",bd:"rgba(167,139,250,0.25)"},
          {type:"variable",label:"Переменные расходы",hint:"Материалы, логистика, маркетинг — меняются с объёмом",ac:"#fb923c",bg:"rgba(251,146,60,0.06)",bd:"rgba(251,146,60,0.25)"},
        ].map(({type,label,hint,ac,bg,bd})=>{
          const items=expItems.filter(e=>e.type===type);
          const total=items.reduce((s,e)=>s+(e.amount===""?0:Number(e.amount)),0);
          return <div key={type} style={{marginBottom:20,background:bg,border:`1px solid ${bd}`,borderRadius:14,padding:"18px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:ac}}>{label}</div>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{hint}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {total>0&&<span style={{fontSize:16,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:ac}}>{fmt(total)}</span>}
                <button onClick={()=>addExpItem(type)} style={{padding:"6px 14px",background:"var(--surface2)",border:`1px solid ${ac}66`,borderRadius:8,color:ac,fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить</button>
              </div>
            </div>
            {items.length===0&&<div style={{padding:"16px",textAlign:"center",color:"var(--muted)",fontSize:13,borderRadius:8,border:"1px dashed var(--line2)"}}>Нет статей. Нажмите «+ Добавить».</div>}
            {items.length>0&&<div style={{display:"grid",gridTemplateColumns:"24px 1fr 200px 130px 36px 36px",gap:10,padding:"6px 10px",fontSize:10,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,marginBottom:4}}>
              <span/><span>Название статьи</span><span>Сумма, ₽</span><span>Дата платежа</span><span title="Оплачено">✓</span><span/>
            </div>}
            {items.map((item,idx)=>{const overdue=item.dueDate&&!item.paid&&item.dueDate<new Date().toISOString().slice(0,10);const paid=!!item.paid;return <div key={item.id} style={{display:"grid",gridTemplateColumns:"24px 1fr 200px 130px 36px 36px",gap:10,alignItems:"center",padding:"8px 10px",background:paid?"rgba(34,197,94,0.06)":overdue?"rgba(248,113,113,0.06)":"var(--subtle)",border:`1px solid ${paid?"rgba(34,197,94,0.3)":overdue?"rgba(248,113,113,0.3)":"var(--line)"}`,borderRadius:8,marginBottom:5}}>
              <span style={{fontSize:11,color:"var(--muted2)",fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,textAlign:"center"}}>{idx+1}</span>
              <input placeholder="Название статьи" value={item.name} onChange={e=>setExpField(item.id,"name",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13,borderColor:`${ac}33`}}/>
              <input type="number" placeholder="0" value={item.amount} onChange={e=>setExpField(item.id,"amount",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:13,borderColor:`${ac}33`}}/>
              <input type="date" value={item.dueDate||""} onChange={e=>setExpField(item.id,"dueDate",e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,fontSize:12,borderColor:paid?"rgba(34,197,94,0.4)":overdue?"rgba(248,113,113,0.5)":`${ac}33`}}/>
              <button onClick={()=>setExpField(item.id,"paid",!item.paid)} title={paid?"Отметить как неоплачено":"Отметить как оплачено"} style={{width:32,height:32,borderRadius:7,border:`1.5px solid ${paid?"#22c55e":"var(--line2)"}`,background:paid?"rgba(34,197,94,0.15)":"transparent",color:paid?"#22c55e":"var(--muted2)",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>{paid?"✓":"○"}</button>
              <button onClick={()=>delExpItem(item.id)} style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.15)",color:"#f87171",borderRadius:7,width:32,height:32,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>})}
            {items.some(e=>e.amount!=="")&&<div style={{marginTop:8,padding:"8px 12px",background:"var(--surface2)",borderRadius:8,display:"flex",justifyContent:"space-between",fontSize:13}}>
              <span style={{color:"var(--muted)"}}>Итого {type==="fixed"?"постоянных":"переменных"}:</span>
              <b style={{fontFamily:"'IBM Plex Mono',monospace",color:ac}}>{fmt(total)}</b>
            </div>}
          </div>;
        })}

        {/* Календарь платежей */}
        {expItems.some(e=>e.dueDate)&&(()=>{
          const today=new Date().toISOString().slice(0,10);
          const pad=d=>String(d).padStart(2,"0");
          const firstDow=(new Date(curYear,curMonth,1).getDay()+6)%7;
          const DAYS_IN=getDays(curYear,curMonth);
          const byDay={};
          expItems.filter(e=>e.dueDate&&e.name).forEach(e=>{
            const [ey,em,ed]=e.dueDate.split("-").map(Number);
            if(ey===curYear&&em-1===curMonth){const d=ed;if(!byDay[d])byDay[d]=[];byDay[d].push(e);}
          });
          return <div style={{marginBottom:24}}>
            <STitle>Календарь платежей</STitle>
            <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
              {[{lbl:"Просрочено",bg:"rgba(248,113,113,0.15)",bd:"rgba(248,113,113,0.4)"},{lbl:"Сегодня",bg:"rgba(251,191,36,0.15)",bd:"rgba(251,191,36,0.4)"},{lbl:"Предстоит",bg:"rgba(167,139,250,0.12)",bd:"rgba(167,139,250,0.3)"},{lbl:"Оплачено",bg:"rgba(34,197,94,0.15)",bd:"rgba(34,197,94,0.4)"}].map(({lbl,bg,bd})=><div key={lbl} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:bg,border:`1px solid ${bd}`}}/><span style={{fontSize:11,color:"var(--muted)"}}>{lbl}</span></div>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
              {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:d==="Сб"||d==="Вс"?"#64748b":"var(--muted)",letterSpacing:1,paddingBottom:4}}>{d}</div>)}
              {Array.from({length:firstDow},(_,i)=><div key={"pe"+i}/>)}
              {Array.from({length:DAYS_IN},(_,i)=>{
                const dayNum=i+1;
                const dateStr=`${curYear}-${pad(curMonth+1)}-${pad(dayNum)}`;
                const items=byDay[dayNum]||[];
                const total=items.reduce((s,e)=>s+(Number(e.amount)||0),0);
                const isToday=dateStr===today;
                const allPaid=items.length>0&&items.every(e=>e.paid);
                const overdue=dateStr<today&&items.length>0&&!allPaid;
                const upcoming=dateStr>today&&items.length>0;
                const paid=allPaid&&items.length>0;
                const tileColor=paid?"#22c55e":overdue?"#f87171":isToday&&items.length?"#fbbf24":upcoming?"#a78bfa":null;
                const bg=paid?"rgba(34,197,94,0.1)":overdue?"rgba(248,113,113,0.12)":isToday&&items.length?"rgba(251,191,36,0.12)":upcoming?"rgba(167,139,250,0.08)":"var(--subtle)";
                const bd=paid?"rgba(34,197,94,0.35)":overdue?"rgba(248,113,113,0.4)":isToday&&items.length?"rgba(251,191,36,0.4)":upcoming?"rgba(167,139,250,0.3)":"var(--line2)";
                return <div key={dayNum} onClick={()=>items.length&&setOpenPayDay(openPayDay===dayNum?null:dayNum)} style={{background:bg,border:`1px solid ${bd}`,borderRadius:8,padding:"8px 10px",minHeight:60,cursor:items.length?"pointer":"default",transition:"border-color 0.2s",boxSizing:"border-box"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <span style={{fontSize:16,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:isToday?"#fbbf24":items.length?"var(--ink)":"var(--muted)"}}>{dayNum}</span>
                    {items.length>0&&<span style={{fontSize:10,fontWeight:700,color:tileColor,background:tileColor+"22",borderRadius:10,padding:"1px 6px"}}>{paid?"✓":items.length}</span>}
                  </div>
                  {items.length>0&&<div style={{marginTop:4}}>
                    <div style={{fontSize:12,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:tileColor}}>{fmt(total)}</div>
                    <div style={{fontSize:10,color:"var(--muted)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{paid?"✓ оплачено":items[0].name}{!paid&&items.length>1?` +${items.length-1}`:""}</div>
                  </div>}
                </div>;
              })}
            </div>
            {/* Детали дня */}
            {openPayDay&&byDay[openPayDay]&&<div style={{marginTop:12,background:"var(--surface2)",border:"1px solid var(--line2)",borderRadius:12,padding:"16px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>{openPayDay} {MONTH_NAMES[curMonth]} — платежи</div>
                <button onClick={()=>setOpenPayDay(null)} style={{background:"var(--surface2)",border:"1px solid var(--line2)",color:"var(--muted)",borderRadius:6,width:28,height:28,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>
              {byDay[openPayDay].map(e=>{const ec=e.paid?"#22c55e":e.type==="fixed"?"#a78bfa":"#fb923c";return <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:e.paid?"rgba(34,197,94,0.06)":"var(--subtle)",border:`1px solid ${ec}44`,borderRadius:8,marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:ec,flexShrink:0}}/>
                  <span style={{fontSize:13,color:"var(--ink)",fontWeight:500,textDecoration:e.paid?"line-through":"none"}}>{e.name}</span>
                  <span style={{fontSize:11,color:"var(--muted)"}}>{e.type==="fixed"?"пост.":"перем."}</span>
                  {e.paid&&<span style={{fontSize:10,fontWeight:700,color:"#22c55e",background:"rgba(34,197,94,0.15)",borderRadius:10,padding:"1px 8px"}}>оплачено</span>}
                </div>
                <span style={{fontSize:14,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:ec}}>{fmt(Number(e.amount)||0)}</span>
              </div>;})}
              <div style={{marginTop:8,display:"flex",justifyContent:"flex-end",fontSize:13,color:"var(--muted)"}}>Итого: <b style={{marginLeft:6,fontFamily:"'IBM Plex Mono',monospace",color:"var(--ink)"}}>{fmt(byDay[openPayDay].reduce((s,e)=>s+(Number(e.amount)||0),0))}</b></div>
            </div>}
          </div>;
        })()}

        {expItems.some(e=>e.amount!==""&&e.name!=="")&&<div>
          <STitle>Структура расходов</STitle>
          <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 0 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(180,expItems.filter(e=>e.amount!==""&&e.name!=="").length*36)}>
              <BarChart data={expItems.filter(e=>e.amount!==""&&e.name!=="").map(e=>({name:e.name,сумма:Number(e.amount)||0,type:e.type}))} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                <XAxis type="number" tickFormatter={v=>`${(v/1000).toFixed(0)}т`} tick={{fill:"#556677",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fill:"#889aaa",fontSize:12}} axisLine={false} tickLine={false} width={140}/>
                <Tooltip content={<TT/>}/>
                <Bar dataKey="сумма" name="Сумма" radius={[0,6,6,0]}>
                  {expItems.filter(e=>e.amount!==""&&e.name!=="").map((e,i)=><Cell key={i} fill={e.type==="fixed"?"#a78bfa":"#fb923c"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8,paddingBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,borderRadius:3,background:"#a78bfa"}}/><span style={{fontSize:12,color:"var(--muted)"}}>Постоянные</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,borderRadius:3,background:"#fb923c"}}/><span style={{fontSize:12,color:"var(--muted)"}}>Переменные</span></div>
            </div>
          </div>
        </div>}
      </div>}

      {tab==="cashflow"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <label style={{fontSize:13,color:"var(--muted)"}}>Начальный остаток (₽):</label>
          <input type="number" placeholder="0" value={startBal} onChange={e=>setStartBal(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} style={{...inp,maxWidth:200}}/>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          <Kpi label="Нач. остаток" value={fmt(sb)} sub="на 1-е число"/>
          <Kpi label="Поступления" value={fmt(totalRevFact)} sub="итого за период"/>
          <Kpi label="Выплаты" value={fmt(totalExpFact)} sub="итого за период" accent="#f87171"/>
          <Kpi label="Кон. остаток" value={fmt(sb+profit)} sub="расчётный" accent={sb+profit>=0?"#34d399":"#f87171"}/>
        </div>
        {(()=>{
          const dailyExp=daysIn?totalExpFact/daysIn:0;
          let bal=sb;
          const chartData=daysArr.map((d,i)=>{const r=dayRevenue(d);if(!r)return null;bal+=r-dailyExp;return {day:String(i+1),остаток:Math.round(bal)};}).filter(Boolean);
          return chartData.length>0?<div>
            <STitle>Динамика остатка ДС</STitle>
            <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 0 6px"}}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs><linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/><stop offset="95%" stopColor="#34d399" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="day" tick={{fill:"#556677",fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}т`} tick={{fill:"#556677",fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<TT/>}/>
                  <Area type="monotone" dataKey="остаток" stroke="#34d399" strokeWidth={2.5} fill="url(#gC)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>:<div style={{padding:32,textAlign:"center",color:"var(--muted2)",fontSize:14,background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px dashed var(--line2)"}}>Заполните заказы в «Ежедневном плане», чтобы увидеть ДДС</div>;
        })()}
      </div>}

      {tab==="managers"&&<div>
        {managerStats.length===0?(
          <div style={{padding:48,textAlign:"center",color:"var(--muted2)",fontSize:14,background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px dashed var(--line2)"}}>
            Заполните поле «Менеджер» в заказах — статистика появится здесь
          </div>
        ):(
          <div>
            {/* KPI row */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:24}}>
              <Kpi label="Менеджеров" value={managerStats.length} sub="с продажами в месяце"/>
              <Kpi label="Лидер" value={managerStats[0]?.name||"—"} sub={fmt(managerStats[0]?.revenue)} accent="#818cf8"/>
              <Kpi label="Ср. выручка" value={fmt(managerStats.length?totalRevFact/managerStats.length:0)} sub="на менеджера"/>
            </div>

            {/* Table */}
            <div style={{background:"var(--surface2)",border:"1px solid var(--line2)",borderRadius:14,overflow:"hidden",marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"32px 1fr 160px 100px 100px 100px",gap:12,padding:"10px 20px",background:"rgba(129,140,248,0.08)",fontSize:11,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>
                <span>#</span><span>Менеджер</span><span>Выручка</span><span>% от общей</span><span>Заказов</span><span>Рент-ть</span>
              </div>
              {managerStats.map((m,i)=>{
                const sharePct = totalRevFact>0?(m.revenue/totalRevFact*100):0;
                const mc = m.margin!==null?(Number(m.margin)>=50?"#34d399":Number(m.margin)>=30?"#fbbf24":"#f87171"):"#7A7880";
                const colors=["#818cf8","#34d399","#fbbf24","#fb923c","#f87171","#60a5fa","#a78bfa"];
                const col = colors[i % colors.length];
                return <div key={m.name} style={{display:"grid",gridTemplateColumns:"32px 1fr 160px 100px 100px 100px",gap:12,padding:"14px 20px",borderTop:"1px solid var(--line)",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:800,fontFamily:"'IBM Plex Mono',monospace",color:col}}>#{i+1}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--ink)"}}>{m.name}</div>
                    <div style={{marginTop:5,background:"var(--line2)",borderRadius:4,height:4,width:"100%"}}>
                      <div style={{width:`${sharePct}%`,height:"100%",background:col,borderRadius:4,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:700,color:"var(--ink)"}}>{fmt(m.revenue)}</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:700,color:col}}>{sharePct.toFixed(1)}%</div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:"var(--muted)"}}>{m.orders}</div>
                  <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:800,color:mc,background:mc+"18",borderRadius:20,padding:"2px 10px",textAlign:"center"}}>{m.margin!==null?`${m.margin}%`:"—"}</span>
                </div>;
              })}
            </div>

            {/* Bar chart */}
            <STitle>Выручка по менеджерам</STitle>
            <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 0 6px"}}>
              <ResponsiveContainer width="100%" height={Math.max(160, managerStats.length*52)}>
                <BarChart data={managerStats.map(m=>({name:m.name,выручка:m.revenue,маржа:m.gp}))} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                  <XAxis type="number" tickFormatter={v=>`${(v/1000).toFixed(0)}т`} tick={{fill:"#556677",fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{fill:"#889aaa",fontSize:13}} axisLine={false} tickLine={false} width={120}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="выручка" name="Выручка" radius={[0,6,6,0]}>
                    {managerStats.map((_,i)=>{
                      const colors=["#818cf8","#34d399","#fbbf24","#fb923c","#f87171","#60a5fa","#a78bfa"];
                      return <Cell key={i} fill={colors[i%colors.length]}/>;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>}

      {tab==="pl"&&<div>
        <p style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>P&L формируется автоматически на основе введённых данных</p>
        {[
          {label:"Выручка (факт)",val:totalRevFact},
          {label:"Себестоимость (авто)",val:-(totalRevFact-totalGPFact)},
          {label:"── Валовая прибыль",val:totalGPFact,bold:true},
          ...(expItems.filter(e=>e.type==="fixed"&&e.name!=="").length>0?[
            {label:"— Постоянные расходы —",val:null,divider:true,accent:"#a78bfa"},
            ...expItems.filter(e=>e.type==="fixed"&&e.name!=="").map(e=>({label:e.name,val:-(Number(e.amount)||0),accent:"#a78bfa"})),
            {label:"Итого постоянных",val:-totalExpFixed,bold:true,accent:"#a78bfa"},
          ]:[]),
          ...(expItems.filter(e=>e.type==="variable"&&e.name!=="").length>0?[
            {label:"— Переменные расходы —",val:null,divider:true,accent:"#fb923c"},
            ...expItems.filter(e=>e.type==="variable"&&e.name!=="").map(e=>({label:e.name,val:-(Number(e.amount)||0),accent:"#fb923c"})),
            {label:"Итого переменных",val:-totalExpVariable,bold:true,accent:"#fb923c"},
          ]:[]),
          {label:"── Итого расходов",val:-totalExpFact,bold:true},
          {label:"══ Чистая прибыль",val:profit,bold:true,hi:true},
        ].map((r,i)=>{
          if(r.divider) return <div key={i} style={{fontSize:11,color:r.accent||"#7A7880",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 18px 6px",marginTop:4}}>{r.label}</div>;
          const rc=r.hi?"#34d399":r.accent||(r.bold?"#dce8f0":"#889aaa");
          return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:r.hi?"14px 18px":r.bold?"11px 18px":"9px 26px",borderRadius:10,marginBottom:3,background:r.hi?"rgba(52,211,153,0.08)":r.bold?"var(--subtle)":"transparent",border:r.hi?"1px solid rgba(52,211,153,0.3)":r.bold?"1px solid var(--line2)":"none"}}>
            <span style={{fontSize:r.hi?15:r.bold?13:12,fontWeight:r.bold?700:400,color:rc}}>{r.label}</span>
            <span style={{fontSize:r.hi?21:r.bold?15:13,fontWeight:r.bold?800:400,fontFamily:"'IBM Plex Mono',monospace",color:r.val===null?"transparent":r.val>=0?(r.hi||r.bold?(r.accent||"#34d399"):"#A0A0A6"):"#f87171"}}>{r.val===null?"":r.val===0?"—":fmt(r.val)}</span>
          </div>;
        })}
        <STitle>Диаграмма P&L</STitle>
        <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 0 6px"}}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={[{name:"Выручка",v:totalRevFact},{name:"Вал.прибыль",v:totalGPFact},{name:"Расходы",v:totalExpFact},{name:"Чистая приб.",v:profit}]} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="name" tick={{fill:"#556677",fontSize:12}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`${(v/1000000).toFixed(1)}м`} tick={{fill:"#556677",fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<TT/>}/>
              <Bar dataKey="v" name="Сумма" radius={[7,7,0,0]}>
                <Cell fill="#34d399"/><Cell fill="#4ade80"/><Cell fill="#f87171"/><Cell fill={profit>=0?"#34d399":"#f87171"}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}

      <div style={{marginTop:44,borderTop:"1px solid var(--line)",paddingTop:14,display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)",flexWrap:"wrap",gap:8}}>
        <span>Финансовый дашборд · {monthLabel}</span>
        <span>Зелёный ≥100% · Жёлтый ≥80% · Красный &lt;80%</span>
      </div>

    </div>
  </div>;
}
