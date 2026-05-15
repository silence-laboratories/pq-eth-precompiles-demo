import { NextRequest, NextResponse } from "next/server";

import { getTxPageData } from "@/server/explorer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await context.params;
    const data = await getTxPageData(hash);
    if (!data) {
      return NextResponse.json({ error: "transaction not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load transaction" },
      { status: 500 },
    );
  }
}
