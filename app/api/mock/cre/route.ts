import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { safeEqualHex } from '@/lib/cre/auth'

type CreDispatchPayload = {
  idempotencyKey: string
  capsuleAddress: string
  owner: string
  executedAt: number
  recipientEmail: string
  secretRef: string
  secretHash: string
  encryptedPayload: string
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function getBaseUrl(request: NextRequest): string {
  return process.env.MOCK_CRE_CALLBACK_BASE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
}

function buildEmailHtml(params: {
  capsuleAddress: string
  owner: string
  executedAt: number
  intentStatement: string
}): string {
  const executedDate = new Date(params.executedAt * 1000).toUTCString()
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a1a;color:#e0e0e0;">
  <div style="background:linear-gradient(135deg,#1a1a3e,#0d0d2b);border:1px solid #2a2a5a;border-radius:12px;padding:32px;margin:20px 0;">
    <h1 style="color:#00d4aa;font-size:24px;margin:0 0 8px;">Heres Protocol</h1>
    <p style="color:#8888aa;font-size:14px;margin:0 0 24px;">Intent Statement Delivery (CRE Simulate)</p>
    <div style="background:#0d0d2b;border:1px solid #1a1a4a;border-radius:8px;padding:20px;margin:16px 0;">
      <p style="color:#8888aa;font-size:12px;margin:0 0 4px;">CAPSULE ADDRESS</p>
      <p style="color:#00d4aa;font-size:14px;font-family:monospace;margin:0 0 16px;word-break:break-all;">${params.capsuleAddress}</p>
      <p style="color:#8888aa;font-size:12px;margin:0 0 4px;">OWNER</p>
      <p style="color:#e0e0e0;font-size:14px;font-family:monospace;margin:0 0 16px;word-break:break-all;">${params.owner}</p>
      <p style="color:#8888aa;font-size:12px;margin:0 0 4px;">EXECUTED AT</p>
      <p style="color:#e0e0e0;font-size:14px;margin:0;">${executedDate}</p>
    </div>
    <div style="background:#0f1a2e;border:1px solid #1a3a5a;border-radius:8px;padding:20px;margin:16px 0;">
      <p style="color:#4a9eff;font-size:12px;font-weight:bold;margin:0 0 12px;">INTENT STATEMENT (Encrypted)</p>
      <div style="color:#e0e0e0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${params.intentStatement}</div>
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1a1a4a;">
      <p style="color:#666688;font-size:11px;margin:0;">
        This is a simulated CRE delivery. In production, the decryption key is held exclusively in the Chainlink CRE TEE Vault.
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendEmailViaResend(
  recipientEmail: string,
  capsuleAddress: string,
  owner: string,
  executedAt: number,
  encryptedPayload: string,
): Promise<{ messageId: string }> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) throw new Error('RESEND_API_KEY not configured')

  // The encryptedPayload is AES-GCM encrypted JSON: {"v":1,"alg":"AES-GCM","ciphertext":"..."}
  // In simulate mode we cannot decrypt (no unlock code), so display the metadata
  let intentStatement: string
  try {
    const parsed = JSON.parse(encryptedPayload)
    if (parsed.v === 1 && parsed.alg === 'AES-GCM') {
      intentStatement = [
        `Encryption: ${parsed.alg} (v${parsed.v})`,
        `KDF: ${parsed.kdf || 'N/A'}, ${parsed.iterations ? parsed.iterations.toLocaleString() + ' iterations' : ''}`,
        ``,
        `This intent statement is encrypted with the owner's unlock code.`,
        `In production, decryption happens inside the Chainlink CRE TEE Vault.`,
      ].join('\n')
    } else {
      intentStatement = JSON.stringify(parsed, null, 2)
    }
  } catch {
    intentStatement = encryptedPayload
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Heres Protocol <heres@sentidev.me>'
  const html = buildEmailHtml({ capsuleAddress, owner, executedAt, intentStatement })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      subject: `[Heres Protocol] Intent Statement - Capsule ${capsuleAddress.slice(0, 8)}...`,
      html,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Resend API error ${res.status}: ${errBody}`)
  }

  const data = await res.json() as { id?: string }
  return { messageId: data.id || `resend-${Date.now()}` }
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  let body: CreDispatchPayload
  try {
    body = JSON.parse(raw) as CreDispatchPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const signingSecret = process.env.CHAINLINK_CRE_SIGNING_SECRET
  const receivedSig = request.headers.get('x-cre-signature')
  if (signingSecret) {
    const expected = sign(signingSecret, raw)
    if (!receivedSig || !safeEqualHex(receivedSig, expected)) {
      return NextResponse.json({ ok: false, error: 'Invalid x-cre-signature' }, { status: 401 })
    }
  }

  const shouldFail = process.env.MOCK_CRE_FORCE_FAIL === 'true'
  const autoCallback = process.env.MOCK_CRE_AUTO_CALLBACK !== 'false'
  const callbackSecret = process.env.CHAINLINK_CRE_CALLBACK_SECRET
  // Simulate mode: send real email via Resend before callback
  const simulateMode = Boolean(process.env.RESEND_API_KEY)

  let providerMessageId: string | undefined
  let emailError: string | undefined

  // Send real email if RESEND_API_KEY is configured
  if (simulateMode && !shouldFail && body.recipientEmail) {
    try {
      const result = await sendEmailViaResend(
        body.recipientEmail,
        body.capsuleAddress,
        body.owner,
        body.executedAt,
        body.encryptedPayload,
      )
      providerMessageId = result.messageId
      console.log(`[CRE Simulate] Email sent to ${body.recipientEmail}, messageId: ${providerMessageId}`)
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err)
      console.error(`[CRE Simulate] Email failed:`, emailError)
    }
  }

  if (autoCallback) {
    const callbackBody = JSON.stringify({
      idempotencyKey: body.idempotencyKey,
      capsuleAddress: body.capsuleAddress,
      executedAt: body.executedAt,
      status: shouldFail || emailError ? 'failed' : 'delivered',
      providerMessageId: providerMessageId || (shouldFail ? undefined : `mock-cre-${Date.now()}`),
      error: shouldFail ? 'MOCK_CRE_FORCE_FAIL enabled' : emailError || undefined,
    })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (callbackSecret) {
      headers['x-cre-signature'] = sign(callbackSecret, callbackBody)
    }

    // Fire-and-forget: avoid self-fetch deadlock in Next.js dev mode
    // (dispatch -> mock/cre -> callback all on same server)
    const baseUrl = getBaseUrl(request)
    fetch(`${baseUrl}/api/cre/callback`, {
      method: 'POST',
      headers,
      body: callbackBody,
    }).catch((err) => {
      console.error('[Mock CRE] Callback fire-and-forget error:', err instanceof Error ? err.message : err)
    })
  }

  return NextResponse.json({
    ok: true,
    mode: simulateMode ? 'cre-simulate' : 'mock-cre',
    autoCallback,
    emailSent: simulateMode && !emailError,
    providerMessageId,
    status: shouldFail || emailError ? 'failed' : 'delivered',
    idempotencyKey: body.idempotencyKey,
  })
}
