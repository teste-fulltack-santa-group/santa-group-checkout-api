import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import cors from "cors";
import { randomUUID } from 'crypto';

export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    redact: ["req.headers.authorization", "res.headers", "password", "token"]
});

export function buildServer() {
    const app = express();

    app.use(helmet());
    app.use(cors({ origin: (process.env.WEB_ORIGIN ?? "*").split(",") }));
    app.use(express.json({ limit: "1mb" }));
    app.use(
        rateLimit({
            windowMs: 60_000,
            max: 100
        })
    );
    app.use(
        pinoHttp({
            logger,
            genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
            customProps: (req) => ({ requestId: (req as any).id }),
        })
    );

    app.get("/health", (_req, res) => res.status(200).json({ ok: true }))

    return app;
}