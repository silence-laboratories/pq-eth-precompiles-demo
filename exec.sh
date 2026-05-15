#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./exec.sh keygen [args...]
  ./exec.sh deploy [args...]
  ./exec.sh deploy-compat [args...]
  ./exec.sh deploy-token [args...]
  ./exec.sh verify [args...]
  ./exec.sh verify-compat [args...]
  ./exec.sh execute [args...]
  ./exec.sh execute-compat [args...]

Examples:
  ./exec.sh keygen
  RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh deploy
  RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh deploy-compat
  RPC_URL=http://65.109.17.230:33952 PRIVATE_KEY=... ./exec.sh deploy-token
  RPC_URL=http://65.109.17.230:33952 ./exec.sh verify
  RPC_URL=http://65.109.17.230:33952 ./exec.sh verify-compat
  RPC_URL=http://65.109.17.230:33952 ./exec.sh execute --dry-run-only
  RPC_URL=http://65.109.17.230:33952 ./exec.sh execute-compat --dry-run-only
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
  deploy-compat)
    bin="deploy_compat"
    ;;
  deploy-token)
    bin="deploy_token"
    ;;
  verify)
    bin="verify_deployment"
    ;;
  verify-compat)
    bin="verify_compat"
    ;;
  execute)
    bin="execute_pq_tx"
    ;;
  execute-compat)
    bin="execute_compat"
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

cargo build --offline --manifest-path "$ROOT/rust/Cargo.toml" >/dev/null
exec "$ROOT/rust/target/debug/$bin" "$@"
