import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("auth")?.value;
  const role = auth === "admin" ? "admin" : "viewer";
  return NextResponse.json({ role });
}
