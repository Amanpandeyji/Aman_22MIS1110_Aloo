import { createHash } from 'crypto';
import { Prisma, PrismaClient, ReservationStatus, ReleaseReason } from '@prisma/client';
import { db } from '@/lib/db';

const RESERVATION_TTL_MINUTES = 10;

export type ApiResult<T> = {
  statusCode: number;
  body: T;
};

type MutationBody =
  | {
      reservation: ReservationView;
    }
  | {
      message: string;
    };

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  warehouses: Array<{
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    city: string;
    totalUnits: number;
    reservedUnits: number;
    availableUnits: number;
  }>;
};

export type ReservationView = {
  id: string;
  quantity: number;
  status: ReservationStatus;
  releaseReason: ReleaseReason;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
};

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function hashLockKey(value: string) {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 16);
  return BigInt.asIntN(63, BigInt(`0x${digest}`));
}

function getDbSchema() {
  try {
    return new URL(process.env.DATABASE_URL ?? '').searchParams.get('schema') ?? 'public';
  } catch {
    return 'public';
  }
}

const dbSchema = getDbSchema().replace(/"/g, '""');
const inventoryStocksTable = Prisma.raw(`"${dbSchema}"."inventory_stocks"`);
const reservationsTable = Prisma.raw(`"${dbSchema}"."reservations"`);
const productsTable = Prisma.raw(`"${dbSchema}"."products"`);
const warehousesTable = Prisma.raw(`"${dbSchema}"."warehouses"`);
const transactionOptions = {
  maxWait: 10_000,
  timeout: 20_000
} as const;

function reservationView(row: {
  id: string;
  quantity: number;
  status: ReservationStatus;
  releaseReason: ReleaseReason;
  expiresAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; code: string; name: string; city: string };
}): ReservationView {
  return {
    id: row.id,
    quantity: row.quantity,
    status: row.status,
    releaseReason: row.releaseReason,
    expiresAt: row.expiresAt.toISOString(),
    confirmedAt: toIso(row.confirmedAt),
    releasedAt: toIso(row.releasedAt),
    product: row.product,
    warehouse: row.warehouse
  };
}

export async function cleanupExpiredReservationsTx(tx: Prisma.TransactionClient) {
  const expired = await tx.reservation.findMany({
    where: {
      status: ReservationStatus.PENDING,
      expiresAt: { lte: new Date() }
    },
    select: {
      id: true,
      quantity: true,
      productId: true,
      warehouseId: true
    }
  });

  for (const reservation of expired) {
    await tx.inventoryStock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId
        }
      },
      data: {
        reservedUnits: { decrement: reservation.quantity }
      }
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.RELEASED,
        releaseReason: ReleaseReason.EXPIRED,
        releasedAt: new Date()
      }
    });
  }

  return expired.length;
}

export async function cleanupExpiredReservations() {
  return db.$transaction(async (tx) => cleanupExpiredReservationsTx(tx), transactionOptions);
}

async function safeCleanupExpiredReservations() {
  try {
    return await cleanupExpiredReservations();
  } catch (error) {
    console.warn('Skipping expired reservation cleanup after a database error.', error);
    return 0;
  }
}

async function safeCleanupExpiredReservationsTx(tx: Prisma.TransactionClient) {
  try {
    return await cleanupExpiredReservationsTx(tx);
  } catch (error) {
    console.warn('Skipping expired reservation cleanup inside transaction.', error);
    return 0;
  }
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  try {
    await safeCleanupExpiredReservations();

    const products = await db.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        stocks: {
          include: { warehouse: true },
          orderBy: { warehouse: { name: 'asc' } }
        }
      }
    });

    return products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      warehouses: product.stocks.map((stock) => ({
        warehouseId: stock.warehouseId,
        warehouseCode: stock.warehouse.code,
        warehouseName: stock.warehouse.name,
        city: stock.warehouse.city,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
        availableUnits: stock.totalUnits - stock.reservedUnits
      }))
    }));
  } catch (error) {
    console.error('Unable to load catalog, returning an empty list.', error);
    return [];
  }
}

