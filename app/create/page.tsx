'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import dynamic from 'next/dynamic'
import { ArrowLeft, Clock, User, Shield, Eye, Plus, X, ArrowRight, CheckCircle } from 'lucide-react'

// Dynamic import to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)
import Link from 'next/link'
import Image from 'next/image'
import { createCapsule, getCapsule } from '@/lib/solana'
import { Beneficiary } from '@/types'
import { DEFAULT_VALUES, STORAGE_KEYS } from '@/constants'
import { encodeIntentData, daysToSeconds } from '@/utils/intent'
import {
  validateBeneficiaryAddresses,
  validateBeneficiaryAmounts,
  validatePercentageTotals,
} from '@/utils/validation'
import { isValidSolanaAddress } from '@/config/solana'
import Hero3D from '@/components/Hero3D'

export default function CreatePage() {
  const wallet = useWallet()
  const { publicKey, connected } = wallet
  const [intent, setIntent] = useState('')
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

    if (!validateBeneficiaries()) return

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
      const intentData = encodeIntentData({
        intent,
        beneficiaries,
        totalAmount,
        inactivityDays: inactivityDaysNum,
        delayDays: parseInt(delayDays),
      })

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
          console.log('Recreating capsule:', {
            executedAt: existingCapsule.executedAt,
            isActive: existingCapsule.isActive
          })
          // Use recreateCapsule for executed or deactivated capsules
          const { recreateCapsule } = await import('@/lib/solana')
          hash = await recreateCapsule(
            wallet as any,
            inactivityPeriodSeconds,
            intentData
          )
        } else {
          // Use createCapsule for new capsules (capsule doesn't exist)
          console.log('Creating new capsule')
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
        
        console.log('Saved creation transaction to localStorage:', hash)
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
        console.log('Transaction may have been processed. Checking if capsule was created...')
        try {
          // Wait a bit for the transaction to be confirmed
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Check if capsule was actually created
          if (publicKey) {
            const createdCapsule = await getCapsule(publicKey)
            if (createdCapsule && createdCapsule.isActive) {
              // Capsule was successfully created despite the error
              console.log('Capsule was successfully created despite error message')
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* 3D Hero Background */}
      <div className="fixed inset-0 w-full h-full z-0">
        <Hero3D />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:rotate-12">
              <Image
                src="/logo.svg"
                alt="Lucid Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">Lucid</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="material-elevation-2 rounded-lg overflow-hidden">
              <WalletMultiButton />
            </div>
            <Link href="/">
              <button className="material-button material-elevation-2 hover:material-elevation-4 flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-xl text-white rounded-lg border border-slate-700/50 hover:border-blue-500/50 transition-all">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative pt-24 pb-20 px-6 z-20">
        <div className="max-w-4xl mx-auto">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Create Memory Capsule
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-12">
              Define your intent. Set conditions. Preserve your decisions on Solana.
            </p>

            {!connected ? (
              <div className="material-card material-elevation-4 rounded-2xl p-12 text-center">
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-4">Connect Your Solana Wallet</h2>
                <p className="text-slate-300 mb-8">
                  Please connect your Solana wallet to create a Memory Capsule
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Existing Capsule Warning */}
                {existingCapsule && (
                  <div className="material-card material-elevation-4 rounded-2xl p-6 mb-6 bg-yellow-500/10 border-2 border-yellow-500/50">
                    <div className="flex items-start gap-4">
                      <Shield className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Existing Capsule Detected</h3>
                        <p className="text-slate-300 mb-4">
                          You already have a capsule for this wallet. Creating a new capsule will fail. 
                          Please visit your existing capsule to update or deactivate it first.
                        </p>
                        <Link href="/capsules">
                          <button className="material-button material-elevation-2 hover:material-elevation-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg font-semibold transition-all">
                            View My Capsule
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Intent Statement */}
                <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                      <Shield className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Intent Statement</h2>
                  </div>
                  <textarea
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder="If I am inactive for one year, transfer my assets to my family, and delegate DAO permissions to my co-founder."
                    className="w-full h-32 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors resize-none backdrop-blur-sm"
                  />
                  <p className="text-sm text-slate-400 mt-3">
                    Describe what should happen when you can no longer act
                  </p>
                </div>

                {/* Total Amount */}
                <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                      <User className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Total Token Amount</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-300 mb-2">Total Amount (SOL)</label>
                      <input
                        type="number"
                        value={totalAmount}
                        onChange={(e) => {
                          const value = e.target.value
                          setTotalAmount(value)
                          
                          // Auto-calculate percentages when total amount changes
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
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                    <p className="text-sm text-slate-400">
                      Enter the total amount of tokens to be distributed. If using percentages, amounts will be automatically calculated.
                    </p>
                  </div>
                </div>

                {/* Beneficiaries */}
                <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                        <User className="w-6 h-6 text-blue-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white">Beneficiaries (Solana Addresses)</h2>
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
                              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm backdrop-blur-sm"
                            />
                          </div>
                          
                          <div className="flex gap-2 items-center flex-shrink-0">
                            <input
                              type="number"
                              value={beneficiary.amount}
                              onChange={(e) => updateBeneficiary(index, 'amount', e.target.value)}
                              placeholder={beneficiary.amountType === 'percentage' ? '0%' : '0.0'}
                              step={beneficiary.amountType === 'percentage' ? '0.1' : '0.001'}
                              className="w-20 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors backdrop-blur-sm"
                            />
                            <div className="flex bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden flex-shrink-0 h-[52px] backdrop-blur-sm">
                              <button
                                type="button"
                                onClick={() => updateBeneficiary(index, 'amountType', 'fixed')}
                                className={`px-3 py-4 text-xs font-semibold transition-colors h-full flex items-center ${
                                  beneficiary.amountType === 'fixed'
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                SOL
                              </button>
                              <button
                                type="button"
                                onClick={() => updateBeneficiary(index, 'amountType', 'percentage')}
                                className={`px-3 py-4 text-xs font-semibold transition-colors h-full flex items-center ${
                                  beneficiary.amountType === 'percentage'
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                %
                              </button>
                            </div>
                            
                            {beneficiaries.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBeneficiary(index)}
                                className="p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-colors flex-shrink-0 backdrop-blur-sm"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {beneficiary.address && !isValidSolanaAddress(beneficiary.address) && (
                          <p className="text-xs text-red-400 ml-1">Invalid Solana address</p>
                        )}
                        {/* Real-time distribution summary */}
                        {beneficiary.address && beneficiary.amount && totalAmount && (
                          <div className="mt-2 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
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
                                <p className="text-sm text-slate-300">
                                  <span className="text-blue-400 font-semibold">{actualAmount.toFixed(6)} SOL</span>
                                  {' '}(<span className="text-blue-400 font-semibold">{percentage.toFixed(2)}%</span>)
                                  {' '}of <span className="text-white font-semibold">{total} SOL</span> will be distributed to this wallet
                                </p>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Total distribution summary and validation */}
                    {totalAmount && beneficiaries.some(b => b.address && b.amount) && (
                      <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                        {(() => {
                          const total = parseFloat(totalAmount) || 0
                          let totalDistributed = 0
                          const distributionDetails: Array<{ address: string; amount: number; percentage: number }> = []
                          
                          beneficiaries.forEach(b => {
                            if (b.address && b.amount) {
                              let actualAmount = 0
                              let percentage = 0
                              
                              if (b.amountType === 'fixed') {
                                actualAmount = parseFloat(b.amount) || 0
                                percentage = total > 0 ? (actualAmount / total) * 100 : 0
                              } else {
                                percentage = parseFloat(b.amount) || 0
                                actualAmount = total > 0 ? (total * percentage) / 100 : 0
                              }
                              
                              if (actualAmount > 0) {
                                totalDistributed += actualAmount
                                distributionDetails.push({
                                  address: b.address,
                                  amount: actualAmount,
                                  percentage: percentage
                                })
                              }
                            }
                          })
                          
                          const isExceeded = totalDistributed > total
                          const remaining = total - totalDistributed
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-300">Total to distribute:</span>
                                <span className={`font-semibold ${isExceeded ? 'text-red-400' : 'text-blue-400'}`}>
                                  {totalDistributed.toFixed(6)} / {total} SOL
                                </span>
                              </div>
                              {isExceeded && (
                                <p className="text-sm text-red-400 font-semibold">
                                  ⚠️ Error: Distribution exceeds total amount by {Math.abs(remaining).toFixed(6)} SOL
                                </p>
                              )}
                              {!isExceeded && remaining > 0 && (
                                <p className="text-sm text-yellow-400">
                                  Remaining: {remaining.toFixed(6)} SOL ({((remaining / total) * 100).toFixed(2)}%)
                                </p>
                              )}
                              {!isExceeded && remaining === 0 && (
                                <p className="text-sm text-green-400">
                                  ✓ All tokens distributed
                                </p>
                              )}
                              <div className="mt-3 space-y-1">
                                <p className="text-xs text-slate-400 font-semibold">Distribution breakdown:</p>
                                {distributionDetails.map((detail, idx) => (
                                  <p key={idx} className="text-xs text-slate-300 font-mono">
                                    {detail.address.slice(0, 8)}...{detail.address.slice(-8)}: {detail.amount.toFixed(6)} SOL ({detail.percentage.toFixed(2)}%)
                                  </p>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={addBeneficiary}
                      className="material-button material-elevation-1 hover:material-elevation-2 w-full flex items-center justify-center gap-2 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 transition-colors backdrop-blur-sm"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Beneficiary</span>
                    </button>
                  </div>
                  
                  <p className="text-sm text-slate-400 mt-4">
                    Add multiple beneficiaries with Solana addresses
                  </p>
                </div>

                {/* Trigger Conditions */}
                <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                      <Clock className="w-6 h-6 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Trigger Conditions</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-slate-300 mb-2">Target Date (Capsule Execution Date)</label>
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
                            const diffTime = selectedDate.getTime() - today.getTime()
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                            if (diffDays > 0) {
                              setInactivityDays(diffDays.toString())
                            } else {
                              setInactivityDays('')
                              alert('Please select a future date')
                            }
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors backdrop-blur-sm"
                      />
                      {targetDate && inactivityDays && (
                        <p className="text-xs text-blue-400 mt-2">
                          {inactivityDays} days until execution
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-2">Delay Window (days)</label>
                      <input
                        type="number"
                        value={delayDays}
                        onChange={(e) => setDelayDays(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-slate-300 mb-2">Or specify inactivity period manually (days)</label>
                    <input
                      type="number"
                      value={inactivityDays}
                      onChange={(e) => {
                        setInactivityDays(e.target.value)
                        if (e.target.value) {
                          const days = parseInt(e.target.value)
                          if (days > 0) {
                            const futureDate = new Date()
                            futureDate.setDate(futureDate.getDate() + days)
                            setTargetDate(futureDate.toISOString().split('T')[0])
                          }
                        }
                      }}
                      placeholder="Enter days"
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors backdrop-blur-sm"
                    />
                  </div>
                  <p className="text-sm text-slate-400 mt-4">
                    {targetDate 
                      ? `The capsule will trigger on ${new Date(targetDate).toLocaleDateString()}, with a ${delayDays}-day delay window`
                      : inactivityDays 
                        ? `The capsule will trigger after ${inactivityDays} days of inactivity, with a ${delayDays}-day delay window`
                        : 'Please select a target date or specify inactivity period'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={simulateExecution}
                    className="material-button material-elevation-2 hover:material-elevation-4 flex-1 px-8 py-4 bg-slate-800/60 hover:bg-slate-700/60 text-white rounded-xl font-semibold flex items-center justify-center gap-2 border border-slate-700/50 hover:border-blue-500/50 transition-all backdrop-blur-xl"
                  >
                    <Eye className="w-5 h-5" />
                    Simulate Execution
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isPending || !intent || !inactivityDays || parseInt(inactivityDays) <= 0 || beneficiaries.length === 0 || beneficiaries.some(b => !b.address || !b.amount)}
                    className="material-button material-elevation-4 hover:material-elevation-8 flex-1 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50"
                  >
                    {isPending ? 'Creating...' : 'Create Capsule'}
                  </button>
                </div>

                {error && (
                  <div className="material-card material-elevation-2 rounded-xl p-4 bg-red-500/20 border-2 border-red-500/50 text-red-400">
                    Error: {error}
                  </div>
                )}

                {txHash && (
                  <div className="material-card material-elevation-2 rounded-xl p-4 bg-green-500/20 border-2 border-green-500/50 text-green-400">
                    Capsule created successfully! Transaction: {txHash}
                  </div>
                )}

                {/* Simulation Modal */}
                {showSimulation && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="material-card material-elevation-8 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-slate-900/90 backdrop-blur-xl">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-white">Execution Simulation</h3>
                        <button
                          onClick={() => setShowSimulation(false)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                          <p className="text-sm text-slate-400 mb-2">Intent</p>
                          <p className="text-white">{intent || 'No intent specified'}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                          <p className="text-sm text-slate-400 mb-3">Beneficiaries</p>
                          <div className="space-y-2">
                            {beneficiaries.map((beneficiary, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                <p className="text-white font-mono text-sm">{beneficiary.address || 'Not set'}</p>
                                <p className="text-blue-400 font-semibold">
                                  {beneficiary.amount} {beneficiary.amountType === 'percentage' ? '%' : 'SOL'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                          <p className="text-sm text-slate-400 mb-2">Trigger Conditions</p>
                          <p className="text-white">
                            After {inactivityDays} days of inactivity + {delayDays} day delay window
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/50 rounded-xl p-4">
                          <p className="text-blue-300 font-semibold flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Execution would succeed
                          </p>
                          <p className="text-sm text-blue-400 mt-2">
                            All conditions are met. The capsule would execute automatically.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowSimulation(false)}
                        className="material-button material-elevation-2 hover:material-elevation-4 mt-6 w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold transition-all"
                      >
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
    </div>
  )
}
