import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Пропускаем логин и API
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const auth = request.cookies.get("auth")?.value;
  if (auth !== "1") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
