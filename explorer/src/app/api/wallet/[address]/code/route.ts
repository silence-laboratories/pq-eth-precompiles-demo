import { NextRequest, NextResponse } from "next/server";

import { getWalletCodeData } from "@/server/explorer";
import { getMLDSAWalletSource } from "@/server/source";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await context.params;
    const kind = request.nextUrl.searchParams.get("kind") === "bytecode" ? "bytecode" : "source";
    const source = await getMLDSAWalletSource();
    const data = await getWalletCodeData(address, kind, source);
    if (!data) {
      return NextResponse.json({ error: "wallet not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load wallet code" },
      { status: 500 },
    );
  }
}
