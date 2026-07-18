import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL("/home", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/home/:path*",
    "/admin/:path*",
    "/broilers/:path*",
    "/breeders/:path*",
    "/hatchery/:path*",
    "/processing/:path*",
    "/planning/:path*",
    "/login",
    "/forgot-password/:path*",
    "/reset-password/:path*",
    "/change-password/:path*",
  ],
};