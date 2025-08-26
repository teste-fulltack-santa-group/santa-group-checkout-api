import { Router } from "express";
import { prisma } from "../lib/prisma";
import { validateBody } from "../lib/validate";
import { PixWebhookSchema } from "../lib/schemas";

const router = Router();

router.post("/simulate", validateBody(PixWebhookSchema), async (req, res) => {
  const { txid, status } = req.body as typeof PixWebhookSchema._type;

  const payment = await prisma.payment.findFirst({ where: { txid, method: "PIX" }});
  if (!payment) return res.status(404).json({ error: "payment_not_found" });

  if (payment.status !== "PENDING") {
    return res.json({ ok: true, alreadyFinal: true, status: payment.status });
  }

  const newPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: { status },
  });

  const orderNewStatus = status === "APPROVED" ? "APPROVED" : "EXPIRED";
  await prisma.order.update({
    where: { id: payment.orderId },
    data: { status: orderNewStatus },
  });

  res.json({ ok: true, status: newPayment.status });
});

export default router;