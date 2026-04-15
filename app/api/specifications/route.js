import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase-server";


export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderUid = searchParams.get("order_uid");

  let query = supabase
    .from("specifications")
    .select("*, contracts(*), spec_files(*)")
    .order("created_at", { ascending: false });

  if (orderUid) query = query.eq("order_uid", orderUid);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  const { contract_id, order_uid, delivery_days, delivery_note } = body;

  // Автонумерация: следующий номер по этому договору
  const { data: existing } = await supabase
    .from("specifications")
    .select("number")
    .eq("contract_id", contract_id)
    .order("number", { ascending: false })
    .limit(1);

  const number = existing && existing.length > 0 ? existing[0].number + 1 : 1;

  const { data, error } = await supabase
    .from("specifications")
    .insert({ contract_id, order_uid, delivery_days, delivery_note, number })
    .select("*, contracts(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
