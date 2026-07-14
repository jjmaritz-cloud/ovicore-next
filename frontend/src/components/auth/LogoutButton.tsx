"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

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

		try {
			const response = await fetch(`${API_BASE}/api/auth/logout`, {
				method: "POST",
				credentials: "include",
			});

			if (!response.ok) {
				const errorText = await response.text();

				throw new Error(
					`Logout failed. ${response.status}: ${errorText}`
				);
			}

			router.replace("/login");
			router.refresh();
		} catch (error) {
			console.error("Logout request failed:", error);

			alert(
				"OviCore could not sign you out because the backend connection failed."
			);

			setLoggingOut(false);
		}
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