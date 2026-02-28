export type CreDeliveryStatus = 'pending' | 'dispatched' | 'delivered' | 'failed'

export interface CreSecretRecord {
  secretRef: string
  secretHash: string
  encryptedPayload: string
  owner: string
  recipientEmail: string
  recipientEmailHash: string
  capsuleAddress?: string
  createdAt: number
  updatedAt: number
}

export interface CreDeliveryLedgerRecord {
  idempotencyKey: string
  capsuleAddress: string
  owner: string
  executedAt: number
  recipientEmail: string
  secretRef: string
  status: CreDeliveryStatus
  attempts: number
  providerMessageId?: string
  lastError?: string
  createdAt: number
  updatedAt: number
}

export interface DispatchCreDeliveryResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  idempotencyKey?: string
  status?: CreDeliveryStatus
  providerMessageId?: string
  error?: string
}
