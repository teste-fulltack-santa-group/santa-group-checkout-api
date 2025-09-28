import crypto from "node:crypto";
import type { Request } from "express";
import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

function stableStringify(value: unknown): string {
    if(value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if(Array.isArray(value)) {
        return "[" + value.map(stableStringify).join(",") + "]"
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]));
    return "{" + parts.join(",") + "}";
}

export function bodyHash(body: unknown) {
    const s = JSON.stringify(body ?? {});
    return crypto.createHash("sha256").update(s).digest("hex");
}

export function canonicalRoute(req: Request) {
    const route = (req.baseUrl || "") + (req.path || "");
    return route.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

export type AcquireResult = 
    | { action: "proceed"; created: true }
    | { action: "replay"; statusCode: number; response: unknown }
    | { action: "in_progress" }
    | { action: "conflict" };

export async function acquireIdempotency(
    key: string,
    method: string,
    route: string,
    hash: string
): Promise<AcquireResult> {
    try {
        await prisma.idempotency.create({
            data: { key, method, path: route, requestHash: hash, state: "PENDING" },
        });
        return { action: "proceed", created: true };
    } catch (e: any) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e
        const row = await prisma.idempotency.findUnique({ where: { key } });
        if (!row) throw e;

        if (row.method !== method || row.path !== route) return { action: "conflict" };
        if (row.requestHash !== hash) return { action: "conflict" };

        if(row.state === "COMPLETED" && row.statusCode != null && row.response != null) {
            return { action: "replay", statusCode: row.statusCode, response: row.response };
        }
        return { action: "in_progress" };
    }
}

export async function finalizeIdempotency(
    key: string,
    statusCode: number,
    response: unknown
) {
    await prisma.idempotency.update({
        where: { key },
        data: { statusCode, response: response as any, state: "COMPLETED" },
    });
}

export async function releaseOnError(key: string) {
    await prisma.idempotency.delete({ where: { key } }).catch(() => {});
}

export async function findIdempotent(
    key: string,
    method: string,
    path: string,
    hash: string
) {
    const hit = await prisma.idempotency.findUnique({ where: { key } });
    if (!hit) return null;

    if(hit.method !== method || hit.path !== path || hit.requestHash !== hash) {
        return { conflict: true } as const;
    }
    return { conflict: false, hit } as const;
}

export async function saveIdempotent(
    key: string,
    method: string,
    path: string,
    hash: string,
    statusCode: number,
    response: unknown
) {
    await prisma.idempotency.create({
        data: {
            key,
            method,
            path,
            requestHash: hash,
            statusCode,
            response: response as any,
        },
    });
}

export function shouldCache(statusCode: number) {
    return statusCode < 500;
}

export async function waitForFinalized(key: string, maxMs = 1000, stepMs = 50) {
    const end = Date.now() + maxMs;
    while (Date.now() < end) {
        const row = await prisma.idempotency.findUnique({ where: { key } });
        if( row?.state === "COMPLETED" && row.statusCode != null ) {
            return { statusCode: row.statusCode, response: row.response };
        }
        await new Promise((r) => setTimeout(r, stepMs));
    }
    return null;
}