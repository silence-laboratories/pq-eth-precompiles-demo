import type { Metadata } from "next";

import "@/styles.css";

export const metadata: Metadata = {
  title: "ML-DSA Wallet Explorer",
  description: "Demo explorer for MLDSAWallet transactions and PQ verification"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
