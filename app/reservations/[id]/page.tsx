import { notFound } from 'next/navigation';
import { ReservationClient } from '@/components/reservation-client';
import { getReservationById } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = await getReservationById(id);

  if (!reservation) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Checkout hold</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Complete the purchase before the hold expires.</h1>
      </div>

      <ReservationClient reservation={reservation} />
    </main>
  );
}