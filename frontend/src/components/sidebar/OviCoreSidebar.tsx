"use client";

import Image from "next/image";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
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

type CompanyRow = {
  id: number;
  company_name: string;
  trading_name?: string | null;
  active: boolean;
};

type OviCoreSidebarProps = {
  menu: SidebarMenuConfig;
  defaultCollapsed?: boolean;
};

const SELECTED_COMPANY_STORAGE_KEY =
  "ovicore_selected_company_id";

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
  return hasRoleAccess(
    item.allowedRoles,
    role
  );
}

function isSectionVisible(
  section: SidebarMenuSection,
  role: OviCoreUserRole
) {
  if (
    !hasRoleAccess(
      section.allowedRoles,
      role
    )
  ) {
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
  const cleanHref = href.split("?")[0];

  if (cleanHref === "/home") {
    return pathname === "/home";
  }

  if (
    cleanHref === "/breeders" ||
    cleanHref === "/broilers" ||
    cleanHref === "/hatchery" ||
    cleanHref === "/layers" ||
    cleanHref === "/processing" ||
    cleanHref === "/admin"
  ) {
    return pathname === cleanHref;
  }

  return (
    pathname === cleanHref ||
    pathname.startsWith(
      `${cleanHref}/`
    )
  );
}

function buildCompanyHref(
  href: string,
  companyId: number | null,
  isGlobalAdmin: boolean
) {
  if (
    !isGlobalAdmin ||
    !companyId ||
    href === "/home" ||
    href.startsWith("/admin")
  ) {
    return href;
  }

  const separator =
    href.includes("?") ? "&" : "?";

  return `${href}${separator}company_id=${companyId}`;
}

export default function OviCoreSidebar({
  menu,
  defaultCollapsed = true,
}: OviCoreSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const sidebarRef =
    useRef<HTMLElement | null>(null);

  const [collapsed, setCollapsed] =
    useState(defaultCollapsed);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [companies, setCompanies] =
    useState<CompanyRow[]>([]);

  const [
    selectedCompanyId,
    setSelectedCompanyId,
  ] = useState<number | null>(null);

  const [
    companiesLoading,
    setCompaniesLoading,
  ] = useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const role = useMemo(
    () => getUserRole(currentUser),
    [currentUser]
  );

  const visibleSections = useMemo(() => {
    return menu.sections
      .filter((section) =>
        isSectionVisible(
          section,
          role
        )
      )
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            isItemVisible(
              item,
              role
            )
        ),
      }));
  }, [
    menu.sections,
    role,
  ]);

  const loadCurrentUser =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/auth/me",
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
          console.error(
            "Could not load current user.",
            response.status
          );
          return;
        }

        const data: CurrentUser =
          await response.json();

        setCurrentUser(data);

        if (
          !data.is_global_admin &&
          data.company_id
        ) {
          setSelectedCompanyId(
            data.company_id
          );
        }
      } catch (error) {
        console.error(
          "Could not load current user.",
          error
        );
      }
    }, [router]);

  const loadCompanies =
    useCallback(async () => {
      if (
        !currentUser?.is_global_admin
      ) {
        return;
      }

      setCompaniesLoading(true);

      try {
        const response = await fetch(
          "/api/access/companies",
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
          console.error(
            "Could not load companies.",
            response.status
          );
          return;
        }

        const data: CompanyRow[] =
          await response.json();

        const activeCompanies =
          data.filter(
            (company) =>
              company.active
          );

        setCompanies(activeCompanies);

        const searchParams =
          new URLSearchParams(
            window.location.search
          );

        const companyIdFromUrl =
          Number(
            searchParams.get(
              "company_id"
            )
          );

        const rememberedCompanyId =
          Number(
            window.localStorage.getItem(
              SELECTED_COMPANY_STORAGE_KEY
            )
          );

        const urlCompanyIsValid =
          activeCompanies.some(
            (company) =>
              company.id ===
              companyIdFromUrl
          );

        const rememberedCompanyIsValid =
          activeCompanies.some(
            (company) =>
              company.id ===
              rememberedCompanyId
          );

        const resolvedCompanyId =
          urlCompanyIsValid
            ? companyIdFromUrl
            : rememberedCompanyIsValid
              ? rememberedCompanyId
              : activeCompanies[0]
                  ?.id ?? null;

        setSelectedCompanyId(
          resolvedCompanyId
        );

        if (resolvedCompanyId) {
          window.localStorage.setItem(
            SELECTED_COMPANY_STORAGE_KEY,
            String(
              resolvedCompanyId
            )
          );

          const isAdminPage =
            pathname === "/admin" ||
            pathname.startsWith(
              "/admin/"
            );

          const isHomePage =
            pathname === "/home";

          if (
            !isAdminPage &&
            !isHomePage &&
            !urlCompanyIsValid
          ) {
            searchParams.set(
              "company_id",
              String(
                resolvedCompanyId
              )
            );

            router.replace(
              `${pathname}?${searchParams.toString()}`
            );
          }
        }
      } catch (error) {
        console.error(
          "Could not load companies.",
          error
        );
      } finally {
        setCompaniesLoading(false);
      }
    }, [
      currentUser?.is_global_admin,
      pathname,
      router,
    ]);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (
      currentUser?.is_global_admin
    ) {
      void loadCompanies();
    }
  }, [
    currentUser?.is_global_admin,
    loadCompanies,
  ]);

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent | TouchEvent
    ) => {
      if (collapsed) {
        return;
      }

      const target = event.target;

      if (
        !(target instanceof Node)
      ) {
        return;
      }

      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(
          target
        )
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

  const changeCompany =
    useCallback(
      (companyId: number) => {
        if (
          !Number.isInteger(
            companyId
          ) ||
          companyId <= 0
        ) {
          return;
        }

        setSelectedCompanyId(
          companyId
        );

        window.localStorage.setItem(
          SELECTED_COMPANY_STORAGE_KEY,
          String(companyId)
        );

        const isAdminPage =
          pathname === "/admin" ||
          pathname.startsWith(
            "/admin/"
          );

        const isHomePage =
          pathname === "/home";

        if (
          isAdminPage ||
          isHomePage
        ) {
          return;
        }

        const searchParams =
          new URLSearchParams(
            window.location.search
          );

        searchParams.set(
          "company_id",
          String(companyId)
        );

        router.replace(
          `${pathname}?${searchParams.toString()}`
        );

        router.refresh();
      },
      [
        pathname,
        router,
      ]
    );

  const logout =
    useCallback(async () => {
      setLoggingOut(true);

      try {
        await fetch(
          "/api/auth/logout",
          {
            method: "POST",
            credentials: "include",
          }
        );
      } catch (error) {
        console.error(
          "Logout failed.",
          error
        );
      } finally {
        window.localStorage.removeItem(
          SELECTED_COMPANY_STORAGE_KEY
        );

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

  const selectedCompany =
    companies.find(
      (company) =>
        company.id ===
        selectedCompanyId
    ) ?? null;

  return (
    <>
      <aside
        ref={sidebarRef}
        className={[
          styles.sidebar,
          collapsed
            ? styles.collapsed
            : "",
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

            setCollapsed(
              (current) =>
                !current
            );
          }}
          aria-label={
            collapsed
              ? "Open navigation"
              : "Close navigation"
          }
          aria-expanded={
            !collapsed
          }
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
          <div
            className={
              styles.brand
            }
          >
            <Image
              src="/assets/ovicore-icon.png"
              alt="OviCore"
              width={60}
              height={60}
              className={
                styles.logo
              }
              priority
            />

            <div
              className={
                styles.brandText
              }
            >
              <h1
                className={
                  styles.brandTitle
                }
              >
                {menu.title}
              </h1>

              <div
                className={
                  styles.brandSubtitle
                }
              >
                {menu.subtitle}
              </div>
            </div>
          </div>

          {role ===
            "global_admin" &&
          companies.length > 0 ? (
            <div
              style={{
                margin:
                  "4px 10px 14px",
                padding: "10px",
                borderRadius:
                  "10px",
                background:
                  "rgba(255, 255, 255, 0.08)",
              }}
            >
              <label
                style={{
                  display:
                    "block",
                  marginBottom:
                    "6px",
                  color:
                    "#dff4e9",
                  fontSize:
                    "10px",
                  fontWeight:
                    800,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Working company
              </label>

              <select
                value={
                  selectedCompanyId ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  changeCompany(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                disabled={
                  companiesLoading
                }
                style={{
                  width: "100%",
                  minHeight:
                    "36px",
                  padding:
                    "7px 9px",
                  borderRadius:
                    "8px",
                  border:
                    "1px solid rgba(255,255,255,0.25)",
                  background:
                    "#ffffff",
                  color:
                    "#073f32",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                }}
              >
                {companies.map(
                  (company) => (
                    <option
                      key={
                        company.id
                      }
                      value={
                        company.id
                      }
                    >
                      {
                        company.company_name
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          ) : null}

          <nav
            className={
              styles.navigation
            }
          >
            {visibleSections.map(
              (section) => (
                <section
                  key={
                    section.title
                  }
                  className={
                    styles.section
                  }
                >
                  <div
                    className={
                      styles.sectionTitle
                    }
                  >
                    {
                      section.title
                    }
                  </div>

                  {section.items.map(
                    (item) => {
                      const itemHref =
                        buildCompanyHref(
                          item.href,
                          selectedCompanyId,
                          role ===
                            "global_admin"
                        );

                      const active =
                        isActiveRoute(
                          pathname,
                          item.href
                        );

                      return (
                        <Link
                          key={
                            item.href
                          }
                          href={
                            itemHref
                          }
                          className={[
                            styles.link,
                            active
                              ? styles.active
                              : "",
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " "
                            )}
                        >
                          <span
                            className={
                              styles.dot
                            }
                          />

                          <span>
                            {
                              item.label
                            }
                          </span>

                          {item.badge ? (
                            <span
                              className={
                                styles.badge
                              }
                            >
                              {
                                item.badge
                              }
                            </span>
                          ) : null}
                        </Link>
                      );
                    }
                  )}
                </section>
              )
            )}
          </nav>

          <div
            className={
              styles.footer
            }
          >
            <div
              className={
                styles.userName
              }
            >
              {currentUser?.full_name ??
                "OviCore User"}
            </div>

            <div
              className={
                styles.userMeta
              }
            >
              {roleLabel}

              {role ===
                "global_admin" &&
              selectedCompany
                ? ` · ${selectedCompany.company_name}`
                : currentUser?.company_name
                  ? ` · ${currentUser.company_name}`
                  : ""}
            </div>

            <button
              type="button"
              className={
                styles.logout
              }
              onClick={logout}
              disabled={
                loggingOut
              }
            >
              <span
                className={
                  styles.logoutIcon
                }
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