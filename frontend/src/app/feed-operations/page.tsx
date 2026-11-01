import Link from "next/link";
import styles from "./page.module.css";

const primarySections = [
  {
    number: "01",
    title: "Mill Management",
    description: "Mill register, mill-specific ration SKUs, descriptions and pricing.",
    href: "/feed-operations/mills",
    label: "MILL NETWORK",
  },
  {
    number: "02",
    title: "Feed Ordering",
    description: "Shed and flock orders using the mill assigned during flock setup.",
    href: "/feed-operations/orders",
    label: "FLOCK-BASED ORDERS",
  },
  {
    number: "03",
    title: "Feed Receiving",
    description: "Delivery dockets, actual tonnes, batches and silo allocation.",
    href: "/feed-operations/receiving",
    label: "DELIVERY CONTROL",
  },
];

const supportingSections = [
  {
    number: "04",
    title: "Ration Library",
    description: "Approved diets, life stages, base and medicated variants.",
    href: "/feed-operations/rations",
  },
  {
    number: "05",
    title: "Diet Ingredients",
    description: "Ingredient catalogue, nutritional specifications and inclusion rates.",
    href: "/feed-operations/ingredients",
  },
  {
    number: "06",
    title: "Feed Inventory",
    description: "Silo balances, usage and stock reconciliation.",
    href: "/feed-operations/inventory",
  },
];

export default function FeedOperationsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>OVICORE ECOSYSTEM / PLANNING &amp; OPERATIONS</p>
            <h1 className={styles.title}>Feed Operations</h1>
            <p className={styles.subtitle}>
              Mill management, shed-based feed ordering and feed receiving in one place.
            </p>
          </div>
          <Link className={styles.backLink} href="/home">Back to Modules <span aria-hidden="true">↗</span></Link>
        </header>

        <section aria-labelledby="core-heading" className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2 id="core-heading">Core Operations</h2>
            <span>3 workspaces</span>
          </div>
          <div className={styles.primaryGrid}>
            {primarySections.map((section) => (
              <Link key={section.href} href={section.href} className={styles.primaryCard}>
                <div className={styles.cardTop}>
                  <span className={styles.cardNumber}>{section.number}</span>
                  <span className={styles.cardLabel}>{section.label}</span>
                </div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <span className={styles.openText}>Open workspace <span aria-hidden="true">→</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="support-heading" className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2 id="support-heading">Feed Data &amp; Controls</h2>
            <span>3 supporting areas</span>
          </div>
          <div className={styles.supportGrid}>
            {supportingSections.map((section) => (
              <Link key={section.href} href={section.href} className={styles.supportCard}>
                <span className={styles.smallNumber}>{section.number}</span>
                <div className={styles.supportContent}>
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
                <span className={styles.arrow} aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>

        <aside className={styles.rule}>
          <strong>Ordering rule</strong>
          <span>
            Every feed order belongs to a shed and flock. The supplying mill is assigned during flock
            setup; different sheds on the same farm may have different mills.
          </span>
        </aside>
      </div>
    </main>
  );
}
