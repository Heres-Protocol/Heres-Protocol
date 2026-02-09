'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import type { WalletName } from '@solana/wallet-adapter-base'
import dynamic from 'next/dynamic'
import { ArrowLeft, Clock, User, Shield, Eye, Plus, X, CheckCircle, ChevronDown, ChevronUp, Database, Coins, ImageIcon, ExternalLink } from 'lucide-react'

// Dynamic import to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)
import Link from 'next/link'
import { createCapsule, getCapsule } from '@/lib/solana'
import { Beneficiary } from '@/types'
import { DEFAULT_VALUES, STORAGE_KEYS, SOLANA_CONFIG, PLATFORM_FEE } from '@/constants'
import { getNftsByOwner } from '@/lib/helius'
import { encodeIntentData, daysToSeconds } from '@/utils/intent'
import {
  validateBeneficiaryAddresses,
  validateBeneficiaryAmounts,
  validatePercentageTotals,
} from '@/utils/validation'
import { isValidSolanaAddress, getSolanaConnection } from '@/config/solana'
import { PublicKey } from '@solana/web3.js'

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

export type CapsuleAssetType = 'token' | 'nft' | null

export type NftItem = { mint: string; name?: string; symbol?: string; imageUri?: string }

export default function CreatePage() {
  const wallet = useWallet()
  const { publicKey, connected, disconnect, select, wallets } = wallet
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [intent, setIntent] = useState('')
  const [capsuleType, setCapsuleType] = useState<CapsuleAssetType>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { address: '', amount: '', amountType: 'fixed' }
  ])
  const [totalAmount, setTotalAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [inactivityDays, setInactivityDays] = useState('')
  const [delayDays, setDelayDays] = useState<string>(DEFAULT_VALUES.DELAY_DAYS)
  const [showSimulation, setShowSimulation] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingCapsule, setExistingCapsule] = useState<boolean>(false)
  // NFT flow
  const [nftList, setNftList] = useState<NftItem[]>([])
  const [nftListLoading, setNftListLoading] = useState(false)
  const [selectedNftMints, setSelectedNftMints] = useState<string[]>([])
  const [nftRecipients, setNftRecipients] = useState<{ address: string }[]>([{ address: '' }])
  const [nftAssignments, setNftAssignments] = useState<Record<string, number>>({})

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showWalletMenu && !target.closest('.wallet-menu-container')) {
        setShowWalletMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showWalletMenu])

  // Fetch wallet NFTs when NFT path is selected (Helius DAS when API key set, else RPC)
  useEffect(() => {
    if (capsuleType !== 'nft' || !publicKey || !connected) return
    let cancelled = false
    setNftListLoading(true)

    const run = async () => {
      if (SOLANA_CONFIG.HELIUS_API_KEY) {
        try {
          const items = await getNftsByOwner(publicKey.toBase58())
          if (cancelled) return
          const nfts: NftItem[] = items.map((item) => ({
            mint: item.mint,
            name: item.name,
            symbol: item.symbol,
            imageUri: item.imageUri,
          }))
          setNftList(nfts)
        } catch {
          if (!cancelled) setNftList([])
        } finally {
          if (!cancelled) setNftListLoading(false)
        }
        return
      }

      const connection = getSolanaConnection()
      connection
        .getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
        .then(({ value }) => {
          if (cancelled) return
          const nfts: NftItem[] = value
            .filter((acc) => {
              const info = acc.account?.data?.parsed?.info
              if (!info?.tokenAmount) return false
              const decimals = Number(info.tokenAmount.decimals)
              const amount = info.tokenAmount.amount ?? info.tokenAmount.uiAmount
              return decimals === 0 && (Number(amount) === 1 || amount === '1')
            })
            .map((acc) => {
              const info = acc.account?.data?.parsed?.info
              const mint = info?.mint ?? ''
              return { mint, name: undefined, symbol: undefined }
            })
          setNftList(nfts)
        })
        .catch(() => {
          if (!cancelled) setNftList([])
        })
        .finally(() => {
          if (!cancelled) setNftListLoading(false)
        })
    }

    run()
    return () => { cancelled = true }
  }, [capsuleType, publicKey, connected])

  // Check for existing capsule on mount
  useEffect(() => {
    const checkExistingCapsule = async () => {
      if (connected && publicKey) {
        try {
          const capsule = await getCapsule(publicKey)
          // Only show warning if capsule is active AND not executed
          // If capsule is executed, we can recreate it, so don't show warning
          if (capsule && capsule.isActive && !capsule.executedAt) {
            setExistingCapsule(true)
          } else {
            // Allow creation/recreation if:
            // 1. Capsule doesn't exist
            // 2. Capsule is executed (executedAt is set) - can recreate
            // 3. Capsule exists but isActive is false
            setExistingCapsule(false)
          }
        } catch (err) {
          console.error('Error checking for existing capsule:', err)
          setExistingCapsule(false)
        }
      }
    }
    checkExistingCapsule()
  }, [connected, publicKey])

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { address: '', amount: '', amountType: 'fixed' }])
  }

  const removeBeneficiary = (index: number) => {
    if (beneficiaries.length > 1) {
      setBeneficiaries(beneficiaries.filter((_, i) => i !== index))
    }
  }

  const toggleNftSelection = (mint: string) => {
    setSelectedNftMints((prev) =>
      prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint]
    )
  }

  const addNftRecipient = () => {
    setNftRecipients((prev) => [...prev, { address: '' }])
  }

  const removeNftRecipient = (index: number) => {
    if (nftRecipients.length > 1) {
      setNftRecipients((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const setNftRecipientAddress = (index: number, address: string) => {
    setNftRecipients((prev) => {
      const next = [...prev]
      next[index] = { address }
      return next
    })
  }

  const setNftAssignment = (mint: string, recipientIndex: number) => {
    setNftAssignments((prev) => ({ ...prev, [mint]: recipientIndex }))
  }

  const updateBeneficiary = (index: number, field: keyof Beneficiary, value: string | 'fixed' | 'percentage') => {
    const updated = [...beneficiaries]
    const oldBeneficiary = updated[index]
    updated[index] = { ...updated[index], [field]: value }

    // Convert fixed to percentage when switching to percentage
    if (field === 'amountType' && value === 'percentage' && totalAmount) {
      if (oldBeneficiary.amountType === 'fixed' && oldBeneficiary.amount) {
        const fixedAmount = parseFloat(oldBeneficiary.amount)
        const total = parseFloat(totalAmount)
        if (total > 0) {
          updated[index].amount = ((fixedAmount / total) * 100).toFixed(2)
        }
      }
    }

    // Convert percentage to fixed when switching to fixed
    if (field === 'amountType' && value === 'fixed' && totalAmount) {
      if (oldBeneficiary.amountType === 'percentage' && oldBeneficiary.amount) {
        const percentage = parseFloat(oldBeneficiary.amount)
        const total = parseFloat(totalAmount)
        if (total > 0) {
          updated[index].amount = ((total * percentage) / 100).toFixed(6)
        }
      }
    }

    // Update percentage amounts when amount changes and type is percentage
    if (field === 'amount' && updated[index].amountType === 'percentage' && totalAmount) {
      const percentage = parseFloat(value as string)
      const total = parseFloat(totalAmount)
      if (total > 0 && !isNaN(percentage)) {
        // Keep percentage, but validate it's between 0-100
        if (percentage > 100) {
          updated[index].amount = '100'
        } else if (percentage < 0) {
          updated[index].amount = '0'
        }
      }
    }

    setBeneficiaries(updated)
  }

  const validateBeneficiaries = (): boolean => {
    if (!validateBeneficiaryAddresses(beneficiaries)) {
      alert('Please enter valid Solana addresses for all beneficiaries.')
      return false
    }

    if (!validateBeneficiaryAmounts(beneficiaries)) {
      alert('Please enter valid amounts for all beneficiaries.')
      return false
    }

    if (!validatePercentageTotals(beneficiaries)) {
      const percentageBeneficiaries = beneficiaries.filter(b => b.amountType === 'percentage')
      const totalPercentage = percentageBeneficiaries.reduce(
        (sum, b) => sum + parseFloat(b.amount || '0'),
        0
      )
      alert(`Total percentage must equal 100%. Current total: ${totalPercentage.toFixed(2)}%`)
      return false
    }

    return true
  }

  const handleCreate = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your Solana wallet')
      return
    }

    if (capsuleType === 'token' && !validateBeneficiaries()) return
    if (capsuleType === 'nft') {
      const validRecipients = nftRecipients.filter((r) => r.address.trim())
      if (selectedNftMints.length === 0) {
        alert('Please select at least one NFT.')
        return
      }
      if (validRecipients.length === 0) {
        alert('Please add at least one recipient address.')
        return
      }
      for (const addr of validRecipients) {
        if (!isValidSolanaAddress(addr.address)) {
          alert('Please enter a valid Solana address for all recipients.')
          return
        }
      }
    }

    if (!intent.trim()) {
      alert('Please enter an intent statement')
      return
    }

    if (!inactivityDays || parseInt(inactivityDays) <= 0) {
      alert('Please select a target date or specify a valid inactivity period')
      return
    }

    setIsPending(true)
    setError(null)

    try {
      // Check if capsule already exists and is active (not executed)
      if (publicKey) {
        const existingCapsule = await getCapsule(publicKey)
        // Only block if capsule is active AND not executed
        // If capsule is executed (executedAt is set), we can recreate it
        if (existingCapsule && existingCapsule.isActive && !existingCapsule.executedAt) {
          const errorMsg = 'You already have an active capsule. Please deactivate it first or update the existing one.'
          setError(errorMsg)
          alert(errorMsg + '\n\nYou can view your existing capsule at /capsules')
          setIsPending(false)
          return
        }
        // Allow creation/recreation if:
        // 1. Capsule doesn't exist
        // 2. Capsule is executed (executedAt is set) - will use recreateCapsule
        // 3. Capsule exists but isActive is false and executedAt is null (edge case)
      }

      const inactivityDaysNum = parseInt(inactivityDays)
      let intentData: Uint8Array
      if (capsuleType === 'nft') {
        const validRecipients = nftRecipients.filter((r) => r.address.trim()).map((r) => r.address)
        const payload = {
          type: 'nft',
          intent,
          nftMints: selectedNftMints,
          nftRecipients: validRecipients,
          nftAssignments,
          inactivityDays: inactivityDaysNum,
          delayDays: parseInt(delayDays),
        }
        intentData = new TextEncoder().encode(JSON.stringify(payload))
      } else {
        intentData = encodeIntentData({
          intent,
          beneficiaries,
          totalAmount,
          inactivityDays: inactivityDaysNum,
          delayDays: parseInt(delayDays),
        })
      }

      const inactivityPeriodSeconds = daysToSeconds(inactivityDaysNum)

      // Final check before submitting transaction - re-fetch to ensure state hasn't changed
      if (publicKey) {
        const finalCheck = await getCapsule(publicKey)
        if (finalCheck && finalCheck.isActive && !finalCheck.executedAt) {
          const errorMsg = 'You already have an active capsule. Please deactivate it first or update the existing one.'
          setError(errorMsg)
          alert(errorMsg + '\n\nYou can view your existing capsule at /capsules')
          setIsPending(false)
          return
        }
      }

      // Check if there's an executed capsule - if so, recreate it instead of creating new
      let hash: string
      if (publicKey) {
        // Re-fetch capsule to check current state (may have changed)
        const existingCapsule = await getCapsule(publicKey)

        // Use recreateCapsule if:
        // 1. Capsule exists AND
        // 2. (executedAt is set OR isActive is false)
        // This handles both executed capsules and deactivated capsules
        if (existingCapsule && (existingCapsule.executedAt || !existingCapsule.isActive)) {
          // Use recreateCapsule for executed or deactivated capsules
          const { recreateCapsule } = await import('@/lib/solana')
          hash = await recreateCapsule(
            wallet as any,
            inactivityPeriodSeconds,
            intentData
          )
        } else {
          hash = await createCapsule(
            wallet as any,
            inactivityPeriodSeconds,
            intentData
          )
        }
      } else {
        hash = await createCapsule(
          wallet as any,
          inactivityPeriodSeconds,
          intentData
        )
      }

      setTxHash(hash)

      // Save intent to localStorage
      if (intent.trim() && publicKey) {
        const key = STORAGE_KEYS.CAPSULE_INTENT(publicKey.toString(), Date.now())
        localStorage.setItem(key, intent)
      }

      // Save capsule creation transaction signature with unique key
      if (publicKey && hash) {
        // Save with signature in key to preserve all transactions
        const txKeyWithSig = STORAGE_KEYS.CAPSULE_CREATION_TX_WITH_SIG(publicKey.toString(), hash)
        localStorage.setItem(txKeyWithSig, hash)

        // Also save to the main key (for backward compatibility)
        const txKey = STORAGE_KEYS.CAPSULE_CREATION_TX(publicKey.toString())
        localStorage.setItem(txKey, hash)
      }

      alert(`Capsule created successfully! Transaction: ${hash}`)

      // Redirect to capsules page after successful creation
      window.location.href = '/capsules'
    } catch (err: any) {
      console.error('Error creating capsule:', err)
      let errorMessage = err.message || 'Failed to create capsule'

      // Check if error is "already processed" - this might mean the transaction succeeded
      // but we got an error response. Verify if capsule was actually created.
      if (errorMessage.includes('already processed') || errorMessage.includes('This transaction has already been processed')) {
        try {
          // Wait a bit for the transaction to be confirmed
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Check if capsule was actually created
          if (publicKey) {
            const createdCapsule = await getCapsule(publicKey)
            if (createdCapsule && createdCapsule.isActive) {
              alert('Capsule created successfully!')
              window.location.href = '/capsules'
              setIsPending(false)
              return
            }
          }
        } catch (checkError) {
          console.error('Error checking capsule after "already processed" error:', checkError)
        }

        // If capsule wasn't created, show appropriate error
        errorMessage = 'Transaction was already processed or duplicate submission. Please try again in a moment.'
      } else if (errorMessage.includes('already in use') || errorMessage.includes('custom program error: 0x0')) {
        errorMessage = 'A capsule already exists for this wallet. Please visit /capsules to view or update your existing capsule.'
      } else if (errorMessage.includes('Simulation failed')) {
        if (errorMessage.includes('already in use') || errorMessage.includes('already processed')) {
          errorMessage = 'A capsule already exists for this wallet. Please visit /capsules to view or update your existing capsule.'
        } else {
          // For other simulation failures, check if it's because capsule already exists
          try {
            if (publicKey) {
              const existingCapsule = await getCapsule(publicKey)
              if (existingCapsule && existingCapsule.isActive && !existingCapsule.executedAt) {
                errorMessage = 'You already have an active capsule. Please deactivate it first or update the existing one.'
              }
            }
          } catch (checkError) {
            console.error('Error checking capsule after simulation failure:', checkError)
          }
        }
      }

      setError(errorMessage)
      alert(`Error: ${errorMessage}`)
    } finally {
      setIsPending(false)
    }
  }

  const simulateExecution = () => {
    setShowSimulation(true)
  }

  return (
    <div className="min-h-screen bg-hero pt-24 pb-16">
      {/* Mobile: Heres nav as horizontal strip */}
      <div className="lg:hidden border-b border-Heres-border/50 bg-Heres-card/50 mb-6 -mt-2">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-Heres-muted mr-2">Heres</span>
          <Link href="/create" className="rounded-lg px-3 py-1.5 text-sm font-medium bg-Heres-accent/20 text-Heres-accent border border-Heres-accent/40">
            Create Capsule
          </Link>
          <Link href="/capsules" className="rounded-lg px-3 py-1.5 text-sm font-medium text-Heres-muted hover:text-Heres-white hover:bg-Heres-surface/80">
            My Capsules
          </Link>
          <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-sm font-medium text-Heres-muted hover:text-Heres-white hover:bg-Heres-surface/80">
            Dashboard
          </Link>
        </div>
      </div>

      {/* Left sidebar + main content */}
      <div className="flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Left sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 pt-2">
          <nav className="sticky top-24 space-y-1 rounded-2xl border border-Heres-border bg-Heres-card/80 backdrop-blur-xl p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-Heres-muted">Heres</p>
            <Link
              href="/create"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-Heres-accent bg-Heres-accent/10 border border-Heres-accent/30"
            >
              <Shield className="w-4 h-4 shrink-0" />
              Create Capsule
            </Link>
            <Link
              href="/capsules"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-Heres-muted hover:text-Heres-white hover:bg-Heres-surface/80 transition-colors"
            >
              <User className="w-4 h-4 shrink-0" />
              My Capsules
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-Heres-muted hover:text-Heres-white hover:bg-Heres-surface/80 transition-colors"
            >
              <Database className="w-4 h-4 shrink-0" />
              Dashboard
            </Link>
            <div className="border-t border-Heres-border my-2" />
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-Heres-muted hover:text-Heres-white hover:bg-Heres-surface/80 transition-colors"
            >
              ??Back to Home
            </Link>
          </nav>
        </aside>

        {/* Main content - right of sidebar */}
        <div className="flex-1 min-w-0 lg:pl-8">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-Heres-white sm:text-4xl">
              Create Capsule
            </h1>
            <p className="mt-2 max-w-2xl text-Heres-muted">
              Define your intent, set beneficiaries and conditions. Your capsule lives on Solana; delegate to Magicblock ER or PER (TEE) for private monitoring.
            </p>
            <p className="mt-1 text-xs text-Heres-muted/80">
              Delegation defaults to TEE (Private Ephemeral Rollup) for confidential conditions.
            </p>
          </header>

          {!connected ? (
            <div className="card-Heres p-12 text-center">
              <Shield className="mx-auto mb-6 h-16 w-16 text-Heres-accent" />
              <h2 className="mb-4 text-2xl font-bold text-Heres-white">Connect Your Wallet</h2>
              <p className="mb-8 text-Heres-muted">
                Connect Phantom or another Solana wallet to create a capsule.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {existingCapsule && (
                <div className="card-Heres p-6 border-Heres-accent/40 bg-Heres-accent/5">
                  <div className="flex items-start gap-4">
                    <Shield className="w-6 h-6 text-Heres-accent flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-Heres-accent mb-2">Existing Capsule Detected</h3>
                      <p className="text-Heres-muted mb-4">
                        You already have a capsule for this wallet. Please visit your existing capsule to update or deactivate it first.
                      </p>
                      <Link href="/capsules">
                        <span className="btn-secondary inline-block px-4 py-2 text-sm">View My Capsule</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="card-Heres p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-border flex items-center justify-center">
                    <Shield className="w-5 h-5 text-Heres-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-Heres-accent">Step 1</p>
                    <h2 className="text-xl font-bold text-Heres-white">Intent Statement</h2>
                  </div>
                </div>
                <textarea
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="If I am inactive for one year, transfer my assets to my family, and delegate DAO permissions to my co-founder."
                  className="w-full h-32 rounded-xl border border-Heres-border bg-Heres-surface/80 p-4 text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50 transition-colors resize-none"
                />
                <p className="text-sm text-Heres-muted mt-3">Describe what should happen when you can no longer act.</p>
              </div>

              {/* Getting Started style: choose Token or NFT */}
              <div className="card-Heres p-6 sm:p-8">
                <h2 className="text-xl font-bold text-Heres-white mb-2">Choose asset type</h2>
                <p className="text-sm text-Heres-muted mb-6">
                  Follow these steps to create your capsule successfully. Select whether to transfer tokens (SOL) or NFTs.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => setCapsuleType('token')}
                    className={`inline-flex items-center gap-3 rounded-xl border px-6 py-4 text-sm font-medium transition-colors ${capsuleType === 'token'
                      ? 'border-Heres-accent bg-Heres-accent/10 text-Heres-accent'
                      : 'border-Heres-border bg-Heres-card/80 text-Heres-white hover:border-Heres-accent/40 hover:bg-Heres-surface/80'
                      }`}
                  >
                    <Coins className="h-5 w-5 shrink-0" />
                    Token
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapsuleType('nft')}
                    className={`inline-flex items-center gap-3 rounded-xl border px-6 py-4 text-sm font-medium transition-colors ${capsuleType === 'nft'
                      ? 'border-Heres-accent bg-Heres-accent/10 text-Heres-accent'
                      : 'border-Heres-border bg-Heres-card/80 text-Heres-white hover:border-Heres-accent/40 hover:bg-Heres-surface/80'
                      }`}
                  >
                    <ImageIcon className="h-5 w-5 shrink-0" />
                    NFT
                    <ExternalLink className="h-4 w-4 shrink-0 opacity-70" />
                  </button>
                </div>
              </div>

              {/* Token path: Step 2 Total Amount */}
              {capsuleType === 'token' && (
                <div className="card-Heres p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-border flex items-center justify-center">
                      <User className="w-5 h-5 text-Heres-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-Heres-accent">Step 2</p>
                      <h2 className="text-xl font-bold text-Heres-white">Total Token Amount</h2>
                    </div>
                  </div>
                  <label className="block text-sm text-Heres-muted mb-2">Total Amount (SOL)</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => {
                      const value = e.target.value
                      setTotalAmount(value)
                      if (value && beneficiaries.some(b => b.amountType === 'percentage')) {
                        const total = parseFloat(value)
                        if (total > 0) {
                          const updated = beneficiaries.map(b => {
                            if (b.amountType === 'percentage' && b.amount) {
                              const percentage = parseFloat(b.amount)
                              return { ...b, amount: ((total * percentage) / 100).toFixed(6) }
                            }
                            return b
                          })
                          setBeneficiaries(updated)
                        }
                      }
                    }}
                    placeholder="0.0"
                    step="0.001"
                    className="w-full rounded-xl border border-Heres-border bg-Heres-surface/80 p-4 text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50 transition-colors"
                  />
                  <p className="text-sm text-Heres-muted mt-3">Amount to be distributed. Percentages are calculated automatically.</p>
                </div>
              )}

              {/* Token path: Step 3 Beneficiaries */}
              {capsuleType === 'token' && (
                <div className="card-Heres p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-border flex items-center justify-center">
                        <User className="w-5 h-5 text-Heres-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-Heres-accent">Step 3</p>
                        <h2 className="text-xl font-bold text-Heres-white">Beneficiaries</h2>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {beneficiaries.map((beneficiary, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-3 items-start">
                          <div className="flex-1 w-full min-w-0">
                            <input
                              type="text"
                              value={beneficiary.address}
                              onChange={(e) => updateBeneficiary(index, 'address', e.target.value.trim())}
                              placeholder="Solana address..."
                              className="w-full rounded-xl border border-Heres-border bg-Heres-surface/80 p-4 text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50 font-mono text-sm"
                            />
                          </div>
                          <div className="flex gap-2 items-center flex-shrink-0">
                            <input
                              type="number"
                              value={beneficiary.amount}
                              onChange={(e) => updateBeneficiary(index, 'amount', e.target.value)}
                              placeholder={beneficiary.amountType === 'percentage' ? '0%' : '0.0'}
                              step={beneficiary.amountType === 'percentage' ? '0.1' : '0.001'}
                              className="w-24 rounded-xl border border-Heres-border bg-Heres-surface/80 p-3 text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50 text-sm"
                            />
                            <div className="flex rounded-xl overflow-hidden border border-Heres-border bg-Heres-surface/80 h-[46px]">
                              <button
                                type="button"
                                onClick={() => updateBeneficiary(index, 'amountType', 'fixed')}
                                className={`px-3 text-xs font-semibold transition-colors h-full ${beneficiary.amountType === 'fixed' ? 'bg-Heres-accent text-Heres-bg' : 'text-Heres-muted hover:text-Heres-white'
                                  }`}
                              >
                                SOL
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBeneficiary(index, 'amountType', 'percentage')}
                                className={`px-3 text-xs font-semibold transition-colors h-full ${beneficiary.amountType === 'percentage' ? 'bg-Heres-accent text-Heres-bg' : 'text-Heres-muted hover:text-Heres-white'
                                  }`}
                              >
                                %
                              </button>
                            </div>
                            {beneficiaries.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBeneficiary(index)}
                                className="p-3 rounded-xl border border-Heres-border text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {beneficiary.address && !isValidSolanaAddress(beneficiary.address) && (
                          <p className="text-xs text-red-400">Invalid Solana address</p>
                        )}
                        {beneficiary.address && beneficiary.amount && totalAmount && (
                          <div className="mt-2 p-3 rounded-xl border border-Heres-border bg-Heres-surface/50">
                            {(() => {
                              const total = parseFloat(totalAmount)
                              let actualAmount = 0
                              let percentage = 0
                              if (beneficiary.amountType === 'fixed') {
                                actualAmount = parseFloat(beneficiary.amount) || 0
                                percentage = total > 0 ? (actualAmount / total) * 100 : 0
                              } else {
                                percentage = parseFloat(beneficiary.amount) || 0
                                actualAmount = total > 0 ? (total * percentage) / 100 : 0
                              }
                              return (
                                <p className="text-sm text-Heres-muted">
                                  <span className="text-Heres-accent font-semibold">{actualAmount.toFixed(6)} SOL</span>
                                  {' '}(<span className="text-Heres-accent font-semibold">{percentage.toFixed(2)}%</span>)
                                  {' '}of <span className="text-Heres-white font-semibold">{total} SOL</span>
                                </p>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                    {totalAmount && beneficiaries.some(b => b.address && b.amount) && (
                      <div className="mt-4 p-4 rounded-xl border border-Heres-border bg-Heres-surface/50 space-y-2">
                        {(() => {
                          const total = parseFloat(totalAmount) || 0
                          let totalDistributed = 0
                          beneficiaries.forEach(b => {
                            if (b.address && b.amount) {
                              const amt = b.amountType === 'fixed' ? parseFloat(b.amount) || 0 : (total * (parseFloat(b.amount) || 0)) / 100
                              totalDistributed += amt
                            }
                          })
                          const remaining = total - totalDistributed
                          const isExceeded = totalDistributed > total
                          return (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-Heres-muted">Total to distribute</span>
                                <span className={isExceeded ? 'text-red-400 font-semibold' : 'text-Heres-accent font-semibold'}>
                                  {totalDistributed.toFixed(6)} / {total} SOL
                                </span>
                              </div>
                              {isExceeded && <p className="text-sm text-red-400">Distribution exceeds total by {Math.abs(remaining).toFixed(6)} SOL</p>}
                              {!isExceeded && remaining > 0 && <p className="text-sm text-Heres-muted">Remaining: {remaining.toFixed(6)} SOL</p>}
                              {!isExceeded && remaining === 0 && <p className="text-sm text-Heres-accent">All tokens distributed</p>}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={addBeneficiary}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-Heres-border text-Heres-accent hover:border-Heres-accent/50 hover:bg-Heres-accent/5 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Add Beneficiary
                    </button>
                  </div>
                </div>
              )}

              {/* NFT path: Step 2 Select NFTs */}
              {capsuleType === 'nft' && (
                <div className="card-Heres p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-border flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-Heres-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-Heres-accent">Step 2</p>
                      <h2 className="text-xl font-bold text-Heres-white">Select NFTs</h2>
                    </div>
                  </div>
                  <p className="text-sm text-Heres-muted mb-4">Choose which NFTs from your wallet to include in this capsule. When conditions are met, they will be transferred to the recipients you set in the next step.</p>
                  {nftListLoading ? (
                    <p className="text-sm text-Heres-muted py-6">Loading your NFTs...</p>
                  ) : nftList.length === 0 ? (
                    <p className="text-sm text-Heres-muted py-6 rounded-xl border border-Heres-border bg-Heres-surface/50 px-4">No NFTs found in this wallet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl border border-Heres-border bg-Heres-surface/50 p-3">
                      {nftList.map((nft) => (
                        <label
                          key={nft.mint}
                          className="flex items-center gap-3 rounded-lg border border-Heres-border bg-Heres-card/80 p-3 cursor-pointer hover:border-Heres-accent/30 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedNftMints.includes(nft.mint)}
                            onChange={() => toggleNftSelection(nft.mint)}
                            className="h-4 w-4 rounded border-Heres-border bg-Heres-surface text-Heres-accent focus:ring-Heres-accent"
                          />
                          <span className="font-mono text-sm text-Heres-white truncate flex-1 min-w-0" title={nft.mint}>
                            {nft.mint.slice(0, 8)}...{nft.mint.slice(-8)}
                          </span>
                          {nft.name && <span className="text-sm text-Heres-muted truncate max-w-[120px]">{nft.name}</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedNftMints.length > 0 && (
                    <p className="text-sm text-Heres-accent mt-3">{selectedNftMints.length} NFT(s) selected</p>
                  )}
                </div>
              )}

              {/* NFT path: Step 3 Recipients & assignment */}
              {capsuleType === 'nft' && (
                <div className="card-Heres p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-border flex items-center justify-center">
                      <User className="w-5 h-5 text-Heres-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-Heres-accent">Step 3</p>
                      <h2 className="text-xl font-bold text-Heres-white">Recipients & assignment</h2>
                    </div>
                  </div>
                  <p className="text-sm text-Heres-muted mb-4">Add recipient wallet(s) and assign each selected NFT to a recipient. When the capsule executes, each NFT will be sent to its assigned recipient.</p>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-Heres-muted mb-2">Recipient addresses</p>
                      {nftRecipients.map((r, i) => (
                        <div key={i} className="flex gap-2 items-center mb-2">
                          <input
                            type="text"
                            value={r.address}
                            onChange={(e) => setNftRecipientAddress(i, e.target.value.trim())}
                            placeholder="Solana address..."
                            className="flex-1 rounded-xl border border-Heres-border bg-Heres-surface/80 p-3 text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50 font-mono text-sm"
                          />
                          {nftRecipients.length > 1 && (
                            <button type="button" onClick={() => removeNftRecipient(i)} className="p-2 rounded-lg border border-Heres-border text-red-400 hover:bg-red-500/10">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addNftRecipient} className="text-sm text-Heres-accent hover:underline flex items-center gap-1 mt-2">
                        <Plus className="w-4 h-4" /> Add recipient
                      </button>
                    </div>

                    {/* ??긽 ?쒖떆: ?좏깮??NFT蹂꾨줈 ?섏떊 吏媛?吏??*/}
                    {selectedNftMints.length > 0 && (
                      <div className="rounded-xl border border-Heres-border bg-Heres-surface/50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-Heres-accent mb-1">Which wallet receives which NFT</p>
                        <p className="text-sm text-Heres-muted mb-4">Select the recipient for each NFT. When the capsule executes, each NFT will be sent to the selected wallet.</p>
                        <div className="space-y-3">
                          {selectedNftMints.map((mint) => (
                            <div key={mint} className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                              <span className="font-mono text-sm text-Heres-white truncate min-w-[120px] sm:w-40" title={mint}>
                                NFT: {mint.slice(0, 8)}...{mint.slice(-8)}
                              </span>
                              <span className="text-Heres-muted shrink-0">??send to</span>
                              <select
                                value={nftAssignments[mint] ?? 0}
                                onChange={(e) => setNftAssignment(mint, Number(e.target.value))}
                                className="flex-1 min-w-0 rounded-lg border border-Heres-border bg-Heres-card/80 px-3 py-2.5 text-sm text-Heres-white focus:outline-none focus:border-Heres-accent/50"
                              >
                                {nftRecipients.map((r, i) => (
                                  <option key={i} value={i} className="bg-Heres-card text-Heres-white">
                                    {r.address.trim()
                                      ? `Recipient ${i + 1}: ${r.address.slice(0, 6)}...${r.address.slice(-4)}`
                                      : `Recipient ${i + 1} (enter address above)`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        {!nftRecipients.some((r) => r.address.trim()) && (
                          <p className="text-xs text-Heres-accent mt-3">Above, add at least one recipient address; then choose who receives each NFT here.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4 Trigger Conditions (shared) */}
              {capsuleType !== null && (
                <div className="card-Heres p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-border flex items-center justify-center">
                      <Clock className="w-5 h-5 text-Heres-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-Heres-accent">Step 4</p>
                      <h2 className="text-xl font-bold text-Heres-white">Trigger Conditions</h2>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-Heres-muted mb-2">Target Date</label>
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => {
                          setTargetDate(e.target.value)
                          if (e.target.value) {
                            const selectedDate = new Date(e.target.value)
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            selectedDate.setHours(0, 0, 0, 0)
                            const diffDays = Math.ceil((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                            if (diffDays > 0) setInactivityDays(diffDays.toString())
                            else { setInactivityDays(''); alert('Please select a future date') }
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-xl border border-Heres-border bg-Heres-surface/80 p-4 text-Heres-white focus:outline-none focus:border-Heres-accent/50"
                      />
                      {targetDate && inactivityDays && <p className="text-xs text-Heres-accent mt-2">{inactivityDays} days until execution</p>}
                    </div>
                    <div>
                      <label className="block text-sm text-Heres-muted mb-2">Delay Window (days)</label>
                      <input
                        type="number"
                        value={delayDays}
                        onChange={(e) => setDelayDays(e.target.value)}
                        className="w-full rounded-xl border border-Heres-border bg-Heres-surface/80 p-4 text-Heres-white focus:outline-none focus:border-Heres-accent/50"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm text-Heres-muted mb-2">Or inactivity period (days)</label>
                    <input
                      type="number"
                      value={inactivityDays}
                      onChange={(e) => {
                        setInactivityDays(e.target.value)
                        if (e.target.value) {
                          const days = parseInt(e.target.value)
                          if (days > 0) {
                            const d = new Date()
                            d.setDate(d.getDate() + days)
                            setTargetDate(d.toISOString().split('T')[0])
                          }
                        }
                      }}
                      placeholder="Enter days"
                      className="w-full rounded-xl border border-Heres-border bg-Heres-surface/80 p-4 text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50"
                    />
                  </div>
                  <p className="text-sm text-Heres-muted mt-4">
                    {targetDate ? `Triggers on ${new Date(targetDate).toLocaleDateString()}, ${delayDays}-day delay.` : inactivityDays ? `After ${inactivityDays} days of inactivity, ${delayDays}-day delay.` : 'Set target date or inactivity period.'}
                  </p>
                </div>
              )}

              {capsuleType !== null && (
                <>
                  <div className="rounded-xl border border-Heres-accent/30 bg-Heres-accent/10 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-Heres-accent" />
                      <span className="text-xs font-bold uppercase tracking-wider text-Heres-accent">Privacy Tier: PER (TEE)</span>
                    </div>
                    <p className="text-xs text-Heres-muted">
                      This capsule will be protected by MagicBlock's Private Ephemeral Rollup.
                      Hardware-secured (TEE) monitoring ensures your intent remains confidential until conditions are met.
                    </p>
                  </div>
                  <p className="text-xs text-Heres-muted">
                    Platform fee: {PLATFORM_FEE.CREATION_FEE_SOL} SOL (creation) + {PLATFORM_FEE.EXECUTION_FEE_BPS / 100}% (on execution)
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={simulateExecution}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3.5"
                    >
                      <Eye className="w-5 h-5" />
                      Simulate Execution
                    </button>
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-sm text-Heres-muted">Creation Fee</span>
                        <span className="text-sm font-semibold text-Heres-accent">{PLATFORM_FEE.CREATION_FEE_SOL} SOL</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={
                          isPending ||
                          existingCapsule ||
                          !connected ||
                          !publicKey ||
                          !intent.trim() ||
                          !inactivityDays ||
                          parseInt(inactivityDays) <= 0 ||
                          (capsuleType === 'token' && (beneficiaries.length === 0 || beneficiaries.some((b) => !b.address || !b.amount))) ||
                          (capsuleType === 'nft' && (selectedNftMints.length === 0 || !nftRecipients.some((r) => r.address.trim()) || nftRecipients.every((r) => !r.address.trim())))
                        }
                        className="btn-primary w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPending ? 'Creating...' : 'Create Capsule'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-xl p-4 border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
                  Error: {error}
                </div>
              )}
              {txHash && (
                <div className="rounded-xl p-4 border border-Heres-accent/50 bg-Heres-accent/10 text-Heres-accent text-sm">
                  Capsule created. Transaction: {txHash}
                </div>
              )}

              {showSimulation && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                  <div className="card-Heres rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-Heres-white">Execution Simulation</h3>
                      <button onClick={() => setShowSimulation(false)} className="text-Heres-muted hover:text-Heres-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-xl p-4 border border-Heres-border bg-Heres-surface/50">
                        <p className="text-xs text-Heres-accent mb-1">Intent</p>
                        <p className="text-Heres-white">{intent || 'No intent specified'}</p>
                      </div>
                      {capsuleType === 'token' && (
                        <div className="rounded-xl p-4 border border-Heres-border bg-Heres-surface/50">
                          <p className="text-xs text-Heres-accent mb-2">Beneficiaries</p>
                          <div className="space-y-2">
                            {beneficiaries.map((b, i) => (
                              <div key={i} className="flex justify-between p-2 rounded-lg bg-Heres-card/80">
                                <p className="font-mono text-sm text-Heres-white truncate max-w-[200px]">{b.address || 'Not set'}</p>
                                <p className="text-Heres-accent font-semibold text-sm">{b.amount} {b.amountType === 'percentage' ? '%' : 'SOL'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {capsuleType === 'nft' && (
                        <>
                          <div className="rounded-xl p-4 border border-Heres-border bg-Heres-surface/50">
                            <p className="text-xs text-Heres-accent mb-2">Selected NFTs</p>
                            <div className="space-y-1">
                              {selectedNftMints.map((mint) => (
                                <p key={mint} className="font-mono text-sm text-Heres-white truncate">{mint.slice(0, 12)}...{mint.slice(-8)}</p>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl p-4 border border-Heres-border bg-Heres-surface/50">
                            <p className="text-xs text-Heres-accent mb-2">Recipients & assignment</p>
                            <div className="space-y-2">
                              {selectedNftMints.map((mint) => {
                                const idx = nftAssignments[mint] ?? 0
                                const addr = nftRecipients[idx]?.address ?? ''
                                return (
                                  <div key={mint} className="flex justify-between items-center p-2 rounded-lg bg-Heres-card/80 text-sm">
                                    <span className="font-mono text-Heres-muted truncate max-w-[140px]">{mint.slice(0, 6)}...{mint.slice(-6)}</span>
                                    <span className="text-Heres-muted">→ send to</span>
                                    <span className="font-mono text-Heres-white truncate max-w-[160px]">{addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : 'Not set'}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}
                      <div className="rounded-xl p-4 border border-Heres-border bg-Heres-surface/50">
                        <p className="text-xs text-Heres-accent mb-1">Trigger</p>
                        <p className="text-Heres-white">After {inactivityDays} days of inactivity, {delayDays}-day delay.</p>
                      </div>
                      <div className="rounded-xl p-4 border border-Heres-accent/30 bg-Heres-accent/10">
                        <p className="text-Heres-accent font-semibold flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Execution would succeed
                        </p>
                        <p className="text-sm text-Heres-muted mt-1">All conditions met. Capsule would execute automatically.</p>
                      </div>
                    </div>
                    <button onClick={() => setShowSimulation(false)} className="btn-primary mt-6 w-full py-3">
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
