#!/usr/bin/env bash
# Local Base mainnet fork with working B20 stocks + a deployed Mag7 basket.
#
# B20 tokens are native precompiles (code == 0xef) and cannot execute in anvil, so this script
# replaces the Mag7 tokens with B20Mock seeded from live mainnet state, funds a dev account,
# and deploys BasketFactory + bMAG7 using anvil's unlocked default account (no private keys).
#
#   ./scripts/local-fork.sh                 # anvil on :8545, funds anvil account #0
#   DEV_ACCOUNT=0xYourWallet ./scripts/local-fork.sh   # also fund your wallet
#
# Then:  BASE_RPC_URL=http://127.0.0.1:8545 BASKET_FACTORY=<printed> pnpm --filter @base-stocks/api dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS="$ROOT/packages/contracts"
MAINNET="${MAINNET_RPC_URL:-https://mainnet.base.org}"
PORT="${PORT:-8545}"
LOCAL="http://127.0.0.1:$PORT"
DEPLOYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 # anvil default #0 (unlocked)

TOKENS=(
  0xb200000000000000000000C2e324d24d7eEcd1fb # AAPLc
  0xb200000000000000000000d9192b6B456483C2E8 # AMZNc
  0xb2000000000000000000002D0BA3164cc74f58B7 # GOOGLc
  0xb2000000000000000000008bC8786B856E61707C # METAc
  0xB200000000000000000000Ab99cFa739E253872B # MSFTc
  0xb20000000000000000000078ee7ce2fE4908108C # NVDAc
  0xb2000000000000000000001e800a7f5189430cD0 # TSLAc
)

if ! curl -sf -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$LOCAL" >/dev/null; then
  echo "starting anvil fork of $MAINNET on :$PORT"
  anvil --fork-url "$MAINNET" --port "$PORT" --chain-id 8453 --silent >/dev/null 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$LOCAL" >/dev/null && break
    sleep 1
  done
fi

(cd "$CONTRACTS" && forge build --silent)
CODE="$(cd "$CONTRACTS" && forge inspect B20Mock deployedBytecode)"

send() { cast send --rpc-url "$LOCAL" --unlocked --from "$DEPLOYER" "$@" >/dev/null; }

for t in "${TOKENS[@]}"; do
  sym=$(cast call "$t" "symbol()(string)" --rpc-url "$MAINNET" | tr -d '"')
  name=$(cast call "$t" "name()(string)" --rpc-url "$MAINNET" | tr -d '"')
  mult=$(cast call "$t" "uiMultiplier()(uint256)" --rpc-url "$MAINNET" | awk '{print $1}')
  supply=$(cast call "$t" "totalSupply()(uint256)" --rpc-url "$MAINNET" | awk '{print $1}')

  cast rpc --rpc-url "$LOCAL" anvil_setCode "$t" "$CODE" >/dev/null
  send "$t" "__init(string,string,uint8,uint256)" "$name" "$sym" 8 "$mult"
  send "$t" "__setTotalSupply(uint256)" "$supply"
  send "$t" "__mint(address,uint256)" "$DEPLOYER" 10000000000 # 100 tokens
  if [[ -n "${DEV_ACCOUNT:-}" ]]; then
    send "$t" "__mint(address,uint256)" "$DEV_ACCOUNT" 10000000000
  fi
  echo "etched $sym (multiplier $mult)"
done

OUT=$(cd "$CONTRACTS" && forge script script/DeployMag7.s.sol --rpc-url "$LOCAL" --unlocked --sender "$DEPLOYER" --broadcast 2>&1)
FACTORY=$(echo "$OUT" | awk '/BasketFactory:/ {print $2}')
BASKET=$(echo "$OUT" | awk '/bMAG7:/ {print $2}')

echo
echo "BasketFactory: $FACTORY"
echo "bMAG7:         $BASKET"
echo
echo "API:  BASE_RPC_URL=$LOCAL BASKET_FACTORY=$FACTORY pnpm --filter @base-stocks/api dev"
echo "Web:  API_URL=http://localhost:4000 NEXT_PUBLIC_BASE_RPC_URL=$LOCAL pnpm --filter @base-stocks/web dev"
