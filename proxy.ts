import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "rooc_session";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/landing", request.url));
}

export const config = {
  matcher: ["/"],
};
