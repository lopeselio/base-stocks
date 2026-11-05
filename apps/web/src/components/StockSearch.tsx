"use client";

import { useMemo, useState } from "react";
import { basescan, compactUsd, num, usd } from "@/lib/format";

interface Row {
  symbol: string;
  name: string;
  contractAddress: string;
  multiplier: number;
  navPrice?: number;
  supply: number;
}

export function StockSearch({ stocks }: { stocks: Row[] }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? stocks.filter((r) => r.symbol.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)) : stocks;
  }, [q, stocks]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ticker or company"
        aria-label="Search stocks"
        className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 outline-none focus:border-accent"
      />
      <p className="text-xs text-muted">{rows.length} shown</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 text-right font-medium">NAV</th>
              <th className="px-5 py-3 text-right font-medium">Shares / token</th>
              <th className="px-5 py-3 text-right font-medium">Onchain value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contractAddress} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <a href={basescan(r.contractAddress)} className="font-medium hover:text-accent">
                    {r.symbol}
                  </a>
                  <div className="text-xs text-muted">{r.name}</div>
                </td>
                <td className="num px-5 py-3 text-right">{r.navPrice ? usd(r.navPrice) : "—"}</td>
                <td className="num px-5 py-3 text-right">{num(r.multiplier, 6)}</td>
                <td className="num px-5 py-3 text-right">
                  {r.navPrice ? compactUsd(r.navPrice * r.supply) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
