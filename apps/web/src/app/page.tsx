import Link from "next/link";
import { api } from "@/lib/api";
import { ago, basescan, num, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [board, preview, deployed] = await Promise.all([api.board(), api.mag7(), api.baskets().catch(() => [])]);

  return (
    <div className="space-y-14">
      <section className="max-w-3xl space-y-4">
        <p className="text-sm font-medium text-accent">Onchain stock baskets on Base</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Index funds you can mint on a Saturday.
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          A basket is an ERC-20 backed 1:1 by Coinbase tokenized stocks. You mint it by depositing the stocks and
          redeem it for them. Mint and redeem never read an oracle, and reinvested dividends compound automatically
          through each stock&apos;s multiplier.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold">Baskets</h2>
          {deployed.length === 0 && <span className="text-sm text-muted">Preview, not yet deployed</span>}
        </div>

        {deployed.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {deployed.map((b) => (
              <Link
                key={b.address}
                href={`/basket/${b.address}`}
                className="rounded-xl border border-line bg-surface p-5 hover:border-accent"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{b.symbol}</span>
                  <span className="num text-lg">{usd(b.navPerUnit)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {b.name} · {b.components.map((c) => c.symbol).join(" ")}
                </p>
                <p className="mt-3 text-xs text-muted">
                  {num(Number(b.totalSupply) / 1e18, 2)} units outstanding ·{" "}
                  {b.navFresh ? "all feeds fresh" : "some feeds stale (market closed?)"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line p-5">
              <div>
                <div className="font-semibold">bMAG7 · Base Mag7</div>
                <div className="text-sm text-muted">0.1 of each Magnificent 7 stock per basket unit</div>
              </div>
              <div className="text-right">
                <div className="num text-2xl font-semibold">{usd(preview.nav)}</div>
                <div className="text-xs text-muted">
                  NAV per unit · {preview.allFresh ? "all feeds fresh" : "some feeds stale"}
                </div>
              </div>
            </div>
            <ComponentTable rows={preview.components} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">Live board</h2>
          <Link href="/stocks" className="text-sm text-accent">
            All listed stocks →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 text-right font-medium">Price</th>
                <th className="px-5 py-3 text-right font-medium">Shares per token</th>
                <th className="px-5 py-3 text-right font-medium">Feed updated</th>
              </tr>
            </thead>
            <tbody>
              {board.map((r) => (
                <tr key={r.symbol} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <a href={basescan(r.token)} className="font-medium hover:text-accent">
                      {r.symbol}
                    </a>
                  </td>
                  <td className="num px-5 py-3 text-right">{usd(r.price)}</td>
                  <td className="num px-5 py-3 text-right">
                    {num(r.multiplier, 6)}
                    {r.pendingAt && <span className="ml-2 text-xs text-warn">change scheduled</span>}
                  </td>
                  <td className={`px-5 py-3 text-right ${r.stale ? "text-warn" : "text-muted"}`}>
                    {ago(r.updatedAt)}
                    {r.stale && " · stale"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ComponentTable({
  rows,
}: {
  rows: { symbol: string; units: number; shares: number; price: number; value: number; stale: boolean }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-5 py-3 font-medium">Component</th>
            <th className="px-5 py-3 text-right font-medium">Tokens / unit</th>
            <th className="px-5 py-3 text-right font-medium">Shares / unit</th>
            <th className="px-5 py-3 text-right font-medium">Price</th>
            <th className="px-5 py-3 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.symbol} className="border-b border-line last:border-0">
              <td className="px-5 py-3 font-medium">{c.symbol}</td>
              <td className="num px-5 py-3 text-right">{num(c.units)}</td>
              <td className="num px-5 py-3 text-right">{num(c.shares, 8)}</td>
              <td className={`num px-5 py-3 text-right ${c.stale ? "text-warn" : ""}`}>{usd(c.price)}</td>
              <td className="num px-5 py-3 text-right">{usd(c.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
