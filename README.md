# ML-DSA Wallet POC

Small ML-DSA verifier/executor POC for this testnet's precompile flow.

High-level flow:

1. Generate an ML-DSA-44 keypair off-chain.
2. Deploy `MLDSAWallet` as a generic runtime-key verifier/executor.
3. Build an operation payload off-chain and sign `0x0000 || keccak256(operation)` with ML-DSA.
4. Relay a normal Ethereum transaction to `MLDSAWallet.execute(...)`, passing the ML-DSA public key at runtime.
5. The wallet calls the ML-DSA precompile at `0x1b`.
6. If valid, the wallet executes the target call and increments the nonce tracked for `keccak256(publicKey)`.
7. The target can be a demo state-change contract or a simple ERC20 transfer.

This directory now contains two wallet variants:

- `MLDSAWallet`: runtime-key verifier/executor
- `MLDSAWalletCompat`: bound-key variant with explorer-friendly getters

## Layout

- `sol/MLDSAWallet.sol`: runtime-key verifier/executor with per-key nonces
- `sol/MLDSAWalletCompat.sol`: bound-key ML-DSA wallet with `publicKey()`, `nonce()`, `payer()`, and `algorithm()`
- `sol/DemoRecipient.sol`: simple target contract for the POC action
- `sol/SimpleERC20.sol`: minimal ERC20 token for the PQ transfer demo
- `rust/src/bin/keygen.rs`: generate an ML-DSA-44 keypair locally
- `rust/src/bin/deploy.rs`: deploy `MLDSAWallet`, `DemoRecipient`, and `SimpleERC20`
- `rust/src/bin/deploy_compat.rs`: deploy `MLDSAWalletCompat`, `DemoRecipient`, and `SimpleERC20`
- `rust/src/bin/deploy_token.rs`: deploy only `SimpleERC20` for an existing wallet
- `rust/src/bin/verify_deployment.rs`: check deployment state and optional per-key nonce
- `rust/src/bin/verify_compat.rs`: check the bound-key compatibility wallet state
- `rust/src/bin/execute_pq_tx.rs`: sign an operation and relay either a demo call or ERC20 transfer
- `rust/src/bin/execute_compat.rs`: sign an operation and relay it through `MLDSAWalletCompat`
- `exec.sh`: tiny shell wrapper with `keygen`, `deploy`, `verify`, and `execute` subcommands

## Requirements

- `solc` 0.8.25+ on your path
- `cast` on your path
- Rust / Cargo

## Rust Tools

The helper lives under `rust/`

Available binaries:

- `keygen`
- `deploy`
- `deploy_compat`
- `verify_deployment`
- `verify_compat`
- `execute_pq_tx`
- `execute_compat`

Build them with:

```bash
cargo build --offline --manifest-path ./rust/Cargo.toml
```

Examples:

```bash
./rust/target/debug/keygen

RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... \
  ./rust/target/debug/deploy

RPC_URL=http://65.109.17.230:33952 \
  ./rust/target/debug/verify_deployment

RPC_URL=http://65.109.17.230:33952 \
  ./rust/target/debug/execute_pq_tx --dry-run-only
```

## One-Command Wrapper

From inside `./ml-dsa_wallet`:

```bash
./exec.sh keygen
RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh deploy
RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh deploy-compat
RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh deploy-token
RPC_URL=http://65.109.17.230:33952 ./exec.sh verify
RPC_URL=http://65.109.17.230:33952 ./exec.sh verify-compat
RPC_URL=http://65.109.17.230:33952 ./exec.sh execute --dry-run-only
RPC_URL=http://65.109.17.230:33952 ./exec.sh execute-compat --dry-run-only
RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh execute --note "hello from phone wallet"
RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh execute --erc20-recipient 0x... --erc20-amount 1000000000000000000
RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh execute-compat --erc20-recipient 0x... --erc20-amount 1000000000000000000
```

## 1. Generate ML-DSA keys

```bash
./exec.sh keygen
```

This writes:

- `ml-dsa_wallet/state/ml_dsa_keypair.json`

