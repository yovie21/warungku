import { NextResponse } from "next/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function options() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: cors });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

export function money(v: { toNumber?: () => number } | number | null | undefined) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber ? v.toNumber() : Number(v);
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
