import { Connection, PublicKey } from '@solana/web3.js'
import { WalletContextState } from '@solana/wallet-adapter-react'
import { PER_TEE, MAGICBLOCK_ER } from '@/constants'
import { getAuthToken } from '@magicblock-labs/ephemeral-rollups-sdk'

/**
 * Get ER connection (Asia devnet) — no auth needed for public ER
 */
export function getErConnection(): Connection {
    return new Connection(MAGICBLOCK_ER.ER_RPC_URL, {
        commitment: 'confirmed',
        wsEndpoint: MAGICBLOCK_ER.ER_WS_URL,
    })
}

/**
 * Get ER RPC URL (Asia devnet)
 */
export function getErRpcUrl(): string {
    return MAGICBLOCK_ER.ER_RPC_URL
}

/**
 * Get TEE authentication token for PER (private) flows
 */
export async function getTeeAuthToken(wallet: WalletContextState): Promise<string> {
    if (!wallet.publicKey || !wallet.signMessage) {
        throw new Error('Wallet not connected or does not support message signing')
    }

    try {
        const { token } = await getAuthToken(
            PER_TEE.AUTH_URL,
            wallet.publicKey,
            wallet.signMessage
        )
        return token
    } catch (error) {
        console.error('Error getting TEE auth token:', error)
        throw error
    }
}

/**
 * Get authenticated TEE connection URL (PER only)
 */
export function getAuthenticatedTeeUrl(token: string): string {
    return `${PER_TEE.TEE_RPC_URL}?token=${token}`
}

/**
 * Get TEE connection (PER only)
 */
export function getTeeConnection(token?: string): Connection {
    const url = token ? getAuthenticatedTeeUrl(token) : PER_TEE.TEE_RPC_URL
    return new Connection(url, 'confirmed')
}

/**
 * Verify TEE RPC integrity (placeholder for future SDK feature)
 */
export async function verifyTeeRpcIntegrity(connection: Connection): Promise<boolean> {
    return true
}

/**
 * TEE/ER Authorization Utility
 */
export const TEE_AUTH = {
    getAuthToken: getTeeAuthToken,
    getAuthenticatedUrl: getAuthenticatedTeeUrl,
    getConnection: getTeeConnection,
    getErConnection: getErConnection,
    getErRpcUrl: getErRpcUrl,
    verifyIntegrity: verifyTeeRpcIntegrity,
}
