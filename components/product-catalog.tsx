"use client";

import clsx from 'clsx';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogProduct } from '@/lib/inventory';

type Props = {
  products: CatalogProduct[];
};

type ReservationResponse = {
  message?: string;
  reservation?: { id: string };
};

export function ProductCatalog({ products }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const stockRows = useMemo(
    () => products.flatMap((product) => product.warehouses.map((warehouse) => ({ product, warehouse }))),
    [products]
  );

  async function reserve(productId: string, warehouseId: string) {
    const quantityKey = `${productId}:${warehouseId}`;
    const quantity = quantities[quantityKey] ?? 1;
    setError(null);

    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, warehouseId, quantity })
    });

    const data = (await response.json()) as ReservationResponse;

    if (!response.ok || !data.reservation) {
      setError(data.message ?? 'Unable to reserve stock right now.');
      return;
    }

    const reservation = data.reservation;

    startTransition(() => {
      router.push(`/reservations/${reservation.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-glow backdrop-blur-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">{product.sku}</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{product.name}</h3>
                {product.description ? <p className="mt-2 text-sm leading-6 text-slate-300">{product.description}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-right text-xs text-slate-300">
                <div className="font-medium text-white">{product.warehouses.length} locations</div>
                <div className="mt-1 text-slate-400">inventory across the network</div>
              </div>
            </div>

            <div className="space-y-3">
              {product.warehouses.map((warehouse) => {
                const key = `${product.id}:${warehouse.warehouseId}`;
                const available = warehouse.availableUnits;
                const quantity = quantities[key] ?? 1;

                return (
                  <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{warehouse.warehouseName}</p>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          {warehouse.city} · {warehouse.warehouseCode}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">{available} available</span>
                        <span className="rounded-full bg-sky-400/15 px-3 py-1 text-sky-200">{warehouse.reservedUnits} reserved</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <label className="flex w-full max-w-[180px] flex-col gap-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                        Reserve quantity
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, available)}
                          value={quantity}
                          onChange={(event) => {
                            const next = Number(event.target.value || 1);
                            setQuantities((current) => ({ ...current, [key]: next }));
                          }}
                          className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/60"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={available <= 0 || isPending}
                        onClick={() => void reserve(product.id, warehouse.warehouseId)}
                        className={clsx(
                          'inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition',
                          available > 0 && !isPending
                            ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                            : 'cursor-not-allowed bg-white/10 text-slate-400'
                        )}
                      >
                        Reserve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {stockRows.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/6 p-8 text-center text-slate-300">
          No catalog data loaded yet. Check Vercel environment variables, run Prisma migrations, then seed the database.
        </div>
      ) : null}
    </div>
  );
}