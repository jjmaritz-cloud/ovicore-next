"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_CHECK_TIMEOUT_MS = 8000;

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
