/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SOLANA_NETWORK?: string
    NEXT_PUBLIC_HELIUS_API_KEY?: string
    NEXT_PUBLIC_PROGRAM_ID?: string
    NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT?: string
    CHAINLINK_CRE_WEBHOOK_URL?: string
    CHAINLINK_CRE_API_KEY?: string
    CHAINLINK_CRE_SIGNING_SECRET?: string
    CHAINLINK_CRE_CALLBACK_SECRET?: string
    MOCK_CRE_AUTO_CALLBACK?: string
    MOCK_CRE_FORCE_FAIL?: string
    MOCK_CRE_CALLBACK_BASE_URL?: string
    OPS_ALERT_WEBHOOK_URL?: string
    CRON_SECRET?: string
    CRE_DISPATCH_SECRET?: string
    CRE_STORE_PATH?: string
  }
}
