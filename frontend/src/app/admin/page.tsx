import Link from "next/link";

const currentUser = {
  name: "JJ",
  isGlobalAdmin: true,
  isCompanyAdmin: true,
};

const globalAdminCards = [
  {
    title: "Company Setup",
    href: "/admin/companies",
    eyebrow: "Global Admin",
    description:
      "Create companies, activate/deactivate customers, and maintain customer setup.",
    signal: "Platform setup",
  },
  {
    title: "Farm Setup",
    href: "/admin/farms",
    eyebrow: "Global Admin",
    description:
      "Create and maintain farms as a controlled OviCore admin service.",
    signal: "Admin fee opportunity",
  },
  {
    title: "Shed Setup",
    href: "/admin/sheds",
    eyebrow: "Global Admin",
    description:
      "Add sheds, floor area, density defaults, and shed-level configuration.",
    signal: "Controlled setup",
  },
  {
    title: "System Users",
    href: "/admin/users",
    eyebrow: "Global Admin",
    description:
      "Create users, assign company access, and manage global/company admin status.",
    signal: "Access control",
  },
];

const companyAdminCards = [
  {
    title: "Farm User Access",
    href: "/admin/farm-access",
    eyebrow: "Company Admin",
    description:
      "Assign users to the farms they are allowed to view and maintain.",
    signal: "User farm access",
  },
  {
    title: "Flock Management",
    href: "/admin/flocks",
    eyebrow: "Company Admin",
    description:
      "Create new flocks, close completed flocks, and keep flock status clean.",
    signal: "Create / close flocks",
  },
];

