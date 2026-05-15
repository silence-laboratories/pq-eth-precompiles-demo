import { NextRequest, NextResponse } from "next/server";

import { getWalletSummaryData } from "@/server/explorer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await context.params;
    const data = await getWalletSummaryData(address);
    if (!data) {
      return NextResponse.json({ error: "wallet not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load wallet summary" },
      { status: 500 },
    );
  }
}
