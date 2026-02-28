type EncryptedPayloadV1 = {
  v: 1
  alg: 'AES-GCM'
  kdf: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function sha256Hex(value: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment')
  }
  const input = new TextEncoder().encode(value) as BufferSource
  const digest = await window.crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function encryptPrivateMessage(message: string, unlockCode: string): Promise<string> {
  if (!message.trim()) throw new Error('Private message is required')
  if (!unlockCode.trim()) throw new Error('Unlock code is required')
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment')
  }

  const encoder = new TextEncoder()
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const iterations = 120_000
  const unlockInput = Uint8Array.from(encoder.encode(unlockCode))
  const messageInput = Uint8Array.from(encoder.encode(message))

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    unlockInput,
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    messageInput
  )

  const payload: EncryptedPayloadV1 = {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  }

  return JSON.stringify(payload)
}
