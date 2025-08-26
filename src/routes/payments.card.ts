import { Router } from "express";
import { prisma } from "../lib/prisma";
import { CardPaymentSchema } from "../lib/schemas";
import { evaluateCardRisk } from "../lib/antifraud";
import { validateBody } from "../lib/validate"

const router = Router();

router.post("/", validateBody(CardPaymentSchema), async (req, res) => {
    const { 
        productId, customer, token, last4, brand, exp, holder, jti, iat, expAt,
    } = req.body as typeof CardPaymentSchema._type;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if(!product) return res.status(404).json({ error: "product_not_found" });
    const amountCents = product.priceCents;

    const tokenUsed = await prisma.payment.findFirst({ where: { token } });
    if (tokenUsed) {
        return res.status(400).json({ error: "token_already_used" });
    }
    if(Date.now() > expAt) {
        return res.status(400).json({ error: "token_expired" });
    }

    const order = await prisma.order.create({
        data: {
        productId: product.id,
        amountCents,
        method: "CARD",
        status: "PENDING",
        customerName: customer.name,
        customerEmail: customer.email,
        customerCpf: customer.cpf,
        customerPhone: customer.phone,
        },
    });

    const risk = evaluateCardRisk({
        amountCents,
        cpf: customer.cpf,
        email: customer.email,
        last4,
        brand,
    });

    const finalStatus = risk.decision === "APPROVED" ? "APPROVED" : "DECLINED";

    const payment = await prisma.payment.create({
        data: {
        orderId: order.id,
        method: "CARD",
        status: finalStatus,
        last4,
        brand,
        token,
        },
    });

    await prisma.order.update({
        where: { id: order.id },
        data: { status: finalStatus },
    });

    res.status(201).json({
        orderId: order.id,
        paymentId: payment.id,
        status: finalStatus,
        reason: risk.reason,
    });
});

export default router;