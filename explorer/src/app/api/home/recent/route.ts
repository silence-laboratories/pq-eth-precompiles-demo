import { NextRequest, NextResponse } from "next/server";

import { getHomeRecentTransactionsData } from "@/server/explorer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    return NextResponse.json(await getHomeRecentTransactionsData(refresh));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load recent transactions" },
      { status: 500 },
    );
  }
}
