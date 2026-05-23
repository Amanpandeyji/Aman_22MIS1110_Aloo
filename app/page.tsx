import { ProductCatalog } from '@/components/product-catalog';
import { getCatalog } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await getCatalog();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-glow backdrop-blur-md sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Allo inventory reservations</p>
          <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
            Hold stock at checkout without overselling the last unit.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Reservations temporarily lock units for a checkout window, then either confirm into a sale or release back into available inventory.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Flow</div>
            <div className="mt-2 text-sm text-white">Reserve, confirm, or release in one pass.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Concurrency</div>
            <div className="mt-2 text-sm text-white">Row locks guarantee exactly one winner for the last unit.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Expiry</div>
            <div className="mt-2 text-sm text-white">Expired holds are released automatically.</div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <ProductCatalog products={products} />
      </section>
    </main>
  );
}