import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __megamundo_prisma: PrismaClient | undefined;
}

export const prisma =
  global.__megamundo_prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__megamundo_prisma = prisma;
}

export * from '@prisma/client';
export default prisma;
