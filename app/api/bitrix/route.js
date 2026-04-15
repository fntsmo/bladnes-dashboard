import { NextResponse } from "next/server";

const B24_WEBHOOK = process.env.B24_WEBHOOK;

export async function POST(request) {
  const { method, params } = await request.json();

  const url = `${B24_WEBHOOK}/${method}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
