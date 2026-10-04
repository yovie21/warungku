const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.auditLog.findMany({ take: 15, orderBy: { id: 'desc' } });
  console.log(JSON.stringify(logs, null, 2));
}
main().finally(() => prisma.$disconnect());
