import { Router } from "express";
import { prisma } from "../lib/prisma";
import { CardPaymentSchema } from "../lib/schemas";
import { evaluateCardRisk } from "../lib/antifraud";
import { validateBody } from "../lib/validate";
import { 
  bodyHash, canonicalRoute, shouldCache, waitForFinalized,
  acquireIdempotency, finalizeIdempotency, releaseOnError
} from "../lib/idempotency";

const router = Router();

router.post("/", validateBody(CardPaymentSchema), async (req, res, next) => {
    const key = req.get("Idempotency-Key") ?? null;
    const route = canonicalRoute(req);
    const hash = bodyHash(req.body);
    
    try {
        if(key) {
            const acq = await acquireIdempotency(key, req.method, route, hash);
            if (acq.action === "conflict") return res.status(409).json({ error: "idempotency_key_conflict" });
            if (acq.action === "replay") return res.status(acq.statusCode).json(acq.response);
            if (acq.action === "in_progress") {
                const done = await waitForFinalized(key, 1000, 50);
                if (done) return res.status(done.statusCode).json(done.response);
                return res.status(409).json({ error: "idempotency_in_progress" });
            }
        }

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

        const { payload, statusCode } = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
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

            const payment = await tx.payment.create({
                data: {
                    orderId: order.id,
                    method: "CARD",
                    status: finalStatus,
                    last4,
                    brand,
                    token,
                },
            });

            await tx.order.update({
                where: { id: order.id },
                data: { status: finalStatus },
            });

            return {
                payload: {
                    orderId: order.id,
                    paymentId: payment.id,
                    status: finalStatus,
                    reason: risk.reason,
                    method: "CARD" as const,
                },
                statusCode: 201 as const,
            };
        });

        if(key && shouldCache(statusCode)) {
            await finalizeIdempotency(key, statusCode, payload);
        }

        return res.status(statusCode).json(payload);
    }
    catch(err) {
        if (key) await releaseOnError(key);
        return next(err);
    }
});

export default router;