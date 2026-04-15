import { NextResponse } from "next/server";

// CBR currency codes for XML_dynamic
const CBR_CODES = { USD: "R01235", EUR: "R01239", CNY: "R01375" };

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function parseXml(text, tag) {
  const records = [];
  const re = new RegExp(`<Record[^>]*Date="([^"]+)"[^>]*>([\\s\\S]*?)<\\/Record>`, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const dateStr = m[1]; // DD.MM.YYYY
    const valMatch = m[2].match(/<Value>([\d,]+)<\/Value>/);
    const nomMatch = m[2].match(/<Nominal>(\d+)<\/Nominal>/);
    if (valMatch) {
      const val = parseFloat(valMatch[1].replace(",", "."));
      const nom = nomMatch ? parseInt(nomMatch[1]) : 1;
      const [dd, mm, yyyy] = dateStr.split(".");
      records.push({ date: `${yyyy}-${mm}-${dd}`, value: val / nom });
    }
  }
  return records;
}

export async function GET() {
  try {
    // 1. Current rates
    const curRes = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", { cache: "no-store" });
    if (!curRes.ok) throw new Error("CBR daily error");
    const curData = await curRes.json();

    const codes = ["USD", "EUR", "CNY", "GBP", "TRY", "KZT", "BYN"];
    const rates = {};
    for (const code of codes) {
      const v = curData.Valute?.[code];
      if (v) {
        rates[code] = {
          name: v.Name,
          value: +(v.Value / v.Nominal).toFixed(4),
          previous: +(v.Previous / v.Nominal).toFixed(4),
          nominal: v.Nominal,
          change: +((v.Value - v.Previous) / v.Previous * 100).toFixed(2),
        };
      }
    }

    // 2. History (90 days) for USD, EUR, CNY — single request each
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 90);
    const d1 = fmtDate(from), d2 = fmtDate(now);
    const history = {};

    await Promise.all(Object.entries(CBR_CODES).map(async ([code, cbrId]) => {
      try {
        const url = `https://www.cbr.ru/scripts/XML_dynamic.asp?date_req1=${d1}&date_req2=${d2}&VAL_NM_RQ=${cbrId}`;
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) history[code] = parseXml(await r.text());
      } catch(e) { history[code] = []; }
    }));

    return NextResponse.json({ date: curData.Date, rates, history });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
