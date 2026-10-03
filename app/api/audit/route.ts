import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, options } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req, ["admin"]);
  if (error) return error;
  const rows = await prisma.auditLog.findMany({
    include: { user: { select: { username: true, role: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });
  return json(rows);
}
