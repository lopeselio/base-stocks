# Coinbase Tokenized Stocks on Base — field notes

Verified against Base mainnet and `api.coinbase.com` on **2026-11-05**. Anything marked
⚠️ is not yet confirmed. PRs with corrections welcome.

## Tokens (B20)

- Every stock is a **B20** token, an ERC-20 extension implemented as a Base-native precompile.
  Addresses share the `0xb2000000…` prefix. There is no per-asset verified contract on Basescan.
- `decimals()` = **8** (checked: TSLAc).
- 298 listed stocks as of today (`GET /v1/tokenized-stocks?page_size=500`).
- Issuer: Coinbase Onchain SPV Ltd (ADGM). Holding and transfer are permissionless; mint/redeem is
  KYC'd and restricted to Authorized Participants.

### Multiplier (ERC-8056 UI multiplier)

- `uiMultiplier()` / `multiplier()` are WAD-scaled (`WAD_PRECISION() = 1e18`).
- `balanceOfUI(a) = balanceOf(a) * uiMultiplier / 1e18` = **underlying shares** represented.
- Dividends are reinvested, so the multiplier only increases with cash dividends. It also moves with splits.
  Examples today: GOOGLc 1.000377, NVDAc 1.000538, PMc 1.5588.
- Scheduled changes: `newUIMultiplier()` + `effectiveAt()` (0 = nothing pending).
- Selectors verified with `cast sig`:

| fn | selector |
|---|---|
| `WAD_PRECISION()` | `0x664808a8` |
| `multiplier()` | `0x1b3ed722` |
| `uiMultiplier()` | `0xa60bf13d` |
| `newUIMultiplier()` | `0xdc767007` |
| `effectiveAt()` | `0x97a4064f` |
| `balanceOfUI(address)` | `0x437a9958` |
| `totalSupplyUI()` | `0x9bea6429` |
| `toUIAmount(uint256)` | `0x3248d4ff` |
| `fromUIAmount(uint256)` | `0x65cd9b3c` |
| `scaledBalanceOf(address)` | `0x1da24f3e` |
| `extraMetadata(string)` | `0x4ddf9da0` |
| `isAnnouncementIdUsed(string)` | `0xc0da474e` |

- Event `UIMultiplierUpdated(uint256,uint256,uint256)` → topic0
  `0x2205df45…b055` (matches docs). ⚠️ Parameter names/order and which fields are indexed are unconfirmed.
- Event `UIMultiplierUpdateCancelled(uint256,uint256)` → topic0 `0x88385633…1cad` (matches docs).

## Prices (Chainlink "Coinbase <TICKER>" feeds)

- 8 decimals, AggregatorV3 (`latestRoundData()`), published 24/5. Off-hours the feed **holds its last value**.
  It updates on a 0.5% deviation or a 24h heartbeat.
- Feeds report **total-return values**.
- Today GOOGL feed = `290.79462274`, which equals the API `nav_price` for GOOGLc exactly, while the
  GOOGLc multiplier is 1.000377.
  ⚠️ **Open question:** is the feed value *per token* (already including reinvested dividends) or
  *per share* (needs × multiplier)? The docs say "Token Price = Underlying Equity Market Price ×
  Multiplier", but they also call the feed total-return. The SDK exposes both and defaults to **per
  token = feed value**, consistent with `nav_price`. Do not double-multiply.
- Only 10 feeds are documented (AAPL, AMZN, GOOGL, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA). For other
  tickers, the API `nav_price` is often present but not always (e.g. ORCLc, MUc, PMc had none).

## Protocol contracts (`GET /v1/tokenized-stocks/chains`)

| | address |
|---|---|
| chain | base (8453) |
| policy registry | `0x8453000000000000000000000000000000000002` |
| token supply manager | `0xD1Ca4dAcdf3231011D175351f1f02D15C7c5664C` |
| token factory | `0x4bA3E29E254F25E94E61C4c9d67b37027331534D` |
| onchain registry (docs) | `0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD` |

## REST API (`https://api.coinbase.com/v1/tokenized-stocks`, no key)

- `GET /` — paginated (`page_size` ≤ 500, `page_token`); fields: `contract_address, symbol, name,
  decimals, icon_url, total_supply, isin, adgm_isin, multiplier, paused_features, nav_price,
  nav_price_updated_at, description, first_mint_date`. Default values are **omitted**.
- `GET /chains`, `GET /total-supply/{address}` (bare JSON number, already normalized),
  `GET /metadata/{ticker}` (ticker includes the `c` suffix, case-insensitive),
  `GET /prospectus/{ticker}` (302 to PDF), `GET /corporate-actions/{uuid}` (UUID taken from the
  onchain `Announcement` URI).
- No testnet deployment is documented.

## ⚠️ B20 tokens cannot be executed in Foundry/Anvil forks

`eth_getCode` on any B20 address returns a single byte: `0xef`. The token logic runs natively in
the Base node, so when a local fork (forge `createSelectFork`, anvil `--fork-url`) executes a call to it,
it hits `OpcodeNotFound`:

```
├─ 0xb2000000000000000000002D0BA3164cc74f58B7::decimals() [staticcall]
│   └─ ← [OpcodeNotFound] EvmError: OpcodeNotFound
```

Workaround (shipped in this repo): `B20ForkUtils.etchLive(token)` reads live state from the RPC via
`vm.rpc("eth_call", …)` and then `vm.etch`es a behaviourally-equivalent `B20Mock` at the same address.
