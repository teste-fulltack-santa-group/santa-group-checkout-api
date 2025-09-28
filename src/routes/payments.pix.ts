import { Router } from "express";
import { prisma } from "../lib/prisma";
import { PixCreateSchema } from "../lib/schemas";
import { randomUUID } from "node:crypto";
// @ts-ignore
import QRCode from "qrcode";
import { validateBody } from "../lib/validate";
import {
  bodyHash, canonicalRoute, acquireIdempotency,
  finalizeIdempotency, releaseOnError, shouldCache, waitForFinalized
} from "../lib/idempotency";

const router = Router();

router.post("/", validateBody(PixCreateSchema), async (req, res, next) => {
  const key = req.get("Idempotency-Key") ?? null;
  const route = canonicalRoute(req);
  const hash = bodyHash(req.body);

  try {
    if (key) {
      const acq = await acquireIdempotency(key, req.method, route, hash);
      if (acq.action === "conflict")    return res.status(409).json({ error: "idempotency_key_conflict" });
      if (acq.action === "replay")      return res.status(acq.statusCode).json(acq.response);
      if (acq.action === "in_progress") {
        const done = await waitForFinalized(key, 1000, 50);
        if (done) return res.status(done.statusCode).json(done.response);
        return res.status(409).set("Retry-After", "1").json({ error: "idempotency_in_progress" });
      }
    }

    const { productId, customer } = req.body as typeof PixCreateSchema._type;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "product_not_found" });

    const amountCents = product.priceCents;

    const { payload, statusCode } = await prisma.$transaction(async (tx) => {
      const txid = randomUUID().replace(/-/g, "").slice(0, 25);
      const copyPaste = `BR.GOV.BCB.PIX|txid=${txid}|amount=${(amountCents / 100).toFixed(2)}`;
      const qrBase64 = await QRCode.toDataURL(copyPaste);

      const order = await tx.order.create({
        data: {
          productId: product.id,
          amountCents,
          method: "PIX",
          status: "PENDING",
          customerName:  customer.name,
          customerEmail: customer.email,
          customerCpf:   customer.cpf,
          customerPhone: customer.phone,
        },
      });

      const payment = await tx.payment.create({
        data: { orderId: order.id, method: "PIX", status: "PENDING", txid, qrBase64, copyPaste },
      });

      return {
        payload: {
          orderId: order.id,
          paymentId: payment.id,
          txid, qrBase64, copyPaste,
          status: "PENDING" as const,
          method: "PIX"   as const,
        },
        statusCode: 201 as const,
      };
    });

    if (key && shouldCache(statusCode)) {
      await finalizeIdempotency(key, statusCode, payload);
    }
    return res.status(statusCode).json(payload);
  } catch (err) {
    if (key) await releaseOnError(key);
    return next(err);
  }
});

export default router;
