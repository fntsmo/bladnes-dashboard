import { NextResponse } from "next/server";

const DADATA_TOKEN = process.env.DADATA_TOKEN || "";

export async function POST(request) {
  try {
    const { inn } = await request.json();
    if (!inn || inn.length < 10) return NextResponse.json({ error: "ИНН должен быть 10 или 12 цифр" }, { status: 400 });
    if (!DADATA_TOKEN) return NextResponse.json({ error: "DADATA_TOKEN не настроен" }, { status: 500 });

    const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Token " + DADATA_TOKEN },
      body: JSON.stringify({ query: inn, count: 1 }),
    });
    if (!res.ok) throw new Error("DaData API: " + res.status);
    const data = await res.json();
    const s = data.suggestions?.[0];
    if (!s) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });

    const d = s.data;
    const result = {
      name: s.value,                             // полное наименование
      inn: d.inn,
      kpp: d.kpp || "",
      ogrn: d.ogrn || "",
      addr: d.address?.unrestricted_value || d.address?.value || "",
      director: d.management?.name || "",
      directorPost: d.management?.post || "",
      type: d.type,                              // LEGAL / INDIVIDUAL
      opf: d.opf?.short || "",                   // ОПФ (ООО, ИП, АО и т.д.)
    };
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
