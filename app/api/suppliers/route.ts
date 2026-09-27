import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function GET(req: Request) {
  const { error } = await requireUser(req);
  if (error) return error;
  const rows = await prisma.supplier.findMany({ orderBy: { id: "desc" } });
  return json(rows);
}

export async function POST(req: Request) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const b = await readJson<{ name?: string; contact?: string; phone?: string; email?: string; address?: string }>(req);
  if (!b.name) return fail("name wajib");
  const s = await prisma.supplier.create({ data: { name: b.name.trim(), contact: b.contact?.trim(), phone: b.phone?.trim(), email: b.email?.trim(), address: b.address?.trim() } });
  await audit(user!.id, "create", "supplier", s.id);
  return json(s);
}