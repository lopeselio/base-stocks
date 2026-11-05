# Deployments

## Base mainnet (chain 8453)

| Contract | Address |
|---|---|
| BasketFactory | [`0x370EC470Da0294f938c5eA11Ddf3F69Dac575021`](https://basescan.org/address/0x370EC470Da0294f938c5eA11Ddf3F69Dac575021) |
| bMAG7 (StockBasket, "Base Mag7") | [`0xaBf06F7e25E1cAbDB9D25FB80aAcD6D3d25eD0BF`](https://basescan.org/address/0xaBf06F7e25E1cAbDB9D25FB80aAcD6D3d25eD0BF) |

- Deployed 2026-11-05 in block 53550909 with `script/DeployMag7.s.sol`, for 0.0000311 ETH of gas in total.
- Transactions: [`0x0761ba4d…1273`](https://basescan.org/tx/0x0761ba4dbc8b97b720bd0fec845134cf1a26793d0dea52301d1351e9bff11273) (factory) and
  [`0x1f9cc1e2…79e8`](https://basescan.org/tx/0x1f9cc1e27cbb9d39bed9e37123c6a5397e2b4ec6f241f3cb0f0b0e1e491179e8) (bMAG7).
- bMAG7 composition: 0.1 each of AAPLc, AMZNc, GOOGLc, METAc, MSFTc, NVDAc and TSLAc per basket unit, priced with
  Coinbase Chainlink feeds and a 4-day staleness bound.
- Neither contract has an owner, admin or upgrade path.

First mainnet read: `nav()` = **$257.93** per unit with all feeds fresh. That confirms contracts can call the
native B20 precompiles from Solidity on mainnet.
