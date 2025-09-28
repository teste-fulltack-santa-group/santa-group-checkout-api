import { prisma } from "../lib/prisma";

const TTL_DAYS = Number(process.env.IDEMP_TTL_DAYS ?? 7);
const PENDING_TTL_MS = Number(process.env.IDEMP_PENDING_TTL_MS ?? 5 * 60 * 1000);
const SWEEP_EVERY_MS = Number(process.env.IDEMP_SWEEP_INTERVAL_MS ?? 60 * 1000);

function nowMinus(ms: number) { return new Date(Date.now() - ms); }

export function startIdempotencyTTLWorker() {
    async function sweep() {
        const limitCompleted = nowMinus(TTL_DAYS * 24 * 60 * 60 * 1000);
        const limitPending   = nowMinus(PENDING_TTL_MS);

        await prisma.idempotency.deleteMany({
            where: {
                OR: [
                    { state: "COMPLETED", createdAt: { lt: limitCompleted } },
                    { state: "PENDING", updatedAt: { lt: limitPending } }
                ]
            },
        });
    }

    sweep().catch(() => {});
    setInterval(() => { sweep().catch(() => {}); }, SWEEP_EVERY_MS);
}