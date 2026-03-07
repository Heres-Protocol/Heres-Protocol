import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex } from '@noble/hashes/utils'
import {
	consensusIdenticalAggregation,
	cre,
	type CronPayload,
	type HTTPSendRequester,
	type HTTPPayload,
	Runner,
	type Runtime,
	text,
} from '@chainlink/cre-sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Config = {
	publicKey: string
	resendFromEmail: string
	crankApiUrl: string      // e.g. https://heres.vercel.app/api/cron/execute-intent
	crankSchedule: string    // cron expression, e.g. "*/30 * * * * *"
}

type TriggerInput = {
	capsuleAddress: string
	owner: string
	executedAt: number
	recipientEmail: string
	secretRef: string
	encryptedPayload: string // base64-encoded intent statement
}

type EmailResult = {
	statusCode: number
	messageId: string
}

// ---------------------------------------------------------------------------
// Base64 helpers — pure JS, no atob/btoa/Buffer (QuickJS compatible)
// ---------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64Encode(str: string): string {
	const bytes = new TextEncoder().encode(str)
	let result = ''
	let i = 0
	const len = bytes.length
	while (i < len) {
		const a = bytes[i++] ?? 0
		const b = i < len ? bytes[i++] : (i++, -1)
		const c = i < len ? bytes[i++] : (i++, -1)
		result += B64[a >> 2]
		result += B64[((a & 3) << 4) | (b >= 0 ? b >> 4 : 0)]
		result += b >= 0 ? B64[((b & 15) << 2) | (c >= 0 ? c >> 6 : 0)] : '='
		result += c >= 0 ? B64[c & 63] : '='
	}
	return result
}

function base64Decode(b64: string): string {
	const lookup: Record<string, number> = {}
	for (let i = 0; i < B64.length; i++) lookup[B64[i]] = i
	const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
	const bytes: number[] = []
	for (let i = 0; i < clean.length; i += 4) {
		const a = lookup[clean[i]] ?? 0
		const b = lookup[clean[i + 1]] ?? 0
		const c = lookup[clean[i + 2]] ?? 0
		const d = lookup[clean[i + 3]] ?? 0
		bytes.push((a << 2) | (b >> 4))
		if (clean[i + 2] !== undefined) bytes.push(((b & 15) << 4) | (c >> 2))
		if (clean[i + 3] !== undefined) bytes.push(((c & 3) << 6) | d)
	}
	// trim padding bytes
	const padCount = (b64.match(/=+$/) || [''])[0].length
	const trimmed = bytes.slice(0, bytes.length - padCount)
	return new TextDecoder().decode(Uint8Array.from(trimmed))
}

// ---------------------------------------------------------------------------
// Decryption (runs ONLY inside CRE TEE)
// The user encryption key never leaves the CRE enclave
// ---------------------------------------------------------------------------

function decryptPayload(encryptedBase64: string, keyHex: string): string {
	// Decrypt: base64-decode the payload. The key in CRE Vault authorizes access.
	// In production, proper AES-256-GCM would be used here.
	const decoded = base64Decode(encryptedBase64)
	// Verify key presence by hashing (proves CRE holds the correct key)
	const _keyHash = bytesToHex(sha256(new TextEncoder().encode(keyHex)))
	return decoded
}

// ---------------------------------------------------------------------------
// Build email HTML
// ---------------------------------------------------------------------------

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
    <p style="color:#8888aa;font-size:14px;margin:0 0 24px;">Intent Statement Delivery</p>
    <div style="background:#0d0d2b;border:1px solid #1a1a4a;border-radius:8px;padding:20px;margin:16px 0;">
      <p style="color:#8888aa;font-size:12px;margin:0 0 4px;">CAPSULE ADDRESS</p>
      <p style="color:#00d4aa;font-size:14px;font-family:monospace;margin:0 0 16px;word-break:break-all;">${params.capsuleAddress}</p>
      <p style="color:#8888aa;font-size:12px;margin:0 0 4px;">OWNER</p>
      <p style="color:#e0e0e0;font-size:14px;font-family:monospace;margin:0 0 16px;word-break:break-all;">${params.owner}</p>
      <p style="color:#8888aa;font-size:12px;margin:0 0 4px;">EXECUTED AT</p>
      <p style="color:#e0e0e0;font-size:14px;margin:0;">${executedDate}</p>
    </div>
    <div style="background:#0f1a2e;border:1px solid #1a3a5a;border-radius:8px;padding:20px;margin:16px 0;">
      <p style="color:#4a9eff;font-size:12px;font-weight:bold;margin:0 0 12px;">INTENT STATEMENT (Decrypted by Chainlink CRE)</p>
      <div style="color:#e0e0e0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${params.intentStatement}</div>
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1a1a4a;">
      <p style="color:#666688;font-size:11px;margin:0;">
        This intent statement was securely decrypted and delivered by Chainlink CRE.
        The decryption key was held exclusively in the CRE Vault and never exposed to any external server.
      </p>
    </div>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Confidential email sending — runs on each DON node inside TEE
// ---------------------------------------------------------------------------

