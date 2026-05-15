import { WalletPage } from "@/views/WalletPage";
import { getTrackedWallets } from "@/server/tracked-wallets";

export const dynamic = "force-dynamic";

export default async function Page() {
  const wallets = await getTrackedWallets();
  const wallet = wallets[0];

  if (!wallet) {
    return (
      <div className="page-state">
        <div className="empty">
          No tracked wallet found in <code>public/tracked-wallets.json</code>.
        </div>
      </div>
    );
  }

  return <WalletPage address={wallet.address} showBreadcrumbs={false} />;
}
