import { NextRequest, NextResponse } from "next/server";

import { getWalletTransactionsData } from "@/server/explorer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await context.params;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const data = await getWalletTransactionsData(address, refresh);
    if (!data) {
      return NextResponse.json({ error: "wallet not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load wallet transactions" },
      { status: 500 },
    );
  }
}
