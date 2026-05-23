import 'dotenv/config';
import { PrismaClient, ReleaseReason, ReservationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.idempotencyRecord.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.inventoryStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const createdWarehouses = await Promise.all([
    prisma.warehouse.create({ data: { code: 'BLR-01', name: 'Bangalore Fulfillment Hub', city: 'Bengaluru' } }),
    prisma.warehouse.create({ data: { code: 'DEL-01', name: 'Delhi NCR Forward Stock', city: 'Gurugram' } }),
    prisma.warehouse.create({ data: { code: 'MUM-01', name: 'Mumbai West Coast DC', city: 'Mumbai' } })
  ]);

  const createdProducts = await Promise.all([
    prisma.product.create({
      data: {
        sku: 'ALLO-TSHIRT-001',
        name: 'Allo Core Tee',
        description: 'Soft cotton tee that moves quickly across the network.'
      }
    }),
    prisma.product.create({
      data: {
        sku: 'ALLO-BOTTLE-002',
        name: 'Allo Steel Bottle',
        description: 'Insulated bottle with solid margin and consistent demand.'
      }
    }),
    prisma.product.create({
      data: {
        sku: 'ALLO-HOODIE-003',
        name: 'Allo Hoodie',
        description: 'Heavier item with lower stock and frequent reservation pressure.'
      }
    })
  ]);

  await prisma.inventoryStock.createMany({
    data: [
      { productId: createdProducts[0].id, warehouseId: createdWarehouses[0].id, totalUnits: 24, reservedUnits: 0 },
      { productId: createdProducts[0].id, warehouseId: createdWarehouses[1].id, totalUnits: 12, reservedUnits: 0 },
      { productId: createdProducts[0].id, warehouseId: createdWarehouses[2].id, totalUnits: 18, reservedUnits: 0 },
      { productId: createdProducts[1].id, warehouseId: createdWarehouses[0].id, totalUnits: 10, reservedUnits: 0 },
      { productId: createdProducts[1].id, warehouseId: createdWarehouses[1].id, totalUnits: 6, reservedUnits: 0 },
      { productId: createdProducts[1].id, warehouseId: createdWarehouses[2].id, totalUnits: 8, reservedUnits: 0 },
      { productId: createdProducts[2].id, warehouseId: createdWarehouses[0].id, totalUnits: 4, reservedUnits: 0 },
      { productId: createdProducts[2].id, warehouseId: createdWarehouses[1].id, totalUnits: 3, reservedUnits: 0 },
      { productId: createdProducts[2].id, warehouseId: createdWarehouses[2].id, totalUnits: 5, reservedUnits: 0 }
    ]
  });

  await prisma.reservation.create({
    data: {
      productId: createdProducts[0].id,
      warehouseId: createdWarehouses[0].id,
      quantity: 1,
      status: ReservationStatus.PENDING,
      releaseReason: ReleaseReason.NONE,
      expiresAt: new Date(Date.now() + 8 * 60 * 1000)
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });