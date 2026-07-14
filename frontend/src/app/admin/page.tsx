import Link from "next/link";

import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";

const currentUser = {
  name: "JJ",
  isGlobalAdmin: true,
  isCompanyAdmin: true,
};

const globalAdminCards = [
  {
    title: "Companies",
    href: "/admin/companies",
    description:
      "Create companies, activate/deactivate customers, and maintain customer setup.",
    signal: "Platform setup",
  },
  {
    title: "Farms",
    href: "/admin/farms",
    description:
      "Create and maintain farms as a controlled OviCore admin setup service.",
    signal: "Admin fee opportunity",
  },
  {
    title: "Sheds",
    href: "/admin/sheds",
    description:
      "Add sheds, floor area, density defaults, and shed-level configuration.",
    signal: "Controlled setup",
  },
  {
    title: "Users & Access",
    href: "/admin/users",
    description:
      "Create users, assign company/farm access, and manage admin levels.",
    signal: "Access control",
  },
  {
    title: "Module Settings",
    href: "/admin/module-settings",
    description:
      "Control which modules are active for each company and setup package.",
    signal: "Configuration",
  },
  {
    title: "Support Mode",
    href: "/admin/support",
    description:
      "Controlled OviCore support access for setup, troubleshooting and audits.",
    signal: "Audited support",
  },
];

const companyAdminCards = [
  {
    title: "Flock Management",
    href: "/admin/flocks",
    description:
      "Create new flocks, close completed flocks, and keep flock status clean.",
    signal: "Create / close flocks",
  },
  {
    title: "Approvals",
    href: "/admin/approvals",
    description:
      "Review operational data locks, approvals and controlled corrections.",
    signal: "Workflow control",
  },
];

export default function AdminHomePage() {
  const canSeeAdmin = currentUser.isGlobalAdmin || currentUser.isCompanyAdmin;

  if (!canSeeAdmin) {
    return (
      <OviCoreShell module="admin">
        <OviCorePageHeader
          title="Admin access required"
          subtitle="Your current user does not have access to the Admin module."
        >
          <Link href="/home" className="ovicore-btn ovicore-btn-primary">
            Return Home
          </Link>
        </OviCorePageHeader>
      </OviCoreShell>
    );
  }

  return (
    <OviCoreShell module="admin">
      <OviCorePageHeader
        title="Admin Command Centre"
        subtitle="Controlled setup workspace for companies, farms, sheds, users, module settings and access control."
      >
        <span className="ovicore-pill ovicore-pill-green">
          {currentUser.isGlobalAdmin ? "Global Admin" : "Company Admin"}
        </span>
      </OviCorePageHeader>

      <OviCoreKpiStrip
        items={[
          { label: "Signed In", value: currentUser.name },
          {
            label: "Global Admin",
            value: currentUser.isGlobalAdmin ? "Yes" : "No",
          },
          {
            label: "Company Admin",
            value: currentUser.isCompanyAdmin ? "Yes" : "No",
          },
          { label: "Setup Control", value: "OviCore" },
        ]}
      />

      {currentUser.isGlobalAdmin ? (
        <OviCoreTableCard
          title="Global Admin Setup"
          subtitle="Setup actions controlled by OviCore Global Admin. These are the areas that can attract an admin/setup fee."
        >
          <div className="ovicore-admin-card-grid">
            {globalAdminCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="ovicore-admin-card"
              >
                <div>
                  <span className="ovicore-pill ovicore-pill-green">
                    Global Admin
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>

                <strong>{card.signal}</strong>
              </Link>
            ))}
          </div>
        </OviCoreTableCard>
      ) : null}

      {currentUser.isCompanyAdmin ? (
        <div style={{ marginTop: 12 }}>
          <OviCoreTableCard
            title="Company Admin Operations"
            subtitle="Operational admin actions inside the user's assigned company and farm access."
          >
            <div className="ovicore-admin-card-grid ovicore-admin-card-grid-two">
              {companyAdminCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="ovicore-admin-card ovicore-admin-card-company"
                >
                  <div>
                    <span className="ovicore-pill ovicore-pill-amber">
                      Company Admin
                    </span>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>

                  <strong>{card.signal}</strong>
                </Link>
              ))}
            </div>
          </OviCoreTableCard>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <OviCoreTableCard
          title="Admin Build Rule"
          subtitle="Keep setup-level work controlled, auditable and commercially recoverable."
        >
          <div className="ovicore-admin-guidance">
            <div>
              <h3>Global Admin controls structural setup.</h3>
              <p>
                Companies, farms, sheds, users, module settings and support
                access should stay under Global Admin / OviCore Admin control.
                Company Admin should operate within assigned company and farm
                access rather than creating duplicate setup records.
              </p>
            </div>

            <Link href="/broilers" className="ovicore-btn ovicore-btn-primary">
              Return to Broilers
            </Link>
          </div>
        </OviCoreTableCard>
      </div>
    </OviCoreShell>
  );
}