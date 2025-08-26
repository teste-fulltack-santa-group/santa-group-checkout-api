import { Router } from "express";
import { prisma } from "../lib/prisma";
import { PixCreateSchema } from "../lib/schemas";
import { randomUUID } from "node:crypto";
// @ts-ignore
import QRCode from "qrcode";
import { validateBody } from "../lib/validate";

const router = Router();

router.post("/", validateBody(PixCreateSchema), async (req, res) => {
    const { productId, customer } = req.body as typeof PixCreateSchema._type;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if(!product) return res.status(404).json({ error: "product_not_found" });

    const amountCents = product.priceCents;
    const txid = randomUUID().replace(/-/g, "").slice(0, 25);
    const copyPaste = `BR.GOV.BCB.PIX|txid=${txid}|amount=${(amountCents / 100).toFixed(2)}`;

    const qrBase64 = await QRCode.toDataURL(copyPaste);

    const order = await prisma.order.create({
        data: {
            productId: product.id,
            amountCents,
            method: "PIX",
            status: "PENDING",
            customerName: customer.name,
            customerEmail: customer.email,
            customerCpf: customer.cpf,
            customerPhone: customer.phone,
        },
    });

    const payment = await prisma.pixPayment.create({
        data: {
            orderId: order.id,
            method: "PIX",
            status: "PENDING",
            txid,
            qrBase64,
            copyPaste,
        },
    });

    res.status(201).json({
        orderId: order.id,
        paymentId: payment.id,
        txid,
        qrBase64,
        copyPaste,
        status: "PENDING",
    });
});

export default router;