export default function AdminHomePage() {
  const canSeeAdmin = currentUser.isGlobalAdmin || currentUser.isCompanyAdmin;

  if (!canSeeAdmin) {
    return (
      <main className="admin-shell">
        <section className="admin-locked">
          <p className="eyebrow">OviCore Administration</p>
          <h1>Admin access required</h1>
          <p>Your current user does not have access to the Admin module.</p>
          <Link href="/home">Return Home</Link>
        </section>

        <style dangerouslySetInnerHTML={{ __html: adminStyles }} />
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">OviCore Administration</p>
          <h1>Admin Command Centre</h1>
          <p>
            Manage companies, users, farm access, farms, sheds and flock setup
            from one controlled workspace.
          </p>
        </div>

        <div className="admin-user-card">
          <span>Signed in as</span>
          <strong>{currentUser.name}</strong>
          <p>{currentUser.isGlobalAdmin ? "Global Admin" : "Company Admin"}</p>
        </div>
      </section>

      <section className="admin-summary-grid">
        <article>
          <p>Access Model</p>
          <h2>Company → Farms → Users</h2>
          <span>Simple company separation with farm-level user access.</span>
        </article>

        <article>
          <p>Global Admin</p>
          <h2>Setup Control</h2>
          <span>Companies, farms and sheds stay under OviCore setup control.</span>
        </article>

        <article>
          <p>Company Admin</p>
          <h2>Flock Control</h2>
          <span>Company admins can create and close flocks.</span>
        </article>

        <article>
          <p>Standard Users</p>
          <h2>Assigned Farms</h2>
          <span>Users only see farms assigned to them.</span>
        </article>
      </section>

      {currentUser.isGlobalAdmin && (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Global Admin</p>
              <h2>Platform setup</h2>
            </div>
            <span>Visible to Global Admin only</span>
          </div>

          <div className="admin-card-grid">
            {globalAdminCards.map((card) => (
              <Link key={card.title} href={card.href} className="admin-card global">
                <p>{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <span>{card.description}</span>
                <strong>{card.signal}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}

      {currentUser.isCompanyAdmin && (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Company Admin</p>
              <h2>Operational admin</h2>
            </div>
            <span>Visible to Company Admin and Global Admin</span>
          </div>

          <div className="admin-card-grid two">
            {companyAdminCards.map((card) => (
              <Link key={card.title} href={card.href} className="admin-card company">
                <p>{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <span>{card.description}</span>
                <strong>{card.signal}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="admin-guidance">
        <div>
          <p className="eyebrow">Build Rule</p>
          <h2>Keep admin simple and controlled</h2>
          <p>
            Global Admin handles structural setup such as companies, farms and
            sheds. Company Admin handles users, farm access and flock open/close
            within their own company.
          </p>
        </div>

        <Link href="/home">Return to Home</Link>
      </section>

      <style dangerouslySetInnerHTML={{ __html: adminStyles }} />
    </main>
  );
}

const adminStyles = `
  .admin-shell {
    min-height: 100vh;
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(180, 255, 230, 0.38), transparent 32%),
      linear-gradient(135deg, #f6fbf8 0%, #fbfaf3 52%, #eef8f5 100%);
    color: #06251f;
  }

  .eyebrow {
    margin: 0;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #087052;
  }

  .admin-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 16px;
    align-items: stretch;
    margin-bottom: 14px;
  }

  .admin-hero > div:first-child,
  .admin-user-card,
  .admin-summary-grid article,
  .admin-section,
  .admin-guidance,
  .admin-locked {
    border: 1px solid rgba(6, 70, 56, 0.12);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 18px 42px rgba(2, 37, 29, 0.08);
    backdrop-filter: blur(12px);
  }

  .admin-hero > div:first-child {
    padding: 24px;
    background:
      radial-gradient(circle at top right, rgba(255, 246, 199, 0.25), transparent 32%),
      linear-gradient(135deg, #073f34, #0f7b64);
    color: white;
  }

  .admin-hero h1 {
    margin: 6px 0 0;
    max-width: 980px;
    font-size: clamp(34px, 4vw, 56px);
    line-height: 0.95;
    letter-spacing: -0.07em;
  }

  .admin-hero p:not(.eyebrow) {
    margin: 10px 0 0;
    max-width: 760px;
    font-size: 13px;
    font-weight: 850;
    color: rgba(255, 255, 255, 0.88);
  }

  .admin-hero .eyebrow {
    color: #bdf4df;
  }

  .admin-user-card {
    padding: 22px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .admin-user-card span {
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #60736e;
  }

  .admin-user-card strong {
    margin-top: 8px;
    font-size: 30px;
    letter-spacing: -0.06em;
  }

  .admin-user-card p {
    width: fit-content;
    margin: 10px 0 0;
    border-radius: 999px;
    padding: 7px 10px;
    background: #073f34;
    color: white;
    font-size: 10px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .admin-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .admin-summary-grid article {
    padding: 15px;
  }

  .admin-summary-grid p {
    margin: 0 0 5px;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #60736e;
  }

  .admin-summary-grid h2 {
    margin: 0;
    font-size: 21px;
    letter-spacing: -0.05em;
  }

  .admin-summary-grid span {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 800;
    color: #45635c;
  }

  .admin-section {
    padding: 18px;
    margin-bottom: 14px;
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 13px;
  }

  .section-heading h2 {
    margin: 3px 0 0;
    font-size: 24px;
    letter-spacing: -0.05em;
  }

  .section-heading > span {
    border-radius: 999px;
    padding: 7px 10px;
    background: #eff8f4;
    color: #0a604e;
    font-size: 10px;
    font-weight: 950;
    white-space: nowrap;
  }

  .admin-card-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .admin-card-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-card {
    min-height: 170px;
    border: 1px solid rgba(6, 70, 56, 0.12);
    border-radius: 18px;
    padding: 15px;
    text-decoration: none;
    color: #06251f;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 26px rgba(2, 37, 29, 0.06);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .admin-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 34px rgba(2, 37, 29, 0.1);
  }

  .admin-card.global {
    background:
      linear-gradient(135deg, rgba(231, 255, 244, 0.95), rgba(255, 255, 255, 0.92));
  }

  .admin-card.company {
    background:
      linear-gradient(135deg, rgba(255, 250, 225, 0.96), rgba(255, 255, 255, 0.92));
  }

  .admin-card p {
    margin: 0 0 8px;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #087052;
  }

  .admin-card h3 {
    margin: 0;
    font-size: 21px;
    letter-spacing: -0.05em;
  }

  .admin-card span {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.42;
    font-weight: 760;
    color: #365951;
  }

  .admin-card strong {
    margin-top: auto;
    width: fit-content;
    border-radius: 999px;
    padding: 7px 10px;
    background: #073f34;
    color: white;
    font-size: 10px;
    font-weight: 950;
  }

  .admin-guidance {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px;
  }

  .admin-guidance h2 {
    margin: 3px 0 0;
    font-size: 24px;
    letter-spacing: -0.05em;
  }

  .admin-guidance p:not(.eyebrow) {
    margin: 6px 0 0;
    max-width: 880px;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 800;
    color: #45635c;
  }

  .admin-guidance a,
  .admin-locked a {
    border-radius: 999px;
    padding: 10px 13px;
    background: #073f34;
    color: white;
    font-size: 11px;
    font-weight: 950;
    text-decoration: none;
    white-space: nowrap;
  }

  .admin-locked {
    max-width: 720px;
    margin: 70px auto;
    padding: 28px;
  }

  .admin-locked h1 {
    margin: 6px 0;
    font-size: 38px;
    letter-spacing: -0.06em;
  }

  .admin-locked p:not(.eyebrow) {
    margin: 0 0 18px;
    font-size: 13px;
    font-weight: 800;
    color: #45635c;
  }

  @media (max-width: 1200px) {
    .admin-summary-grid,
    .admin-card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .admin-shell {
      padding: 14px;
    }

    .admin-hero,
    .admin-summary-grid,
    .admin-card-grid,
    .admin-card-grid.two {
      grid-template-columns: 1fr;
    }

    .admin-guidance,
    .section-heading {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;