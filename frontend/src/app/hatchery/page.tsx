import Link from "next/link";

export default function HatcheryPage() {
  return (
    <main className="module-placeholder-shell">
      <section className="module-placeholder-card">
        <p className="eyebrow">Eggs to Chicks</p>
        <h1>Hatchery</h1>
        <p>
          Hatchery planning will manage egg receiving, setters, fertility,
          hatchability, chick output, and weekly chick availability into Broilers.
        </p>

        <Link href="/home">Back to OviCore Home</Link>
      </section>
    </main>
  );
}