'use client'

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { useMemo, ReactNode } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'

export function Providers({ children }: { children: ReactNode }) {
  // Use devnet for Solana
  const network = WalletAdapterNetwork.Devnet
  const endpoint = useMemo(() => {
    // Use Helius RPC endpoint if available
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
    if (heliusApiKey) {
      return `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`
    }
    return clusterApiUrl(network)
  }, [network])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
