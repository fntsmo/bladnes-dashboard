import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase-server";


export async function GET() {
  const { error } = await supabase.from("orders").select("uid").limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
