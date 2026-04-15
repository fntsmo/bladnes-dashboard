import { supabase } from "../../../../lib/supabase-server";
import { NextResponse } from "next/server";


export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const startOfDay = `${date}T00:00:00+03:00`;
  const endOfDay = `${date}T23:59:59+03:00`;

  // Получаем все зоны
  const { data: zones } = await supabase.from("zones").select("*");

  // Получаем события за день
  const { data: events } = await supabase
    .from("activity_events")
    .select("*")
    .gte("timestamp", startOfDay)
    .lte("timestamp", endOfDay)
    .order("timestamp", { ascending: true });

  if (!zones || !events) {
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }

  // Считаем статистику по каждой зоне
  const stats = zones.map((zone) => {
    const zoneEvents = (events || []).filter((e) => e.zone_id === zone.id);

    let presenceMinutes = 0;
    let motionMinutes = 0;
    let lastEvent = null;
    let firstEvent = null;
    let lastMotion = null;

    for (const event of zoneEvents) {
      const ts = new Date(event.timestamp);

      if (!firstEvent) firstEvent = ts;
      lastEvent = ts;

      if (event.event_type === "motion") {
        lastMotion = ts;
      }

      // Если между событиями < 5 мин — считаем как присутствие
      if (lastEvent && firstEvent) {
        const prev = zoneEvents[zoneEvents.indexOf(event) - 1];
        if (prev) {
          const gap = (ts - new Date(prev.timestamp)) / 60000;
          if (gap <= 5) {
            presenceMinutes += gap;
            if (event.event_type === "motion" || prev.event_type === "motion") {
              motionMinutes += gap;
            }
          }
        }
      }
    }

    const idleMinutes = Math.max(0, presenceMinutes - motionMinutes);

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      worker_name: zone.worker_name,
      expected_behavior: zone.expected_behavior,
      total_events: zoneEvents.length,
      motion_events: zoneEvents.filter((e) => e.event_type === "motion").length,
      person_events: zoneEvents.filter((e) => e.event_type === "person").length,
      presence_minutes: Math.round(presenceMinutes),
      motion_minutes: Math.round(motionMinutes),
      idle_minutes: Math.round(idleMinutes),
      first_seen: firstEvent?.toISOString() || null,
      last_seen: lastEvent?.toISOString() || null,
    };
  });

  return NextResponse.json({ date, stats });
}