export async function listWarehouses() {
  try {
    await safeCleanupExpiredReservations();

    return await db.warehouse.findMany({
      orderBy: { name: 'asc' }
    });
  } catch (error) {
    console.error('Unable to load warehouses, returning an empty list.', error);
    return [];
  }
}

export async function getReservationById(id: string): Promise<ReservationView | null> {
  let reservation;

  try {
    reservation = await db.reservation.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, sku: true, name: true }
        },
        warehouse: {
          select: { id: true, code: true, name: true, city: true }
        }
      }
    });
  } catch (error) {
    console.error('Unable to load reservation, treating it as missing.', error);
    return null;
  }

  if (!reservation) {
    return null;
  }

  return reservationView(reservation);
}

async function withIdempotency<T>(
  tx: Prisma.TransactionClient,
  operation: string,
  key: string | null,
  handler: () => Promise<ApiResult<T>>
): Promise<ApiResult<T>> {
  if (!key) {
    return handler();
  }

  const lockKey = hashLockKey(`${operation}:${key}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

  const existing = await tx.idempotencyRecord.findUnique({
    where: {
      operation_idempotencyKey: {
        operation,
        idempotencyKey: key
      }
    }
  });

  if (existing) {
    return {
      statusCode: existing.statusCode,
      body: existing.responseBody as T
    };
  }

  const result = await handler();

  await tx.idempotencyRecord.create({
    data: {
      operation,
      idempotencyKey: key,
      statusCode: result.statusCode,
      responseBody: result.body as Prisma.InputJsonValue
    }
  });

  return result;
}

export async function reserveInventory(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  idempotencyKey: string | null;
}): Promise<ApiResult<MutationBody>> {
  return db.$transaction(async (tx) => {
    return withIdempotency<MutationBody>(tx, 'reserve', input.idempotencyKey, async () => {
      await safeCleanupExpiredReservationsTx(tx);

      const lockRows = await tx.$queryRaw<Array<{ id: string; totalUnits: number; reservedUnits: number }>>
        `SELECT id, "totalUnits", "reservedUnits"
         FROM ${inventoryStocksTable}
         WHERE "productId" = ${input.productId} AND "warehouseId" = ${input.warehouseId}
         FOR UPDATE`;

      const stock = lockRows[0];
      if (!stock) {
        return {
          statusCode: 404,
          body: { message: 'Stock record not found.' }
        };
      }

      const availableUnits = stock.totalUnits - stock.reservedUnits;
      if (availableUnits < input.quantity) {
        return {
          statusCode: 409,
          body: { message: 'Not enough stock available for that reservation.' }
        };
      }

      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: { reservedUnits: { increment: input.quantity } }
      });

      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      const reservation = await tx.reservation.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
          expiresAt
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true, city: true } }
        }
      });

      return {
        statusCode: 201,
        body: { reservation: reservationView(reservation) }
      };
    });
  }, transactionOptions);
}

async function lockReservation(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      productId: string;
      warehouseId: string;
      quantity: number;
      status: ReservationStatus;
      releaseReason: ReleaseReason;
      expiresAt: Date;
      confirmedAt: Date | null;
      releasedAt: Date | null;
      product: { id: string; sku: string; name: string };
      warehouse: { id: string; code: string; name: string; city: string };
    }>
  >`SELECT r.id,
        r."productId",
        r."warehouseId",
        r.quantity,
        r.status,
        r."releaseReason",
        r."expiresAt",
        r."confirmedAt",
        r."releasedAt",
        jsonb_build_object('id', p.id, 'sku', p.sku, 'name', p.name) AS product,
        jsonb_build_object('id', w.id, 'code', w.code, 'name', w.name, 'city', w.city) AS warehouse
      FROM ${reservationsTable} r
      INNER JOIN ${productsTable} p ON p.id = r."productId"
      INNER JOIN ${warehousesTable} w ON w.id = r."warehouseId"
      WHERE r.id = ${id}
      FOR UPDATE`;

  return rows[0] ?? null;
}

export async function confirmReservation(input: {
  id: string;
  idempotencyKey: string | null;
}): Promise<ApiResult<MutationBody>> {
  return db.$transaction(async (tx) => {
    return withIdempotency<MutationBody>(tx, 'confirm', input.idempotencyKey, async () => {
      const reservation = await lockReservation(tx, input.id);
      if (!reservation) {
        return {
          statusCode: 404,
          body: { message: 'Reservation not found.' }
        };
      }

      if (reservation.status === ReservationStatus.CONFIRMED) {
        return {
          statusCode: 200,
          body: { reservation: reservationView(reservation) }
        };
      }

      if (reservation.status === ReservationStatus.RELEASED) {
        return {
          statusCode: reservation.releaseReason === ReleaseReason.EXPIRED ? 410 : 409,
          body: { message: 'Reservation is no longer pending.' }
        };
      }

      if (reservation.expiresAt <= new Date()) {
        await tx.inventoryStock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId
            }
          },
          data: {
            reservedUnits: { decrement: reservation.quantity }
          }
        });

        const expired = await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: ReservationStatus.RELEASED,
            releaseReason: ReleaseReason.EXPIRED,
            releasedAt: new Date()
          },
          include: {
            product: { select: { id: true, sku: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true, city: true } }
          }
        });

        return {
          statusCode: 410,
          body: { message: 'Reservation has expired.' }
        };
      }

      await tx.inventoryStock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId
          }
        },
        data: {
          reservedUnits: { decrement: reservation.quantity },
          totalUnits: { decrement: reservation.quantity }
        }
      });

      const confirmed = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CONFIRMED,
          releaseReason: ReleaseReason.NONE,
          confirmedAt: new Date()
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true, city: true } }
        }
      });

      return {
        statusCode: 200,
        body: { reservation: reservationView(confirmed) }
      };
    });
  }, transactionOptions);
}

export async function releaseReservation(input: {
  id: string;
  reason: ReleaseReason;
}): Promise<ApiResult<MutationBody>> {
  return db.$transaction(async (tx) => {
    const reservation = await lockReservation(tx, input.id);
    if (!reservation) {
      return {
        statusCode: 404,
        body: { message: 'Reservation not found.' }
      };
    }

    if (reservation.status === ReservationStatus.CONFIRMED) {
      return {
        statusCode: 200,
        body: { reservation: reservationView(reservation) }
      };
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      return {
        statusCode: reservation.releaseReason === ReleaseReason.EXPIRED ? 410 : 200,
        body: { message: 'Reservation is already released.' }
      };
    }

    if (reservation.expiresAt <= new Date()) {
      await tx.inventoryStock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId
          }
        },
        data: {
          reservedUnits: { decrement: reservation.quantity }
        }
      });

      const expired = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.RELEASED,
          releaseReason: ReleaseReason.EXPIRED,
          releasedAt: new Date()
        },
        include: {
          product: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true, city: true } }
        }
      });

      return {
        statusCode: 410,
        body: { message: 'Reservation has expired.' }
      };
    }

    await tx.inventoryStock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId
        }
      },
      data: {
        reservedUnits: { decrement: reservation.quantity }
      }
    });

    const released = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.RELEASED,
        releaseReason: input.reason,
        releasedAt: new Date()
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true, city: true } }
      }
    });

    return {
      statusCode: 200,
      body: { reservation: reservationView(released) }
    };
  }, transactionOptions);
}

export function toCatalogSummary(products: CatalogProduct[]) {
  return {
    products,
    totals: {
      products: products.length,
      warehouses: new Set(products.flatMap((product) => product.warehouses.map((warehouse) => warehouse.warehouseId))).size
    }
  };
}