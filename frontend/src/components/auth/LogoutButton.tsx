"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const API_BASE = '';

const MOBILE_AUTH_KEYS = [
  "ovicore_mobile_cached_user",
  "ovicore_mobile_keep_signed_in",
  "ovicore_remembered_email",
  "ovicore_selected_company_id",
  "ovicore_selected_farm_id",
  "ovicore_selected_shed_id",
  "ovicore_selected_flock_id",
  "ovicore_mobile_selected_plan_id",
];

function clearLocalAuthentication() {
  if (typeof window === "undefined") return;

  for (const key of MOBILE_AUTH_KEYS) {
    window.localStorage.removeItem(key);
  }

  // Do not clear IndexedDB mobile drafts or the cached broiler dataset.
  // Unsynced production entries must survive logout.
  window.sessionStorage.clear();
}

type LogoutButtonProps = {
  compact?: boolean;
};

export default function LogoutButton({
  compact = false,
}: LogoutButtonProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

	async function handleLogout() {
		if (loggingOut) return;

		setLoggingOut(true);
		clearLocalAuthentication();

		// Local logout succeeds immediately, including when the device is offline.
		// The server session is invalidated in the background when reachable.
		void fetch(`${API_BASE}/api/auth/logout`, {
			method: "POST",
			credentials: "include",
			cache: "no-store",
			keepalive: true,
		}).catch((error) => {
			console.error("Logout request failed:", error);
		});

		router.replace("/login");
		router.refresh();
	}

  return (
    <button
      type="button"
      className={`ovicore-logout-button ${
        compact ? "compact" : ""
      }`}
      onClick={handleLogout}
      disabled={loggingOut}
      title="Sign out of OviCore"
    >
      <LogOut size={16} strokeWidth={2.1} />

      {!compact ? (
        <span>{loggingOut ? "Signing out..." : "Logout"}</span>
      ) : null}

      <style jsx>{`
        .ovicore-logout-button {
          width: 100%;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 9px;
          padding: 0 11px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          transition:
            background 120ms ease,
            border-color 120ms ease;
        }

        .ovicore-logout-button:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
        }

				.ovicore-logout-button.compact {
					width: 32px;
					min-height: 32px;
					padding: 0;
					justify-content: center;
					border-radius: 7px;
				}

        .ovicore-logout-button:disabled {
          cursor: wait;
          opacity: 0.6;
        }
      `}</style>
    </button>
  );
}