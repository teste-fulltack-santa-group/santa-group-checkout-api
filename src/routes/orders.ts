import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";

const router = Router();
const params = z.object({ id: z.string().min(1, "ID is required") });

router.get("/:id/status", async (req, res) => {
    const parsed = params.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "invalid_id" });

    const order = await prisma.order.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
    });

    if(!order) return res.status(404).json({ error: "order_not_found" });
    res.json({ status: order.status });
});

router.get("/:id", async (req, res) => {
    const parsed = params.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "invalid_id" });

    const order = await prisma.order.findUnique({
        where: { id: parsed.data.id },
        include: {
            product: { select: { id: true, name: true, priceCents: true, seller: true } },
            payments: {
                select: {
                    id: true,
                    method: true,
                    status: true,
                    last4: true,
                    brand: true,
                    txid: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!order) return res.status(404).json({ error: "order_not_found" });
    res.json({
        id: order.id,
        status: order.status,
        amountCents: order.amountCents,
        method: order.method,
        product: order.product,
        customer: {
            name: order.customerName,
            email: order.customerEmail,
            cpf: order.customerCpf,
            phone: order.customerPhone,
        },
        payments: order.payments,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    });
});

export default router;