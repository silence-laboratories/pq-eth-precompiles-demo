# ML-DSA Wallet Demo Explorer

Small Next.js explorer for the runtime [MLDSAWallet](./sol/MLDSAWallet.sol) demo.

It is intentionally narrow:

- only serves tracked runtime `MLDSAWallet` contracts
- keeps the existing wallet / tx / PQ-proof UI
- stores discovered wallet transactions on the server in a `data/discovered-transactions.json` file
- proves PQ verification by looking for `STATICCALL` to precompile `0x1b` in transaction traces

## What it shows

- tracked wallet addresses
- recent transactions to those wallet contracts
- trace evidence that the wallet execution touched precompile `0x1b`
- local verified source for `MLDSAWallet`
- live on-chain bytecode via `eth_getCode`

## Requirements

- Node.js 20+
- npm

## Environment

Set the server-side RPC endpoint before running or deploying:

```bash
export PQ_RPC_URL="https://your-rpc.example"
```

## Tracked wallet config

The explorer reads tracked wallet metadata from:

- [public/tracked-wallets.json](./public/tracked-wallets.json)

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

## How proof works

For a wallet execution tx, the backend:

1. fetches the transaction
2. fetches the receipt
3. fetches `debug_traceTransaction`
4. recursively searches the trace for:
   - `to == 0x000000000000000000000000000000000000001b`
   - successful `STATICCALL`

If that exists, the tx page shows: `PQ Verification: Proven by trace`

## Notes

- This app is for the ML-DSA wallet demo, not for chain-wide exploration.
- Transaction history is still seeded by a recent-window scan, so very old transactions that were never discovered will not appear automatically.
