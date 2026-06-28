import Link from "next/link";

export default function AdminCompaniesPage() {
  return (
    <main className="admin-page">
      <section className="page-card">
        <p className="eyebrow">Global Admin</p>
        <h1>Company Setup</h1>
        <p>
          Create and manage OviCore customer companies. This page will connect
          to the Access API company endpoints next.
        </p>

        <div className="actions">
          <Link href="/admin">Back to Admin</Link>
          <Link href="/home">Home</Link>
        </div>
      </section>

      <style>{styles}</style>
    </main>
  );
}

const styles = `
  .admin-page {
    min-height: 100vh;
    padding: 24px;
    background: linear-gradient(135deg, #f6fbf8, #fbfaf3);
    color: #06251f;
  }

  .page-card {
    border: 1px solid rgba(6, 70, 56, 0.12);
    border-radius: 24px;
    padding: 24px;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 18px 42px rgba(2, 37, 29, 0.08);
  }

  .eyebrow {
    margin: 0;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #087052;
  }

  h1 {
    margin: 6px 0;
    font-size: 42px;
    letter-spacing: -0.06em;
  }

  p:not(.eyebrow) {
    margin: 0;
    max-width: 760px;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 800;
    color: #45635c;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 18px;
  }

  .actions a {
    border-radius: 999px;
    padding: 10px 13px;
    background: #073f34;
    color: white;
    font-size: 11px;
    font-weight: 950;
    text-decoration: none;
  }
`;