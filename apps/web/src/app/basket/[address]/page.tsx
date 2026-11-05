import { notFound } from "next/navigation";
import { isAddress, type Address } from "viem";
import { api } from "@/lib/api";
import { isTradingRestricted } from "@/lib/geo";
import { basescan, num, short, usd } from "@/lib/format";
import { TradePanel } from "@/components/TradePanel";

export const revalidate = 30;

export default async function BasketPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  const [basket, restricted] = await Promise.all([api.basket(address as Address).catch(() => null), isTradingRestricted()]);
  if (!basket) notFound();

  const nav = basket.navPerUnit;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted">
            <a href={basescan(basket.address)} className="num hover:text-accent">
              {short(basket.address)}
            </a>
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {basket.symbol} <span className="text-muted">· {basket.name}</span>
          </h1>
          <div className="mt-4 flex flex-wrap gap-8">
            <Stat label="NAV per unit" value={usd(nav)} />
            <Stat label="Units outstanding" value={num(Number(basket.totalSupply) / 1e18, 4)} />
            <Stat label="Basket value" value={usd((nav * Number(basket.totalSupply)) / 1e18)} />
          </div>
          {!basket.navFresh && (
            <p className="mt-3 text-sm text-warn">
              One or more price feeds are stale (markets closed?). NAV is indicative only, but mint and redeem still
              work because they never use prices.
            </p>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Component</th>
                <th className="px-5 py-3 text-right font-medium">Tokens / unit</th>
                <th className="px-5 py-3 text-right font-medium">Shares / unit</th>
              </tr>
            </thead>
            <tbody>
              {basket.components.map((c) => (
                <tr key={c.token} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <a href={basescan(c.token)} className="font-medium hover:text-accent">
                      {c.symbol}
                    </a>
                  </td>
                  <td className="num px-5 py-3 text-right">{num(Number(c.unitAmount) / 1e8, 8)}</td>
                  <td className="num px-5 py-3 text-right">{num(Number(c.sharesPerUnit) / 1e8, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          Shares per unit grow when dividends are reinvested, because each stock token&apos;s multiplier rises. The
          basket never needs rebalancing.
        </p>
      </div>

      <TradePanel
        basket={basket.address}
        symbol={basket.symbol}
        restricted={restricted}
        components={basket.components.map((c) => ({
          token: c.token,
          symbol: c.symbol,
          unitAmount: c.unitAmount,
        }))}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-xl font-semibold">{value}</div>
    </div>
  );
}
