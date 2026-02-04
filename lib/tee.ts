/**
 * Private Ephemeral Rollup (PER) / TEE auth and verification
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { getAuthToken, verifyTeeRpcIntegrity } from '@magicblock-labs/ephemeral-rollups-sdk'
import { PER_TEE } from '@/constants'
import type { WalletContextState } from '@solana/wallet-adapter-react'

const TEE_RPC_URL = PER_TEE.RPC_URL

/**
 * Get Connection to TEE/PER RPC for sending transactions to the Ephemeral Rollup
 * (e.g. schedule_execute_intent after delegate → crank runs on-chain automatically).
 */
export function getTeeConnection(authToken: string): Connection {
  const url = authToken ? `${TEE_RPC_URL}?token=${encodeURIComponent(authToken)}` : TEE_RPC_URL
  return new Connection(url, { commitment: 'confirmed' })
}

/**
 * Get authorization token for TEE RPC (PER). Wallet signs challenge; use token in getTeeConnection(token).
 */
export async function getTeeAuthToken(wallet: WalletContextState): Promise<{ token: string; expiresAt: number } | null> {
  if (!wallet.publicKey || !wallet.signMessage) return null
  try {
    const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
      const sig = await wallet.signMessage!(message)
      return typeof sig === 'object' && 'signature' in sig ? (sig as { signature: Uint8Array }).signature : (sig as Uint8Array)
    }
    return await getAuthToken(TEE_RPC_URL, wallet.publicKey, signMessage)
  } catch (e) {
    console.warn('TEE auth failed:', e)
    return null
  }
}

/**
 * Verify TEE RPC runs on attested hardware (optional; may load WASM).
 */
export async function verifyTeeIntegrity(): Promise<boolean> {
  try {
    return await verifyTeeRpcIntegrity(TEE_RPC_URL)
  } catch (e) {
    console.warn('TEE integrity check failed:', e)
    return false
  }
}
