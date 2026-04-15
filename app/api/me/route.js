import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("auth")?.value;

  const sv = process.env.SESSION_VERSION || "1";
  const isAdmin = auth === `admin:${sv}` || (sv === "1" && auth === "admin");

  if (isAdmin) {
    const clients = JSON.parse(process.env.CLIENTS_CONFIG || "[]");
    return NextResponse.json({ role: "admin", clients });
  }

  if (auth?.startsWith("client:")) {
    // client:slug:sv → slug
    const parts = auth.split(":");
    const slug = parts[1];
    const clients = JSON.parse(process.env.CLIENTS_CONFIG || "[]");
    const client = clients.find(c => c.slug === slug);
    return NextResponse.json({ role: "viewer", clientSlug: slug, clientName: client?.name || slug });
  }

  return NextResponse.json({ role: "viewer", clientSlug: null });
}
