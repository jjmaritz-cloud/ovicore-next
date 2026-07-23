"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "../../mobile.module.css";

export default function BreederRearingPage() {
  return (
    <main className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.brand}>
          <Image
            src="/assets/ovicore-icon.png"
            alt="OviCore"
            width={42}
            height={42}
            priority
          />
          <div>
            <strong>OviCore</strong>
            <small>Breeder Rearing</small>
          </div>
        </div>
      </header>

      <section className={`${styles.screen} ${styles.breederScreen}`}>
        <Link href="/mobile" className={styles.backButton}>
          ‹ Breeder workspace
        </Link>

        <div className={styles.screenTitle}>
          <small>BREEDER REARING</small>
          <h1>Rearing overview</h1>
          <p>
            Flock development, bodyweight, mortality, feed and upcoming
            transfers.
          </p>
        </div>

        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>🐣</div>
            <span>Active flocks</span>
            <strong>—</strong>
            <small>Connect breeder rearing data next</small>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>⚖</div>
            <span>Bodyweight</span>
            <strong>—</strong>
            <small>Actual versus standard</small>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>%</div>
            <span>Uniformity</span>
            <strong>—</strong>
            <small>Latest weighing result</small>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>↗</div>
            <span>Transfers</span>
            <strong>—</strong>
            <small>Upcoming flock movements</small>
          </article>
        </section>

        <div className={styles.moduleComingSoon}>
          The route is now active. The next build is the breeder rearing farm,
          flock and daily-entry data connection.
        </div>
      </section>
    </main>
  );
}
