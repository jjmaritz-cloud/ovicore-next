"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./OviCoreSidebar.module.css";

import type {
  OviCoreUserRole,
  SidebarMenuConfig,
  SidebarMenuItem,
  SidebarMenuSection,
} from "./OviCoreSidebar.types";

type CurrentUser = {
  id: number;
  full_name: string;
  email: string;
  company_id: number | null;
  company_name?: string | null;
  is_global_admin: boolean;
  is_company_admin: boolean;
};

type OviCoreSidebarProps = {
  menu: SidebarMenuConfig;
  defaultCollapsed?: boolean;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8001";

function getUserRole(
  user: CurrentUser | null
): OviCoreUserRole {
  if (user?.is_global_admin) {
    return "global_admin";
  }

  if (user?.is_company_admin) {
    return "company_admin";
  }

  return "user";
}

function hasRoleAccess(
  allowedRoles: OviCoreUserRole[] | undefined,
  role: OviCoreUserRole
) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.includes(role);
}

function isItemVisible(
  item: SidebarMenuItem,
  role: OviCoreUserRole
) {
  return hasRoleAccess(item.allowedRoles, role);
}

function isSectionVisible(
  section: SidebarMenuSection,
  role: OviCoreUserRole
) {
  if (!hasRoleAccess(section.allowedRoles, role)) {
    return false;
  }

  return section.items.some((item) =>
    isItemVisible(item, role)
  );
}

function isActiveRoute(
  pathname: string,
  href: string
) {
  if (href === "/home") {
    return pathname === "/home";
  }

  if (
    href === "/breeders" ||
    href === "/broilers" ||
    href === "/hatchery" ||
    href === "/layers" ||
    href === "/processing" ||
    href === "/admin"
  ) {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export default function OviCoreSidebar({
  menu,
  defaultCollapsed = true,
}: OviCoreSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const sidebarRef = useRef<HTMLElement | null>(null);

  const [collapsed, setCollapsed] =
    useState(defaultCollapsed);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const role = useMemo(
    () => getUserRole(currentUser),
    [currentUser]
  );

  const visibleSections = useMemo(() => {
    return menu.sections
      .filter((section) =>
        isSectionVisible(section, role)
      )
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          isItemVisible(item, role)
        ),
      }));
  }, [menu.sections, role]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/auth/me`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        return;
      }

      const data: CurrentUser = await response.json();
      setCurrentUser(data);
    } catch (error) {
      console.error(
        "Could not load current user.",
        error
      );
    }
  }, [router]);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent | TouchEvent
    ) => {
      if (collapsed) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(target)
      ) {
        setCollapsed(true);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    document.addEventListener(
      "touchstart",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );

      document.removeEventListener(
        "touchstart",
        handlePointerDown
      );
    };
  }, [collapsed]);

  useEffect(() => {
    setCollapsed(true);
  }, [pathname]);

  const logout = useCallback(async () => {
    setLoggingOut(true);

    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed.", error);
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }, [router]);

  const roleLabel =
    role === "global_admin"
      ? "Global Admin"
      : role === "company_admin"
        ? "Company Admin"
        : "Farm User";

  return (
    <>
      <aside
        ref={sidebarRef}
        className={[
          styles.sidebar,
          collapsed ? styles.collapsed : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          className={[
            styles.toggle,
            collapsed
              ? styles.toggleCollapsed
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            setCollapsed((current) => !current);
          }}
          aria-label={
            collapsed
              ? "Open navigation"
              : "Close navigation"
          }
          aria-expanded={!collapsed}
        >
          {collapsed ? "☰" : "×"}
        </button>

        <div
          className={[
            styles.content,
            collapsed
              ? styles.contentHidden
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.brand}>
						<Image
							src="/assets/ovicore-icon.png"
							alt="OviCore"
							width={60}
							height={60}
							className={styles.logo}
							priority
						/>

            <div className={styles.brandText}>
              <h1 className={styles.brandTitle}>
                {menu.title}
              </h1>

              <div
                className={styles.brandSubtitle}
              >
                {menu.subtitle}
              </div>
            </div>
          </div>

          <nav className={styles.navigation}>
            {visibleSections.map((section) => (
              <section
                key={section.title}
                className={styles.section}
              >
                <div
                  className={styles.sectionTitle}
                >
                  {section.title}
                </div>

                {section.items.map((item) => {
                  const active = isActiveRoute(
                    pathname,
                    item.href
                  );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        styles.link,
                        active ? styles.active : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className={styles.dot} />

                      <span>{item.label}</span>

                      {item.badge ? (
                        <span
                          className={styles.badge}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </section>
            ))}
          </nav>

          <div className={styles.footer}>
            <div className={styles.userName}>
              {currentUser?.full_name ??
                "OviCore User"}
            </div>

            <div className={styles.userMeta}>
              {roleLabel}
              {currentUser?.company_name
                ? ` · ${currentUser.company_name}`
                : ""}
            </div>

						<button
							type="button"
							className={styles.logout}
							onClick={logout}
							disabled={loggingOut}
						>
							<span
								className={styles.logoutIcon}
								aria-hidden="true"
							>
								↪
							</span>

							<span>
								{loggingOut
									? "Logging out..."
									: "Logout"}
							</span>
						</button>
          </div>
        </div>
      </aside>
    </>
  );
}