import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req);
  if (error) return error;
  const rows = await prisma.uom.findMany({ orderBy: { id: "asc" } });
  return json(rows);
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{ name?: string; symbol?: string }>(req);
  if (!b.name) return fail("name wajib");
  const u = await prisma.uom.create({ data: { name: b.name.trim(), symbol: b.symbol?.trim() ?? "" } });
  await audit(user!.id, "create", "uom", u.id);
  return json(u);
}