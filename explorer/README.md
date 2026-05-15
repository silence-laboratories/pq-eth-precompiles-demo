# ML-DSA Wallet Demo Explorer

Small Next.js explorer for the runtime [MLDSAWallet](/Users/trannguyen/Workspaces/sl/sl-nw/pq-eth-precompiles/ml-dsa_wallet/sol/MLDSAWallet.sol) demo.

It is intentionally narrow:

- only serves tracked runtime `MLDSAWallet` contracts
- keeps the existing wallet / tx / PQ-proof UI
- stores discovered wallet transactions on the server in a JSON file
- proves PQ verification by looking for `STATICCALL` to precompile `0x1b` in transaction traces

## What it shows

- tracked wallet addresses
- recent transactions to those wallet contracts
- decoded `execute(...)` calls
- decoded delegate actions:
  - `SimpleERC20.transfer(...)`
  - `DemoRecipient.setNote(...)`
- trace evidence that the wallet execution touched precompile `0x1b`
- local verified source for `MLDSAWallet`
- live on-chain bytecode via `eth_getCode`

## Important difference from the old SPA

This version no longer depends on browser `localStorage` for transaction history.

Discovered wallet transactions are persisted on the backend in:

- [data/discovered-transactions.json](/Users/trannguyen/Workspaces/sl/sl-nw/pq-eth-precompiles/ml-dsa_wallet/explorer/data/discovered-transactions.json)

## Requirements

- Node.js 20+
- npm
- an RPC endpoint for the PQ chain, provided as `PQ_RPC_URL`, that supports:
  - `eth_getTransactionByHash`
  - `eth_getTransactionReceipt`
  - `eth_getBlockByNumber`
  - `eth_call`
  - ideally `debug_traceTransaction`

If tracing is unavailable, the tx page will say PQ verification could not be proven from the node.

## Environment

Set the server-side RPC endpoint before running or deploying:

```bash
export PQ_RPC_URL="https://your-rpc.example"
```

Do not put the RPC endpoint in `public/tracked-wallets.json`; files under `public/` are served to the browser.

## Tracked wallet config

The explorer reads wallet metadata from:

- [public/tracked-wallets.json](/Users/trannguyen/Workspaces/sl/sl-nw/pq-eth-precompiles/ml-dsa_wallet/explorer/public/tracked-wallets.json)

Example shape:

```json
[
  {
    "address": "0x...",
    "label": "MLDSAWallet",
    "chainId": 3151908,
    "demoRecipientAddress": "0x...",
    "tokenAddress": "0x...",
    "tokenSymbol": "PQT",
    "tokenName": "PQ Demo Token"
  }
]
```

## Install

Install dependencies:

```bash
npm install
```

## Run

Start the dev server:

```bash
export PQ_RPC_URL="https://your-rpc.example"
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Build

```bash
export PQ_RPC_URL="https://your-rpc.example"
npm run build
```

Run the production server locally with:

```bash
npm run start
```

## Routes

The app serves:

- `/`
- `/tx/:hash`

Backend endpoints live under:

- `/api/home/wallets`
- `/api/home/recent`
- `/api/wallet/:address/summary`
- `/api/wallet/:address/transactions`
- `/api/wallet/:address/code`
- `/api/tx/:hash`

## How persistence works

For the tracked wallet, the backend:

1. scans a recent block window live from RPC
2. decodes wallet transactions that target that wallet contract
3. merges them with previously discovered transactions
4. writes the merged result to `data/discovered-transactions.json`

So the JSON file acts like a tiny demo index.

## How proof works

For a wallet execution tx, the backend:

1. fetches the transaction
2. fetches the receipt
3. fetches `debug_traceTransaction`
4. recursively searches the trace for:
   - `to == 0x000000000000000000000000000000000000001b`
   - successful `STATICCALL`

If that exists, the tx page shows:

- `PQ Verification: Proven by trace`

## Notes

- This app is optimized for the ML-DSA wallet demo, not for chain-wide exploration.
- Transaction history is still seeded by a recent-window scan, so very old transactions that were never discovered will not appear automatically.
