/**
 * Minimal ABI for Coinbase B20 tokenized-stock assets (ERC-20 + ERC-8056 UI multiplier).
 * Every selector here was checked against docs.base.org (see docs/research.md).
 */
export const b20Abi = [
  // ERC-20
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }],
  },
  // B20 / ERC-8056
  { type: "function", name: "WAD_PRECISION", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "uiMultiplier", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "multiplier", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "newUIMultiplier", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "effectiveAt", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "balanceOfUI", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "totalSupplyUI", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "toUIAmount", stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "fromUIAmount", stateMutability: "view",
    inputs: [{ name: "uiAmount", type: "uint256" }], outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "isAnnouncementIdUsed", stateMutability: "view",
    inputs: [{ name: "id", type: "string" }], outputs: [{ type: "bool" }],
  },
] as const;

/** topic0 hashes for B20 events (verified against docs). */
export const B20_EVENT_TOPICS = {
  UIMultiplierUpdated: "0x2205df4534432b2f60654a3fdb48737ffdaf3e9edb1a498bd985bc026b15b055",
  UIMultiplierUpdateCancelled: "0x883856335ba5f60c18b9817c4505d3c7d3f6223dcf39516b30c508c46a5e1cad",
  Announcement: "0xccebf8218a62875909564adef86a6f4df81503cb617221e793357d62f8e813f7",
  EndAnnouncement: "0x96d64dafe2c790596430196b982ad1da3221cb3b0f4e6e2df77f2e4f71a90037",
} as const;
