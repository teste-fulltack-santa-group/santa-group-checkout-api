import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "validation_error", issues: parsed.error.format() });
        }
        // @ts-expect-error
        req.validated = parsed.data;
        next();
    };
}