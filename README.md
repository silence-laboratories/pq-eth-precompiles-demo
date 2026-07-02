# pq-eth-precompiles-demo

Small ML-DSA verifier/executor POC for ETH-PQ testnet's precompile flow.

High-level flow:

1. Generate an ML-DSA-44 keypair off-chain.
2. Deploy `MLDSAWallet` as a generic runtime-key verifier/executor.
3. Build an operation payload off-chain and sign `0x0000 || keccak256(operation)` with ML-DSA.
4. Relay a normal Ethereum transaction to `MLDSAWallet.execute(...)`, passing the ML-DSA public key at runtime.
5. The wallet calls the ML-DSA precompile at `0x1b`.
6. If valid, the wallet executes the target call and increments the nonce tracked for `keccak256(publicKey)`.
7. The target can be a demo state-change contract or a simple ERC20 transfer.

## Layout

- `sol/MLDSAWallet.sol`: runtime-key verifier/executor with per-key nonces
- `sol/DemoRecipient.sol`: simple target contract for the POC action
- `sol/SimpleERC20.sol`: minimal ERC20 token for the PQ transfer demo
- `rust/src/bin/keygen.rs`: generate an ML-DSA-44 keypair locally
- `rust/src/bin/deploy.rs`: deploy `MLDSAWallet`, `DemoRecipient`, and `SimpleERC20`
- `rust/src/bin/deploy_token.rs`: deploy only `SimpleERC20` for an existing wallet
- `rust/src/bin/verify_deployment.rs`: check deployment state and optional per-key nonce
- `rust/src/bin/execute_pq_tx.rs`: sign an operation and relay either a demo call or ERC20 transfer
- `exec.sh`: tiny shell wrapper with `keygen`, `deploy`, `deploy-token`, `verify`, and `execute` subcommands

## Requirements

- `solc` 0.8.25+ on your path
- Foundry `cast` on your path
- Rust / Cargo

## Rust Tools

The helper lives under `rust/`

Available binaries:

- `keygen`
- `deploy`
- `deploy_token`
- `verify_deployment`
- `execute_pq_tx`

Build them with:

```bash
cargo build --manifest-path ./rust/Cargo.toml
```

Examples:

```bash
./rust/target/debug/keygen

RPC_URL=<...> PRIVATE_KEY=<...> \
  ./rust/target/debug/deploy

RPC_URL=<...> PRIVATE_KEY=<...> \
  ./rust/target/debug/deploy_token

RPC_URL=<...> \
  ./rust/target/debug/verify_deployment

RPC_URL=<...> \
  ./rust/target/debug/execute_pq_tx --dry-run-only
```

## One-Command Wrapper

From inside the project root:

```bash
./exec.sh keygen

export RPC_URL=<...>
export PRIVATE_KEY=<...>
./exec.sh deploy
./exec.sh deploy-token
./exec.sh verify
./exec.sh execute --dry-run-only
./exec.sh execute --note "hello from phone wallet"
./exec.sh execute --erc20-recipient 0x... --erc20-amount 1000000000000000000
```

## 1. Generate ML-DSA keys

```bash
./exec.sh keygen
```

This writes:

- `state/ml_dsa_keypair.json`

## 2. Deploy contracts

Set your relayer key and RPC:

```bash
export RPC_URL=https://pq-precompiles-devnet.demo.silencelaboratories.com
export PRIVATE_KEY=...
./exec.sh deploy
```

This writes:

- `state/deployment.json`

The deploy step does not require the ML-DSA keypair because the contract does not store a public key on-chain.
It also deploys `SimpleERC20` and mints the initial supply to `MLDSAWallet`, so the verifier contract can send tokens after PQ verification.

## 3. Verify deployment

```bash
./exec.sh verify
```

If `state/ml_dsa_keypair.json` exists, `verify` also shows the current nonce for that runtime public key.
It also shows the token metadata and the current ERC20 balance held by `MLDSAWallet`.

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


## Deploying against the re-hosted Kurtosis devnet

The PQ precompile network from [`silence-laboratories/pq-eth-precompiles`](https://github.com/silence-laboratories/pq-eth-precompiles) (Kurtosis + `Giulio2002/erigon:docker_pq-precompiles`) is re-hosted on Coolify at:

- RPC: `https://pq-precompiles-devnet.demo.silencelaboratories.com`

Because this devnet's Kurtosis enclave is recreated from scratch on every redeploy (fresh genesis each time), any contracts deployed against it are wiped out whenever that app redeploys. There is no persistent state — contracts must be redeployed after every re-hosted-devnet redeploy.

### 0. Install prerequisites

```bash
# Foundry (provides `cast`)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# solc 0.8.25 static binary
curl -L -o ~/.local/bin/solc \
  https://github.com/ethereum/solidity/releases/download/v0.8.25/solc-static-linux
chmod +x ~/.local/bin/solc
```

### 1. Build the Rust tools

```bash
cargo build --manifest-path ./rust/Cargo.toml
```

(Don't use `--offline` on a fresh checkout — the `pqcrypto-*` crates need to be fetched first.)

### 2. Deploy contracts

Use a funded devnet key. The Kurtosis `prefunded_accounts` in `network_params.yaml` uses the well-known Anvil/Hardhat test account #0 — look up its public test private key (never use it anywhere with real funds):

```bash
export RPC_URL=https://pq-precompiles-devnet.demo.silencelaboratories.com
export PRIVATE_KEY=<anvil-account-0-private-key>
./exec.sh deploy
```

This writes `state/deployment.json` with the new `wallet_address`, `demo_recipient_address`, and `token_address`.

### 3. Point the explorer at the new addresses

Update `explorer/public/tracked-wallets.json` with the values from `state/deployment.json` (`wallet_address` → `address`, `demo_recipient_address` → `demoRecipientAddress`, `token_address` → `tokenAddress`), commit, and redeploy the `pq-precompiles-devnet-explorer` Coolify app so it picks up the new `tracked-wallets.json`.

### Known limitation: PQ verification currently fails

`./exec.sh execute` (and its `--dry-run-only` mode) will revert with `InvalidSignature()` on this devnet. Root cause: `docker_pq-precompiles` only registers the PQ precompiles (`0x12`-`0x1c`, including the Dilithium/ML-DSA verifier at `0x1b` this repo calls) under the **Osaka** EL fork (see `execution/vm/contracts.go`, `PrecompiledContractsOsaka`). The re-hosted devnet only activates Electra/Prague (`electra_fork_epoch: 0` in `network_params.yaml`) — Osaka isn't enabled, so `0x1b` is just an empty address that returns `0x` instead of running real verification.

Enabling Osaka requires `fulu_fork_epoch` (the CL name for the same fork boundary), which currently breaks Lighthouse genesis generation on this Kurtosis toolchain version (`ethereum-package@5.0.1` + `ethereum-genesis-generator:4.0.4` can't produce a valid Fulu SSZ genesis for Lighthouse). See [silent-shard-issues#1693](https://github.com/silence-laboratories/silent-shard-issues/issues/1693) for the ongoing toolchain-compatibility discussion.

Deploying contracts and reading state (`./exec.sh verify`, ERC20 balance checks) works fine on this devnet — only the on-chain PQ signature verification step is blocked until Osaka is activated.

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

This matches the [repo's ML-DSA-44](https://github.com/Giulio2002/pq-eth-precompiles/blob/master/kurtosis/contracts/DilithiumVerifierDirectBound.yul) verification convention.
