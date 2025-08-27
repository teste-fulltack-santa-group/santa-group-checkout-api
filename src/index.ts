import "dotenv/config";
import { buildServer, logger } from "./server";
import products from "./routes/products";
import paymentsPix from "./routes/payments.pix";
import webhooksPix from "./routes/webhooks.pix";
import paymentsCard from "./routes/payments.card";
import orders from "./routes/orders";
import { errorHandler } from "./lib/errors";

const app = buildServer();

app.use("/products", products);
app.use("/payments/pix", paymentsPix);
app.use("/webhooks/pix", webhooksPix);
app.use("/payments/card", paymentsCard);
app.use("/orders", orders);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => logger.info({ port }, "API running"));
