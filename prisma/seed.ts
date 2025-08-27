import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const products = [
    { id: "p1", name: "Plano Premium",  priceCents: 19900, seller: "Santa Group Store" },
    { id: "p2", name: "Plano Starter",  priceCents:  9900, seller: "Santa Group Store" },
    { id: "p3", name: "Pack Moedas 1k", priceCents:  4900, seller: "Santa Group Store" },
  ];

  for (const p of products) {
    const r = await prisma.product.upsert({
      where:  { id: p.id },
      update: { name: p.name, priceCents: p.priceCents, seller: p.seller },
      create: p,
    });
    console.log("Upserted:", r.id);
  }

  const count = await prisma.product.count();
  console.log("Total products:", count);
}

main()
  .then(() => console.log("✅ Seed OK"))
  .catch((e) => {
    console.error("❌ Seed ERROR", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });