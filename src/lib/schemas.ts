import { z } from "zod";

export const CustomerSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email address"),
    cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos numéricos"),
    phone: z.string().regex(/^\d{10,11}$/, "Phone must be 10 or 11 digits"),
});

export const PixCreateSchema = z.object({
    productId: z.string(),
    customer: CustomerSchema,
});

export const PixWebhookSchema = z.object({
    txid: z.string().min(8),
    status: z.enum(["APPROVED", "EXPIRED"]),
});

export const CardPaymentSchema = z.object({
  productId: z.string(),
  customer: CustomerSchema,
  token: z.string().min(10),
  last4: z.string().length(4),
  brand: z.string().min(3),
  exp: z.string().min(4),
  holder: z.string().min(2),
  jti: z.string().min(8),
  iat: z.number().int(),
  expAt: z.number().int(),
});