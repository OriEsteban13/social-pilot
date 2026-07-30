import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 + PostgreSQL requiere un driver adapter explícito. Conecta contra
// el proyecto de Supabase vía `DATABASE_URL` (connection string del
// "Transaction pooler" — puerto 6543 —, recomendado para entornos
// serverless). El resto de la aplicación consume `prisma` sin saber qué
// motor hay detrás.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
