import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/api/tracking")) {
    return NextResponse.next();
  }

  const auth = request.cookies.get("auth")?.value;
  const sv = process.env.SESSION_VERSION || "1";

  // Проверяем формат: admin:sv или client:slug:sv (обратная совместимость со старым admin)
  const isAdmin = auth === `admin:${sv}` || (sv === "1" && auth === "admin");
  const isClient = auth?.startsWith("client:") && auth.endsWith(`:${sv}`);
  // Обратная совместимость: client:slug без версии при sv=1
  const isClientLegacy = sv === "1" && auth?.startsWith("client:") && auth.split(":").length === 2;

  if (!isAdmin && !isClient && !isClientLegacy) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Клиенты имеют доступ только к /dashboard и /api
  if (isClient || isClientLegacy) {
    const allowed = pathname.startsWith("/dashboard") || pathname.startsWith("/api");
    if (!allowed) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
