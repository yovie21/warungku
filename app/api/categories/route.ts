import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req);
  if (error) return error;
  const rows = await prisma.category.findMany({ orderBy: { id: "asc" } });
  return json(rows);
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{ name?: string; parentId?: number | null }>(req);
  if (!b.name) return fail("name wajib");
  const c = await prisma.category.create({ data: { name: b.name.trim(), parentId: b.parentId ?? null } });
  await audit(user!.id, "create", "category", c.id);
  return json(c);
}