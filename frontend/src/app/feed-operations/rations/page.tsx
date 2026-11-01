import Link from "next/link";

/** Starter placeholder. Wire this into existing OviCore auth, layout and APIs before production use. */
export default function Page() {
  return <main className="mx-auto max-w-5xl px-4 py-6 text-slate-900">
    <Link href="/feed-operations" className="text-sm text-amber-700 hover:underline">← Feed Operations</Link>
    <h1 className="mt-3 text-2xl font-bold">Ration Library</h1>
    <p className="mt-2 text-sm text-slate-600">Maintain canonical ration versions and controlled base/medicated diet variants.</p>
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">Starter scaffold — data forms and permissions are not yet connected.</div>
  </main>;
}
