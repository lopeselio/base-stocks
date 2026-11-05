import { api } from "@/lib/api";
import { StockSearch } from "@/components/StockSearch";

export const dynamic = "force-dynamic";

export const metadata = { title: "All tokenized stocks · base-stocks" };

export default async function StocksPage() {
  const stocks = await api.stocks();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">All tokenized stocks</h1>
        <p className="mt-2 text-muted">
          {stocks.length} Coinbase tokenized stocks on Base, from the public Tokenized Stocks API. Sorted by onchain
          market value.
        </p>
      </div>
      <StockSearch stocks={stocks} />
    </div>
  );
}
