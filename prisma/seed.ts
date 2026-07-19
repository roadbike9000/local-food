/**
 * Seed script — inserts sample data so the app is not empty on first run.
 * Run with: npm run db:seed
 *
 * It is safe to run more than once: we delete existing sample rows first.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data (children first because of foreign keys).
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.pickupSlot.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendor.deleteMany();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0); // 5:00 PM

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(19, 0, 0, 0); // 7:00 PM

  const bakery = await prisma.vendor.create({
    data: {
      clerkUserId: "seed_user_bakery", // replace with a real Clerk user id later
      name: "Corner Sourdough",
      slug: "corner-sourdough",
      description: "Naturally leavened breads baked fresh every weekend.",
      phone: "+15555550101",
      products: {
        create: [
          {
            name: "Classic Sourdough Loaf",
            description: "Crusty, tangy, 800g.",
            priceCents: 900,
          },
          {
            name: "Seeded Rye",
            description: "Caraway and sunflower seeds.",
            priceCents: 1100,
          },
          {
            name: "Cinnamon Morning Bun",
            description: "Laminated dough, sold by the half dozen.",
            priceCents: 1500,
          },
        ],
      },
      pickupSlots: {
        create: [
          {
            startsAt: tomorrow,
            endsAt: tomorrowEnd,
            capacity: 25,
            location: "12 Market St",
          },
        ],
      },
    },
  });

  const farm = await prisma.vendor.create({
    data: {
      clerkUserId: "seed_user_farm",
      name: "Green Valley Produce",
      slug: "green-valley-produce",
      description: "Seasonal vegetables from a 5-acre family farm.",
      phone: "+15555550102",
      products: {
        create: [
          {
            name: "Heirloom Tomato Box",
            description: "3 lbs, mixed varieties.",
            priceCents: 800,
          },
          {
            name: "Salad Greens Bag",
            description: "Freshly cut mixed lettuces.",
            priceCents: 600,
          },
        ],
      },
      pickupSlots: {
        create: [
          {
            startsAt: tomorrow,
            endsAt: tomorrowEnd,
            capacity: 30,
            location: "Farmers Market, Stall 7",
          },
        ],
      },
    },
  });

  console.log(`Seeded vendors: ${bakery.name}, ${farm.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
