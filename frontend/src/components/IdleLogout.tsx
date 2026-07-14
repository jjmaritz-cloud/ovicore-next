"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

const IDLE_TIMEOUT_MINUTES = 30;
const WARNING_MINUTES = 2;

const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
const WARNING_TIMEOUT_MS =
  (IDLE_TIMEOUT_MINUTES - WARNING_MINUTES) * 60 * 1000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

type IdleLogoutProps = {
  children: React.ReactNode;
};

export default function IdleLogout({
  children,
}: IdleLogoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const warningTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const logoutTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastActivityRef = useRef(0);

  const [checkingSession, setCheckingSession] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isPublicPage =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(
    async (reason: "manual" | "idle" = "manual") => {
      if (loggingOut) return;

      setLoggingOut(true);
      clearTimers();

      try {
        const response = await fetch(
          `${API_BASE}/api/auth/logout`,
          {
            method: "POST",
            credentials: "include",
          }
        );

        if (!response.ok) {
          console.error(
            `Logout failed: ${response.status}`
          );
        }
      } catch (error) {
        console.error("Logout request failed:", error);
      } finally {
        if (reason === "idle") {
          window.sessionStorage.setItem(
            "ovicore_logout_message",
            "You were signed out because your session was inactive."
          );
        }

        window.location.replace("/login");
      }
    },
    [clearTimers, loggingOut]
  );

  const startTimers = useCallback(() => {
    if (isPublicPage || loggingOut) return;

    clearTimers();
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, WARNING_TIMEOUT_MS);

    logoutTimerRef.current = setTimeout(() => {
      void logout("idle");
    }, IDLE_TIMEOUT_MS);
  }, [
    clearTimers,
    isPublicPage,
    loggingOut,
    logout,
  ]);

  const registerActivity = useCallback(() => {
    if (isPublicPage || loggingOut) return;

    const now = Date.now();

    if (now - lastActivityRef.current < 1000) {
      return;
    }

    lastActivityRef.current = now;
    startTimers();
  }, [
    isPublicPage,
    loggingOut,
    startTimers,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (isPublicPage) {
        setCheckingSession(false);
        clearTimers();
        setShowWarning(false);
        return;
      }

      setCheckingSession(true);

      try {
        const response = await fetch(
          `${API_BASE}/api/auth/me`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (cancelled) return;

        if (!response.ok) {
          clearTimers();
          window.location.replace("/login");
          return;
        }

        setCheckingSession(false);
        startTimers();
      } catch (error) {
        console.error(
          "Could not verify OviCore session:",
          error
        );

        if (!cancelled) {
          clearTimers();
          window.location.replace("/login");
        }
      }
    }

    void verifySession();

    if (!isPublicPage) {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(
          eventName,
          registerActivity,
          { passive: true }
        );
      });
    }

    return () => {
      cancelled = true;
      clearTimers();

      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          registerActivity
        );
      });
    };
  }, [
    pathname,
    isPublicPage,
    clearTimers,
    registerActivity,
    startTimers,
  ]);

  if (checkingSession && !isPublicPage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4f8f5",
          color: "#0b4b37",
          fontFamily: "Segoe UI, Arial, sans-serif",
          fontWeight: 800,
        }}
      >
        Checking OviCore session...
      </main>
    );
  }

  return (
    <>
      {children}

      {showWarning && !isPublicPage ? (
        <div
          className="idle-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="idle-dialog">
            <div className="idle-icon">!</div>

            <div className="idle-eyebrow">
              SESSION EXPIRING
            </div>

            <h2>Are you still working?</h2>

            <p>
              OviCore will sign you out in approximately{" "}
              {WARNING_MINUTES} minutes because no activity
              has been detected.
            </p>

            <div className="idle-actions">
              <button
                type="button"
                className="idle-secondary"
                disabled={loggingOut}
                onClick={() => void logout("manual")}
              >
                Sign out now
              </button>

              <button
                type="button"
                className="idle-primary"
                disabled={loggingOut}
                onClick={() => {
                  lastActivityRef.current = Date.now();
                  startTimers();
                }}
              >
                Continue working
              </button>
            </div>
          </div>

          <style jsx>{`
            .idle-overlay {
              position: fixed;
              inset: 0;
              z-index: 99999;
              display: grid;
              place-items: center;
              padding: 24px;
              background: rgba(3, 24, 17, 0.58);
              backdrop-filter: blur(5px);
            }

            .idle-dialog {
              width: min(100%, 440px);
              padding: 26px;
              border: 1px solid #d7e5dc;
              border-radius: 18px;
              background: #ffffff;
              box-shadow: 0 28px 80px
                rgba(0, 32, 22, 0.28);
            }

            .idle-icon {
              width: 40px;
              height: 40px;
              display: grid;
              place-items: center;
              margin-bottom: 18px;
              border-radius: 12px;
              background: #fff2d9;
              color: #946000;
              font-size: 22px;
              font-weight: 950;
            }

            .idle-eyebrow {
              color: #9a6800;
              font-size: 10px;
              font-weight: 900;
              letter-spacing: 0.09em;
            }

            h2 {
              margin: 7px 0 8px;
              color: #123d2e;
              font-size: 24px;
            }

            p {
              margin: 0;
              color: #637a70;
              font-size: 13px;
              line-height: 1.6;
            }

            .idle-actions {
              display: flex;
              justify-content: flex-end;
              gap: 9px;
              margin-top: 24px;
            }

            button {
              min-height: 40px;
              padding: 0 15px;
              border-radius: 9px;
              font-size: 12px;
              font-weight: 850;
              cursor: pointer;
            }

            .idle-secondary {
              border: 1px solid #ccdcd3;
              background: #ffffff;
              color: #31594a;
            }

            .idle-primary {
              border: 1px solid #086445;
              background: #086445;
              color: #ffffff;
            }
          `}</style>
        </div>
      ) : null}
    </>
  );
}