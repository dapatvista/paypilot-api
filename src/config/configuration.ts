export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL as string,
  },
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  internalApiKey: process.env.INTERNAL_API_KEY as string,
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY as string,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
});
