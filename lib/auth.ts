import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { fail } from "@/lib/http";

const secret = () => {
  const s = process.env.JWT_SECRET || "warungku-dev-only-change-me";
  return new TextEncoder().encode(s);
};

export type TokenUser = { id: number; username: string; role: Role };

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function checkPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function signToken(user: TokenUser) {
  return new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<TokenUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    const username = String(payload.username ?? "");
    const role = payload.role as Role;
    if (!id || !username || !role) return null;
    return { id, username, role };
  } catch {
    return null;
  }
}

export async function requireUser(req: Request, roles?: Role[]) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return { error: fail("Unauthorized", 401) as NextResponse, user: null as TokenUser | null };
  const user = await verifyToken(token);
  if (!user) return { error: fail("Unauthorized", 401) as NextResponse, user: null };
  if (roles && !roles.includes(user.role)) return { error: fail("Forbidden", 403) as NextResponse, user: null };
  return { error: null, user };
}

export async function audit(userId: number, action: string, entity: string, entityId?: number) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId: entityId ?? null } });
}

type NextResponse = import("next/server").NextResponse;
