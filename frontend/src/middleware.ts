import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ovicore_access_token";

const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/change-password",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(COOKIE_NAME)?.value;
  const isLoggedIn = Boolean(accessToken);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Root address decides where the user should go.
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isLoggedIn ? "/home" : "/login", request.url)
    );
  }

  // Logged-out users cannot open protected pages.
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users should not return to the login screen.
  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
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