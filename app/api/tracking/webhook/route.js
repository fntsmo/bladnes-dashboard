import { supabase } from "../../../../lib/supabase-server";
import { NextResponse } from "next/server";


const WEBHOOK_SECRET = process.env.TRACKING_WEBHOOK_SECRET || "xiaomi-track-2024";

export async function POST(request) {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { camera_id, event_type, timestamp } = body;

  if (!camera_id || !event_type) {
    return NextResponse.json({ error: "Missing camera_id or event_type" }, { status: 400 });
  }

  // Находим зону по camera_entity_id
  const { data: zone } = await supabase
    .from("zones")
    .select("id")
    .eq("camera_entity_id", camera_id)
    .single();

  if (!zone) {
    return NextResponse.json({ error: "Unknown camera" }, { status: 404 });
  }

  // Записываем событие
  const { error } = await supabase.from("activity_events").insert({
    zone_id: zone.id,
    event_type,
    timestamp: timestamp || new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
