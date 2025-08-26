import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  res.json(products);
});

router.get("/:id", async (req, res) => {
  const { id } = req.params; // id é string (no nosso schema o Product.id é String)
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return res.status(404).json({ error: "product_not_found" });
  res.json(product);
});

export default router;
