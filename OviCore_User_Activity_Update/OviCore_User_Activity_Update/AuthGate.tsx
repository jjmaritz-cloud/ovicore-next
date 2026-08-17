"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_CHECK_TIMEOUT_MS = 8000;
const ACTIVITY_HEARTBEAT_MS = 5 * 60 * 1000;

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

  useEffect(() => {
    if (pathname === "/login") {
      setAuthorised(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, AUTH_CHECK_TIMEOUT_MS);

    async function checkSession() {
      setAuthorised(false);

      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Session check failed: ${response.status}`);
        }

        if (!cancelled) {
          setAuthorised(true);
        }
      } catch {
        if (cancelled) return;

        const query = window.location.search;
        const nextPath = `${pathname}${query}`;

        window.localStorage.removeItem(
          "ovicore_selected_company_id",
        );

        router.replace(
          `/login?next=${encodeURIComponent(nextPath)}`,
        );
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
  }, [pathname, router]);

  useEffect(() => {
    if (!authorised || pathname === "/login") return;

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
      if (!cancelled && document.visibilityState === "visible") {
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
          <strong
            style={{
              display: "block",
              fontSize: 18,
            }}
          >
            Checking your OviCore session…
          </strong>

          <span
            style={{
              display: "block",
              marginTop: 7,
              fontSize: 13,
            }}
          >
            Please wait a moment.
          </span>
        </div>
      </main>
    );
  }

  return children;
}
