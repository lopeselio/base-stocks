"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits, type Address } from "viem";
import { useConnection, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { stockBasketAbi } from "@base-stocks/sdk";
import { num } from "@/lib/format";

interface Component {
  token: Address;
  symbol: string;
  unitAmount: string;
}

const UNIT = 10n ** 18n;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function TradePanel({
  basket,
  symbol,
  components,
  restricted,
}: {
  basket: Address;
  symbol: string;
  components: Component[];
  restricted: boolean;
}) {
  const [mode, setMode] = useState<"mint" | "redeem">("mint");
  const [input, setInput] = useState("1");
  const { address } = useConnection();

  const amount = useMemo(() => {
    try {
      return parseUnits(input || "0", 18);
    } catch {
      return 0n;
    }
  }, [input]);

  const required = components.map((c) =>
    mode === "mint" ? ceilDiv(BigInt(c.unitAmount) * amount, UNIT) : (BigInt(c.unitAmount) * amount) / UNIT,
  );

  const reads = useReadContracts({
    allowFailure: false,
    query: { enabled: !!address, refetchInterval: 8_000 },
    contracts: address
      ? [
          { address: basket, abi: erc20Abi, functionName: "balanceOf", args: [address] },
          ...components.flatMap(
            (c) =>
              [
                { address: c.token, abi: erc20Abi, functionName: "balanceOf", args: [address] },
                { address: c.token, abi: erc20Abi, functionName: "allowance", args: [address, basket] },
              ] as const,
          ),
        ]
      : [],
  });

  const data = reads.data as bigint[] | undefined;
  const basketBal = data?.[0] ?? 0n;
  const bal = (i: number) => data?.[1 + i * 2] ?? 0n;
  const allowance = (i: number) => data?.[2 + i * 2] ?? 0n;

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const busy = isPending || receipt.isLoading;
  const { refetch } = reads;
  useEffect(() => {
    if (receipt.isSuccess) void refetch(); // refresh balances/allowances after each confirmation
  }, [receipt.isSuccess, refetch]);

  const needApproval = mode === "mint" ? components.findIndex((_, i) => allowance(i) < required[i]!) : -1;
  const shortfall =
    mode === "mint" ? components.findIndex((_, i) => bal(i) < required[i]!) : basketBal < amount ? 0 : -1;

  function act() {
    if (!address || amount === 0n) return;
    reset();
    if (needApproval >= 0) {
      writeContract({
        address: components[needApproval]!.token,
        abi: erc20Abi,
        functionName: "approve",
        args: [basket, required[needApproval]!],
      });
    } else {
      writeContract({
        address: basket,
        abi: stockBasketAbi,
        functionName: mode,
        args: [amount, address],
      });
    }
  }

  let label = mode === "mint" ? `Mint ${symbol}` : `Redeem ${symbol}`;
  let disabled = busy || amount === 0n || !address;
  if (!address) label = "Connect a wallet to trade";
  else if (shortfall >= 0)
    ((label = mode === "mint" ? `Not enough ${components[shortfall]!.symbol}` : `Not enough ${symbol}`),
      (disabled = true));
  else if (needApproval >= 0) label = `Approve ${components[needApproval]!.symbol} (${needApproval + 1}/${components.length})`;
  if (busy) label = receipt.isLoading ? "Confirming…" : "Check your wallet…";

  if (restricted) {
    return (
      <aside className="h-fit rounded-xl border border-line bg-surface p-5 text-sm">
        <h2 className="font-semibold">Trading unavailable in your region</h2>
        <p className="mt-2 text-muted">
          Coinbase Tokenized Stocks are not offered to US persons, so minting and redeeming are disabled here. All
          data on this page stays public.
        </p>
      </aside>
    );
  }

  return (
    <aside className="h-fit space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="grid grid-cols-2 rounded-lg border border-line p-1 text-sm">
        {(["mint", "redeem"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              reset();
            }}
            className={`rounded-md py-1.5 capitalize ${mode === m ? "bg-accent text-white" : "text-muted"}`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="block text-sm">
        <span className="text-muted">Basket units</span>
        <input
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
          className="num mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-lg outline-none focus:border-accent"
        />
        {address && (
          <span className="mt-1 block text-xs text-muted">
            You hold {num(Number(basketBal) / 1e18, 6)} {symbol}
          </span>
        )}
      </label>

      <div className="space-y-1.5 text-sm">
        <div className="text-xs text-muted">{mode === "mint" ? "You deposit" : "You receive"}</div>
        {components.map((c, i) => (
          <div key={c.token} className="flex justify-between">
            <span>{c.symbol}</span>
            <span className={`num ${mode === "mint" && address && bal(i) < required[i]! ? "text-warn" : ""}`}>
              {num(Number(required[i]) / 1e8, 8)}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={act}
        disabled={disabled}
        className="w-full rounded-lg bg-accent py-2.5 font-medium text-white disabled:opacity-50"
      >
        {label}
      </button>

      {receipt.isSuccess && <p className="text-sm text-good">Confirmed.</p>}
      {error && <p className="break-words text-sm text-warn">{error.message.split("\n")[0]}</p>}
      <p className="text-xs text-muted">
        Mint and redeem are in-kind and never read a price, so they work while markets are closed.
      </p>
    </aside>
  );
}
