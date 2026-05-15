import { NextResponse } from "next/server";

import { getHomeWalletsData } from "@/server/explorer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getHomeWalletsData());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load wallets" },
      { status: 500 },
    );
  }
}
