import { Request, Response, NextFunction } from "express";
import { logger } from "../server";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    logger.error(err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: "internal_server_error", message: "An unexpected error occurred." });
}