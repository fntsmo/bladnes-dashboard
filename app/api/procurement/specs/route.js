import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase-server";


export async function GET() {
  const { data, error } = await supabase
    .from("procurement_specs")
    .select("*, procurement_materials(*)")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  const { name, description, materials } = await request.json();
  const { data: spec, error } = await supabase
    .from("procurement_specs")
    .insert({ name, description })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (materials?.length) {
    const rows = materials.map(m => ({ ...m, spec_id: spec.id }));
    await supabase.from("procurement_materials").insert(rows);
  }
  return NextResponse.json(spec);
}

export async function PUT(request) {
  const { id, name, description, materials } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("procurement_specs")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace materials
  await supabase.from("procurement_materials").delete().eq("spec_id", id);
  if (materials?.length) {
    const rows = materials.map(m => ({
      material_name: m.material_name,
      supplier: m.supplier,
      unit: m.unit,
      consumption: m.consumption,
      price: m.price || 0,
      spec_id: id,
    }));
    await supabase.from("procurement_materials").insert(rows);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("procurement_specs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
