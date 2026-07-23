"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "../../mobile.module.css";

export default function BreederProductionPage() {
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
            <small>Breeder Production</small>
          </div>
        </div>
      </header>

      <section className={`${styles.screen} ${styles.breederScreen}`}>
        <Link href="/mobile" className={styles.backButton}>
          ‹ Breeder workspace
        </Link>

        <div className={styles.screenTitle}>
          <small>BREEDER PRODUCTION</small>
          <h1>Production overview</h1>
          <p>
            Egg production, fertility, hatchability, mortality and flock
            performance.
          </p>
        </div>

        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>🥚</div>
            <span>Production</span>
            <strong>—</strong>
            <small>Hen-day production</small>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>%</div>
            <span>Fertility</span>
            <strong>—</strong>
            <small>Latest fertility result</small>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>✓</div>
            <span>Hatchability</span>
            <strong>—</strong>
            <small>Latest hatch result</small>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiIcon}>♡</div>
            <span>Mortality</span>
            <strong>—</strong>
            <small>Cumulative flock mortality</small>
          </article>
        </section>

        <div className={styles.moduleComingSoon}>
          The route is now active. The next build is the breeder production
          farm, flock and daily-entry data connection.
        </div>
      </section>
    </main>
  );
}
