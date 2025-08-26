import { z } from "zod";

const EnvSchema = z.object({
    PORT: z.coerce.number().default(4000),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),
    LOG_LEVEL: z.string().default("info"),
    DATABASE_URL: z.string().url()
});

export const ENV = EnvSchema.parse(process.env);