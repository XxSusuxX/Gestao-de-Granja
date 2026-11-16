import pino from "pino";

const isProductionOrServerless =
  process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProductionOrServerless
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
