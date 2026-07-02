#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./exec.sh keygen [args...]
  ./exec.sh deploy [args...]
  ./exec.sh deploy-token [args...]
  ./exec.sh verify [args...]
  ./exec.sh execute [args...]

Examples:
  ./exec.sh keygen
  RPC_URL=https://pq-precompiles-devnet.demo.silencelaboratories.com PRIVATE_KEY=... ./exec.sh deploy
  RPC_URL=https://pq-precompiles-devnet.demo.silencelaboratories.com PRIVATE_KEY=... ./exec.sh deploy-token
  RPC_URL=https://pq-precompiles-devnet.demo.silencelaboratories.com ./exec.sh verify
  RPC_URL=https://pq-precompiles-devnet.demo.silencelaboratories.com ./exec.sh execute --dry-run-only
EOF
}

subcommand="${1:-}"
if [[ -z "$subcommand" ]]; then
  usage
  exit 1
fi
shift

case "$subcommand" in
  keygen)
    bin="keygen"
    ;;
  deploy)
    bin="deploy"
    ;;
  deploy-token)
    bin="deploy_token"
    ;;
  verify)
    bin="verify_deployment"
    ;;
  execute)
    bin="execute_pq_tx"
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown subcommand: $subcommand" >&2
    usage >&2
    exit 1
    ;;
esac

cargo build --manifest-path "$ROOT/rust/Cargo.toml" >/dev/null
exec "$ROOT/rust/target/debug/$bin" "$@"
