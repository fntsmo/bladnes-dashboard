import { NextResponse } from "next/server";

export async function POST(request) {
  const { password } = await request.json();

  let role = null;
  if (password === process.env.EDIT_PASSWORD) role = "admin";
  else if (password === process.env.VIEW_PASSWORD) role = "viewer";

  if (!role) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
