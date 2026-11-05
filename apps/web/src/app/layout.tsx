import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/ConnectButton";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "base-stocks · onchain stock baskets",
  description:
    "Open-source baskets of Coinbase tokenized stocks (B20) on Base. In-kind mint and redeem, dividends compound via multipliers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="border-b border-line">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="inline-block h-3 w-3 rounded-sm bg-accent" aria-hidden />
                base-stocks
              </Link>
              <nav className="flex items-center gap-5 text-sm text-muted">
                <Link href="/stocks" className="hover:text-ink">
                  All stocks
                </Link>
                <a href="https://github.com/lopeselio/base-stocks" className="hover:text-ink">
                  GitHub
                </a>
                <ConnectButton />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-muted sm:px-6">
            Open-source demo built for Base Stocks Maxxing. Not affiliated with Coinbase or Base. Not financial
            advice. Coinbase Tokenized Stocks are not available to US persons, and trading is disabled for US visitors.
            Prices are Chainlink total-return values that hold their last value when markets are closed.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
