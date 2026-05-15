import path from "node:path";
import { readFile } from "node:fs/promises";

export async function getMLDSAWalletSource(): Promise<string> {
  const sourcePath = path.join(process.cwd(), "..", "sol", "MLDSAWallet.sol");
  return readFile(sourcePath, "utf8");
}
