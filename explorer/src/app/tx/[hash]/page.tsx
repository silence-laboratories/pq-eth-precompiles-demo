import { TxPage } from "@/views/TxPage";

export default async function Page({
  params
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  return <TxPage hash={hash} />;
}