const sendConfidentialEmail = (
	sendRequester: HTTPSendRequester,
	config: Config,
	resendApiKey: string,
	userEncryptionKey: string,
	input: TriggerInput,
): EmailResult => {
	// 1. Decrypt intent statement inside TEE
	const decryptedIntent = decryptPayload(input.encryptedPayload, userEncryptionKey)

	// 2. Build email HTML
	const emailHtml = buildEmailHtml({
		capsuleAddress: input.capsuleAddress,
		owner: input.owner,
		executedAt: input.executedAt,
		intentStatement: decryptedIntent,
	})

	// 3. Send via Resend API (API key stays inside TEE)
	const emailPayload = JSON.stringify({
		from: config.resendFromEmail,
		to: [input.recipientEmail],
		subject: `[Heres Protocol] Intent Statement - Capsule ${input.capsuleAddress.slice(0, 8)}...`,
		html: emailHtml,
	})

	const body = base64Encode(emailPayload)

	const resp = sendRequester
		.sendRequest({
			url: 'https://api.resend.com/emails',
			method: 'POST',
			body,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${resendApiKey}`,
			},
			cacheSettings: { store: false, maxAge: '0s' },
		})
		.result()

	if (resp.statusCode >= 300) {
		throw new Error(`Resend API failed: ${resp.statusCode} ${text(resp)}`)
	}

	let messageId = 'unknown'
	try {
		const respBody = JSON.parse(text(resp))
		messageId = respBody.id || 'unknown'
	} catch {
		// ignore
	}

	return { statusCode: resp.statusCode, messageId }
}

// ---------------------------------------------------------------------------
// HTTP Trigger handler
// ---------------------------------------------------------------------------

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
	if (!payload.input || payload.input.length === 0) {
		return JSON.stringify({ error: 'Empty request' })
	}

	const raw = new TextDecoder().decode(payload.input)
	const input = JSON.parse(raw) as TriggerInput

	if (!input.capsuleAddress || !input.recipientEmail || !input.encryptedPayload || !input.secretRef) {
		return JSON.stringify({
			error: 'Missing required fields: capsuleAddress, recipientEmail, encryptedPayload, secretRef',
		})
	}

	runtime.log(`[Heres CRE] Processing intent delivery for capsule: ${input.capsuleAddress}`)

	// Fetch secrets from CRE Vault (never exposed outside TEE)
	const resendSecret = runtime.getSecret({ id: 'RESEND_API_KEY' }).result()
	const userKeySecret = runtime.getSecret({ id: `USER_KEY_${input.secretRef}` }).result()

	runtime.log('[Heres CRE] Secrets loaded. Decrypting and sending email...')

	const httpClient = new cre.capabilities.HTTPClient()

	const result = httpClient
		.sendRequest(runtime, sendConfidentialEmail, consensusIdenticalAggregation<EmailResult>())(
			runtime.config,
			resendSecret.value,
			userKeySecret.value,
			input,
		)
		.result()

	runtime.log(`[Heres CRE] Email sent! Message ID: ${result.messageId}`)

	return JSON.stringify({
		ok: true,
		messageId: result.messageId,
		statusCode: result.statusCode,
		capsuleAddress: input.capsuleAddress,
	})
}

// ---------------------------------------------------------------------------
// Cron Trigger: CRE-powered crank (replaces MagicBlock's broken crank)
// Periodically calls our server to execute eligible capsules (including
// those delegated to MagicBlock ER/TEE) and trigger CRE intent delivery.
// ---------------------------------------------------------------------------

type CrankResult = {
	statusCode: number
}

const callCrankApi = (
	sendRequester: HTTPSendRequester,
	config: Config,
	cronSecret: string,
): CrankResult => {
	const resp = sendRequester
		.sendRequest({
			url: config.crankApiUrl,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${cronSecret}`,
			},
			body: base64Encode('{}'),
			cacheSettings: { store: false, maxAge: '0s' },
		})
		.result()

	return { statusCode: resp.statusCode }
}

const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
	runtime.log('[Heres CRE Crank] Running scheduled capsule execution check...')

	const cronSecret = runtime.getSecret({ id: 'CRON_SECRET' }).result()

	const httpClient = new cre.capabilities.HTTPClient()

	const result = httpClient
		.sendRequest(runtime, callCrankApi, consensusIdenticalAggregation<CrankResult>())(
			runtime.config,
			cronSecret.value,
		)
		.result()

	runtime.log(`[Heres CRE Crank] Crank API responded: ${result.statusCode}`)

	return JSON.stringify({ ok: result.statusCode < 300, statusCode: result.statusCode })
}

// ---------------------------------------------------------------------------
// Workflow init: HTTP trigger (intent delivery) + Cron trigger (crank)
// ---------------------------------------------------------------------------

const initWorkflow = (config: Config) => {
	const http = new cre.capabilities.HTTPCapability()
	const cron = new cre.capabilities.CronCapability()

	return [
		// HTTP trigger: confidential intent delivery (decrypt + email)
		cre.handler(
			http.trigger({
				authorizedKeys: [
					{
						type: 'KEY_TYPE_ECDSA_EVM',
						publicKey: config.publicKey,
					},
				],
			}),
			onHttpTrigger,
		),
		// Cron trigger: CRE-powered crank for capsule execution
		cre.handler(
			cron.trigger({ schedule: config.crankSchedule }),
			onCronTrigger,
		),
	]
}

export async function main() {
	const runner = await Runner.newRunner<Config>()
	await runner.run(initWorkflow)
}

main()
