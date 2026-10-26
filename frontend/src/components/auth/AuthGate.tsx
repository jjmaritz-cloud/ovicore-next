"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_CHECK_TIMEOUT_MS = 8000;
const ACTIVITY_HEARTBEAT_MS = 5 * 60 * 1000;
const MOBILE_USER_CACHE_KEY = "ovicore_mobile_cached_user";
const MOBILE_KEEP_SIGNED_IN_KEY = "ovicore_mobile_keep_signed_in";

type RememberedMobileSession = {
  expires_at?: string;
};

function hasValidRememberedMobileSession() {
  if (typeof window === "undefined") return false;

  if (window.localStorage.getItem(MOBILE_KEEP_SIGNED_IN_KEY) === "false") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(MOBILE_USER_CACHE_KEY);
    if (!raw) return false;

    const session = JSON.parse(raw) as RememberedMobileSession;
    if (!session.expires_at) return false;

    const expiresAt = Date.parse(session.expires_at);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
}

function moduleFromPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "home";

  const aliases: Record<string, string> = {
    admin: "admin",
    breeders: "breeders",
    broilers: "broilers",
    compliance: "compliance",
    hatchery: "hatchery",
    home: "home",
    layers: "layers",
    mobile: "mobile",
    planning: "planning",
    processing: "processing",
    tour: "tour",
  };

  return aliases[firstSegment] ?? firstSegment;
}

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorised, setAuthorised] = useState(pathname === "/login");
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setAuthorised(true);
      setSessionChecked(false);
      return;
    }

    if (sessionChecked) return;

    let cancelled = false;
    const isMobileRoute = pathname === "/mobile" || pathname.startsWith("/mobile/");
    const rememberedMobileSession =
      isMobileRoute && hasValidRememberedMobileSession();

    // A previously authenticated device must be able to enter the mobile
    // workspace without contacting the server when there is no connection.
    if (rememberedMobileSession && !navigator.onLine) {
      setAuthorised(true);
      setSessionChecked(true);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, AUTH_CHECK_TIMEOUT_MS);

    async function redirectToLogin() {
      const query = window.location.search;
      const nextPath = `${pathname}${query}`;

      window.localStorage.removeItem("ovicore_selected_company_id");
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }

    async function checkSession() {
      setAuthorised(false);

      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        // A real 401 from the server is authoritative. Do not use an offline
        // fallback when the server has explicitly rejected the session.
        if (response.status === 401) {
          if (!cancelled) await redirectToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(`Session check failed: ${response.status}`);
        }

        if (!cancelled) {
          setAuthorised(true);
          setSessionChecked(true);
        }
      } catch {
        if (cancelled) return;

        // Network failure/timeout is different from a rejected login. The
        // mobile route may continue using its valid 14-day remembered session.
        if (rememberedMobileSession) {
          setAuthorised(true);
          setSessionChecked(true);
          return;
        }

        await redirectToLogin();
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [pathname, router, sessionChecked]);

  useEffect(() => {
    if (!authorised || pathname === "/login" || !navigator.onLine) return;

    let cancelled = false;

    async function sendActivity(eventType: "page_view" | "heartbeat") {
      try {
        await fetch("/api/auth/activity", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: pathname,
            module: moduleFromPath(pathname),
            event_type: eventType,
          }),
          keepalive: true,
        });
      } catch {
        // Activity tracking must never interrupt normal app use.
      }
    }

    void sendActivity("page_view");

    const heartbeatId = window.setInterval(() => {
      if (
        !cancelled &&
        navigator.onLine &&
        document.visibilityState === "visible"
      ) {
        void sendActivity("heartbeat");
      }
    }, ACTIVITY_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatId);
    };
  }, [authorised, pathname]);

  if (!authorised) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f5f8f6",
          color: "#174734",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: 18 }}>
            Checking your OviCore session…
          </strong>
          <span style={{ display: "block", marginTop: 7, fontSize: 13 }}>
            Please wait a moment.
          </span>
        </div>
      </main>
    );
  }

  return children;
}
