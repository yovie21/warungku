import { prisma } from "@/lib/prisma";
import { audit, requireUser } from "@/lib/auth";
import { fail, json, options, readJson } from "@/lib/http";

export const OPTIONS = options;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  const b = await readJson<{ name?: string; contact?: string; phone?: string; email?: string; address?: string }>(req);
  if (!b.name) return fail("name wajib");
  const s = await prisma.supplier.update({
    where: { id },
    data: {
      name: b.name.trim(),
      contact: b.contact?.trim() || null,
      phone: b.phone?.trim() || null,
      email: b.email?.trim() || null,
      address: b.address?.trim() || null,
    },
  });
  await audit(user!.id, "update", "supplier", s.id);
  return json(s);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = Number((await ctx.params).id);
  await prisma.supplier.delete({ where: { id } });
  await audit(user!.id, "delete", "supplier", id);
  return json({ success: true });
}
