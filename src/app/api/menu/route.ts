import { NextResponse } from "next/server";
import { fetchLiveMenu } from "@/lib/sheet";

export const revalidate = 60;

export async function GET() {
  const sheetId = process.env.SHEET_ID;

  if (!sheetId) {
    return NextResponse.json({ items: [], source: "baked" as const });
  }

  const items = await fetchLiveMenu(sheetId, process.env.SHEET_GID ?? "0");

  if (!items) {
    return NextResponse.json({ items: [], source: "baked" as const });
  }

  return NextResponse.json(
    { items, source: "live" as const },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
