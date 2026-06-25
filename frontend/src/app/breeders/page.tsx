import Link from "next/link";

export default function BreedersPage() {
  return (
    <main className="module-placeholder-shell">
      <section className="module-placeholder-card">
        <p className="eyebrow">Parent Stock</p>
        <h1>Breeders</h1>
        <p>
          Breeder flock planning will manage fertility, hatch eggs, male/female
          performance, parent stock output, and supply into Hatchery.
        </p>

        <Link href="/home">Back to OviCore Home</Link>
      </section>
    </main>
  );
}