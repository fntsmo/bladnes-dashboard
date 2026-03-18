import { NextResponse } from "next/server";

export async function POST(request) {
  const { password } = await request.json();

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  };

  if (password === process.env.EDIT_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth", "admin", cookieOpts);
    return res;
  }

  const clients = JSON.parse(process.env.CLIENTS_CONFIG || "[]");
  const client = clients.find(c => c.password === password);
  if (client) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth", `client:${client.slug}`, cookieOpts);
    return res;
  }

  return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
}