## 2. Deploy contracts

Set your relayer key and RPC:

```bash
export RPC_URL=http://65.109.17.230:33952
export PRIVATE_KEY=...
./exec.sh deploy
```

This writes:

- `ml-dsa_wallet/state/deployment.json`

The deploy step does not require the ML-DSA keypair because the contract does not store a public key on-chain.
It also deploys `SimpleERC20` and mints the initial supply to `MLDSAWallet`, so the verifier contract can send tokens after PQ verification.

## 2b. Deploy explorer-compatible wallet

If you want the bound-key variant that looks closer to the explorer's wallet model, use:

```bash
export RPC_URL=http://65.109.17.230:33952
export PRIVATE_KEY=...
./exec.sh deploy-compat
```

This writes:

- `ml-dsa_wallet/state/deployment_compat.json`

The compatibility wallet:

- stores one ML-DSA public key on-chain
- exposes `publicKey()`
- exposes `nonce()`
- exposes `payer()`
- exposes `algorithm()`
- mints the initial ERC20 supply to the compatibility wallet contract

If you already have `MLDSAWallet` deployed and only want a fresh token, use:

```bash
./exec.sh deploy-token
```

This reuses `wallet_address` from `state/deployment.json`. You can override it with:

```bash
./exec.sh deploy-token --wallet 0xYOUR_WALLET
```

## 3. Verify deployment

```bash
./exec.sh verify
```

If `state/ml_dsa_keypair.json` exists, `verify` also shows the current nonce for that runtime public key.
It also shows the token metadata and the current ERC20 balance held by `MLDSAWallet`.

For the compatibility wallet:

```bash
./exec.sh verify-compat
```

This checks:

- bound public key length
- bound nonce
- payer address
- algorithm id
- token balance held by `MLDSAWalletCompat`

## 4. Execute a PQ-authorized wallet action

Dry run first:

```bash
./exec.sh execute --dry-run-only
```

Send the real transaction:

```bash
./exec.sh execute --note "hello from phone wallet"
```

Send an ERC20 transfer instead:

```bash
./exec.sh execute --erc20-recipient 0xYOUR_RECIPIENT --erc20-amount 1000000000000000000
```

When `--erc20-recipient` is present, the signed action becomes:

- `target = token_address`
- `data = transfer(recipient, amount)`
- `value = 0`

For the compatibility wallet:

```bash
./exec.sh execute-compat --dry-run-only --erc20-recipient 0xYOUR_RECIPIENT --erc20-amount 1000000000000000000
./exec.sh execute-compat --erc20-recipient 0xYOUR_RECIPIENT --erc20-amount 1000000000000000000
```

`execute-compat` uses `state/deployment_compat.json` and signs the digest for the bound-key wallet format:

```text
keccak256(abi.encode(
  chainId,
  walletAddress,
  nonce,
  target,
  value,
  keccak256(calldata),
  deadline
))
```

The relayer must be the configured `payer`.

## Explorer compatibility checks

After `deploy-compat`, you can test the explorer-friendly getters directly:

```bash
WALLET=$(jq -r '.wallet_address' /Users/trannguyen/Workspaces/sl/sl-nw/pq-eth-precompiles/ml-dsa_wallet/state/deployment_compat.json)
cast call --rpc-url http://65.109.17.230:33952 $WALLET "publicKey()(bytes)"
cast call --rpc-url http://65.109.17.230:33952 $WALLET "nonce()(uint256)"
cast call --rpc-url http://65.109.17.230:33952 $WALLET "payer()(address)"
cast call --rpc-url http://65.109.17.230:33952 $WALLET "algorithm()(uint256)"
```

## Signed payload

The wallet signs the digest:

```text
keccak256(abi.encode(
  chainId,
  walletAddress,
  keccak256(publicKey),
  nonce,
  target,
  value,
  keccak256(calldata),
  deadline
))
```

The ML-DSA signature is produced over:

```text
0x0000 || digest
```

This matches the repo's ML-DSA verification convention for `ml_dsa_44`.
# pq-eth-precompiles-demo
