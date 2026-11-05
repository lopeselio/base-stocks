"use client";

import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { short } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected } = useConnection();
  const connectors = useConnectors();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="num rounded-md border border-line bg-surface px-3 py-1.5 text-ink hover:border-muted"
        title="Disconnect"
      >
        {short(address)}
      </button>
    );
  }
  const injected = connectors[0];
  return (
    <button
      disabled={!injected || isPending}
      onClick={() => injected && connect({ connector: injected })}
      className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
