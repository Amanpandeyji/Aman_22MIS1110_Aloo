"use client";

import clsx from 'clsx';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ReservationView } from '@/lib/inventory';

type Props = {
  reservation: ReservationView;
};

function formatTime(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function ReservationClient({ reservation: initialReservation }: Props) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [now, setNow] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = useMemo(() => {
    if (now === null) {
      return null;
    }

    return new Date(reservation.expiresAt).getTime() - now;
  }, [reservation.expiresAt, now]);

  const isExpired = reservation.status === 'PENDING' && remainingMs !== null && remainingMs <= 0;
  const expiresAtUtc = reservation.expiresAt.replace('T', ' ').replace('.000Z', ' UTC');

  async function postAction(path: string, body?: unknown) {
    setMessage(null);
    let response: Response;

    try {
      response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}'
      });
    } catch {
      setMessage('Network error. Please try again.');
      return false;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const raw = await response.text();
    let data: { message?: string; reservation?: ReservationView } = {};

    if (raw && contentType.includes('application/json')) {
      try {
        data = JSON.parse(raw) as { message?: string; reservation?: ReservationView };
      } catch {
        data = {};
      }
    }

    if (data.reservation) {
      setReservation(data.reservation);
      startTransition(() => router.refresh());
    }

    if (!response.ok) {
      setMessage(data.message ?? `The reservation request failed (${response.status}).`);
      return false;
    }

    return true;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-glow backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Reservation</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{reservation.product.name}</h1>
        <p className="mt-2 text-sm text-slate-300">
          {reservation.quantity} unit{reservation.quantity > 1 ? 's' : ''} held from {reservation.warehouse.name} in {reservation.warehouse.city}.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Status</div>
            <div className="mt-2 text-lg font-medium text-white">{reservation.status.toLowerCase()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Expires in</div>
            <div className={clsx('mt-2 text-lg font-medium', isExpired ? 'text-rose-300' : 'text-white')}>
              {remainingMs === null ? '--:--' : isExpired ? 'expired' : formatTime(remainingMs)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Reservation ID</div>
            <div className="mt-2 break-all text-sm font-medium text-white">{reservation.id}</div>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isPending || reservation.status !== 'PENDING'}
            onClick={() => void postAction(`/api/reservations/${reservation.id}/confirm`)}
            className={clsx(
              'rounded-xl px-4 py-3 text-sm font-medium transition',
              reservation.status === 'PENDING' && !isPending
                ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                : 'cursor-not-allowed bg-white/10 text-slate-400'
            )}
          >
            Confirm purchase
          </button>
          <button
            type="button"
            disabled={isPending || reservation.status !== 'PENDING'}
            onClick={() => void postAction(`/api/reservations/${reservation.id}/release`, { reason: 'user_cancelled' })}
            className={clsx(
              'rounded-xl border border-white/10 px-4 py-3 text-sm font-medium transition',
              reservation.status === 'PENDING' && !isPending
                ? 'bg-white/5 text-white hover:bg-white/10'
                : 'cursor-not-allowed bg-white/5 text-slate-500'
            )}
          >
            Cancel
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-400">
          {reservation.status === 'CONFIRMED'
            ? 'This reservation has been confirmed and the inventory was permanently decremented.'
            : reservation.status === 'RELEASED'
              ? 'This reservation has been released and the stock is available again.'
              : 'Keep this page open while payment is being processed. The hold expires automatically.'}
        </p>
      </section>

      <aside className="rounded-3xl border border-white/10 bg-slate-950/45 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">Fulfillment details</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="text-slate-400">Product</dt>
            <dd className="mt-1 text-white">{reservation.product.sku}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Warehouse</dt>
            <dd className="mt-1 text-white">{reservation.warehouse.name}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Expiry time (UTC)</dt>
            <dd className="mt-1 text-white">{expiresAtUtc}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Release reason</dt>
            <dd className="mt-1 text-white">{reservation.releaseReason.toLowerCase()}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}