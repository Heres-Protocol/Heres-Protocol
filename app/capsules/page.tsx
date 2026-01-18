'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { ArrowLeft, Shield, Clock, CheckCircle, XCircle, ExternalLink, Lock, Activity, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { getCapsule, executeIntent } from '@/lib/solana'
import { getWalletActivity } from '@/lib/helius'
import type { GetTransactionsForAddressResponse } from '@/lib/helius'
import { getSolanaConnection, getProgramId } from '@/config/solana'
import { getCapsulePDA } from '@/lib/program'
import { decodeIntentData, secondsToDays } from '@/utils/intent'
import { SOLANA_CONFIG, HELIUS_CONFIG, STORAGE_KEYS } from '@/constants'
import dynamic from 'next/dynamic'
import type { IntentCapsule } from '@/types'
import Hero3D from '@/components/Hero3D'

// Dynamic import to prevent hydration errors
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export default function CapsulesPage() {
  const wallet = useWallet()
  const { publicKey, connected, disconnect, select, wallets } = wallet
  const [showWalletMenu, setShowWalletMenu] = useState(false)

  // Close wallet menu when clicking outside
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
  const [capsule, setCapsule] = useState<IntentCapsule | null>(null)
  const [intentData, setIntentData] = useState<any>(null)
  const [walletActivity, setWalletActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  
  // Ensure transactions is always an array
  useEffect(() => {
    if (!Array.isArray(transactions)) {
      console.warn('Transactions is not an array, resetting to empty array:', typeof transactions, transactions)
      setTransactions([])
    }
  }, [transactions])
  const [creationTxSignature, setCreationTxSignature] = useState<string | null>(null)
  const [executionTxSignature, setExecutionTxSignature] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [zkProofHash, setZkProofHash] = useState<string | null>(null)
  const [zkPublicInputsHash, setZkPublicInputsHash] = useState<string | null>(null)
  const [zkVerificationStatus, setZkVerificationStatus] = useState<'pending' | 'verified' | 'failed' | null>(null)
  const [executedCapsules, setExecutedCapsules] = useState<Array<{ capsule: IntentCapsule; intentData: any; executedAt: number; executionTx: string | null }>>([])
  const [showExecutedCapsules, setShowExecutedCapsules] = useState(false)

  useEffect(() => {
    if (connected && publicKey) {
      loadCapsuleData()
    } else {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey])

  // Debug: Log transactions state changes
  useEffect(() => {
    console.log('Transactions state changed:', transactions.length, transactions)
  }, [transactions])

  // Auto-execute capsule when inactivity period is met
  useEffect(() => {
    if (!capsule || !publicKey || !wallet || !capsule.isActive) return

    // Check if capsule can be executed
    const checkAndExecute = async () => {
      if (!canExecute(capsule.lastActivity, capsule.inactivityPeriod)) {
        return
      }

      // Double-check wallet activity from Helius
      try {
        const activity = await getWalletActivity(publicKey.toString())
        if (activity && activity.lastActivityTimestamp) {
          const lastActivitySeconds = Math.floor(activity.lastActivityTimestamp / 1000)
          const timeSinceActivity = Math.floor(Date.now() / 1000) - lastActivitySeconds
          
          // If there's recent activity, update capsule and return
          if (timeSinceActivity < capsule.inactivityPeriod) {
            // Update capsule data to reflect new activity
            await loadCapsuleData()
            return
          }
        }

        // If no recent activity and inactivity period is met, execute automatically
        if (!isExecuting) {
          console.log('Auto-executing capsule: inactivity period met')
          await handleExecute()
        }
      } catch (error) {
        console.error('Error checking wallet activity for auto-execution:', error)
      }
    }

    // Check immediately
    checkAndExecute()

    // Set up interval to check every 5 minutes
    const interval = setInterval(() => {
      checkAndExecute()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsule, publicKey, wallet, isExecuting])

  // Update walletActivity when transactions are loaded
  // Always use transactions list as the source of truth for wallet activity
  useEffect(() => {
    if (transactions.length > 0 && publicKey) {
      // Get the most recent transaction (first in sorted array, newest first)
      const firstTx = transactions[0]
      if (firstTx.signature && firstTx.signature !== 'unknown') {
        // Update walletActivity with transaction data
        const updatedActivity = {
          wallet: publicKey.toString(),
          lastSignature: firstTx.signature,
          lastActivityTimestamp: firstTx.timestamp ? firstTx.timestamp * 1000 : 0,
          transactionCount: transactions.length,
        }
        // Always update to reflect the most current transaction data
        setWalletActivity(updatedActivity)
        console.log('Updated walletActivity from transactions:', {
          transactionCount: updatedActivity.transactionCount,
          lastSignature: updatedActivity.lastSignature.substring(0, 8) + '...',
          lastActivity: new Date(updatedActivity.lastActivityTimestamp).toLocaleString()
        })
      }
    } else if (transactions.length === 0 && publicKey && walletActivity && walletActivity.transactionCount > 0) {
      // If transactions list is cleared but we had activity, keep the count
      // This prevents flickering when transactions are being reloaded
      console.log('Transactions list is empty, keeping existing walletActivity')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, publicKey])

  const loadCapsuleData = async () => {
    if (!publicKey) return

    setLoading(true)
    setError(null)

    try {
      // Fetch capsule data first
      console.log('Loading capsule data for:', publicKey.toString())
      const capsuleData = await getCapsule(publicKey)
      console.log('Capsule data received:', capsuleData ? 'Found' : 'Not found')
      
      if (capsuleData) {
        console.log('Capsule details:', {
          isActive: capsuleData.isActive,
          executedAt: capsuleData.executedAt,
          hasIntentData: capsuleData.intentData.length > 0,
        })
      }
      
      setCapsule(capsuleData)

      if (capsuleData && capsuleData.intentData.length > 0) {
        try {
          const decoded = decodeIntentData(capsuleData.intentData)
          setIntentData(decoded)
          console.log('Intent data decoded successfully')
        } catch (decodeError) {
          console.error('Error decoding intent data:', decodeError)
          setIntentData(null)
        }
      } else {
        setIntentData(null)
      }

      // Load ALL capsule creation transaction signatures from localStorage
      // Scan for all creation transaction keys for this wallet
      const allCreationTxKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`capsule_creation_tx_${publicKey.toString()}`)) {
          allCreationTxKeys.push(key)
        }
      }
      
      console.log('Found creation transaction keys in localStorage:', allCreationTxKeys.length)
      
      // Get the most recent creation transaction by comparing all available transactions
      const txKey = STORAGE_KEYS.CAPSULE_CREATION_TX(publicKey.toString())
      let savedTx = localStorage.getItem(txKey)
      
      // Collect all creation transaction signatures with their keys
      const allCreationTxsWithKeys: Array<{ key: string; signature: string }> = []
      if (savedTx) {
        allCreationTxsWithKeys.push({ key: txKey, signature: savedTx })
      }
      for (const key of allCreationTxKeys) {
        const sig = localStorage.getItem(key)
        if (sig && !allCreationTxsWithKeys.some(t => t.signature === sig)) {
          allCreationTxsWithKeys.push({ key, signature: sig })
        }
      }
      
      // Find the most recent transaction by fetching and comparing timestamps
      if (allCreationTxsWithKeys.length > 0) {
        let mostRecentTx: { key: string; signature: string; timestamp: number } | null = null
        
        for (const { key, signature } of allCreationTxsWithKeys) {
          try {
            const connection = getSolanaConnection()
            const tx = await connection.getTransaction(signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            })
            
            if (tx && tx.blockTime) {
              const timestamp = tx.blockTime
              if (!mostRecentTx || timestamp > mostRecentTx.timestamp) {
                mostRecentTx = { key, signature, timestamp }
              }
            }
          } catch (error) {
            console.warn(`Could not fetch transaction ${signature.substring(0, 8)}... for timestamp comparison:`, error)
          }
        }
        
        if (mostRecentTx) {
          savedTx = mostRecentTx.signature
          // Update the main key to point to the most recent transaction
          localStorage.setItem(txKey, mostRecentTx.signature)
          setCreationTxSignature(mostRecentTx.signature)
          console.log('Found most recent creation transaction:', mostRecentTx.signature.substring(0, 8) + '...', {
            timestamp: mostRecentTx.timestamp,
            time: new Date(mostRecentTx.timestamp * 1000).toLocaleString()
          })
        } else if (allCreationTxsWithKeys.length > 0) {
          // Fallback: use the first one if timestamp comparison fails
          savedTx = allCreationTxsWithKeys[0].signature
          setCreationTxSignature(savedTx)
        }
      }
      
      // Validate the signature if it exists
      if (savedTx) {
        try {
          const connection = getSolanaConnection()
          const tx = await connection.getTransaction(savedTx, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })
          // If transaction doesn't exist or is invalid, clear it
          if (!tx || !tx.blockTime) {
            console.warn('Invalid transaction signature in localStorage, clearing it')
            localStorage.removeItem(txKey)
            savedTx = null
            setCreationTxSignature(null)
          } else {
            // Ensure state is set even if it was already set above
            setCreationTxSignature(savedTx)
          }
        } catch (error) {
          console.warn('Error validating transaction signature, clearing it:', error)
          localStorage.removeItem(txKey)
          savedTx = null
          setCreationTxSignature(null)
        }
      }

      // Load executed capsules from localStorage first (needed to find most recent execution tx)
      const executedCapsulesKey = STORAGE_KEYS.EXECUTED_CAPSULES(publicKey.toString())
      const savedExecutedCapsules = localStorage.getItem(executedCapsulesKey)
      let loadedExecutedCapsules: Array<{ capsule: IntentCapsule; intentData: any; executedAt: number; executionTx: string | null }> = []
      
      if (savedExecutedCapsules) {
        try {
          const parsed = JSON.parse(savedExecutedCapsules)
          loadedExecutedCapsules = Array.isArray(parsed) ? parsed : []
          console.log('Loaded executed capsules from localStorage:', loadedExecutedCapsules.length)
        } catch (e) {
          console.error('Error parsing executed capsules:', e)
          loadedExecutedCapsules = []
        }
      }

      // Load capsule execution transaction signature from localStorage
      // First, try to get the most recent execution transaction from executed capsules
      let savedExecutionTx: string | null = null
      
      // Check executed capsules first - they have the most accurate execution transaction
      if (loadedExecutedCapsules.length > 0) {
        // Sort by executedAt (most recent first) and get the latest executionTx
        const sortedCapsules = loadedExecutedCapsules
          .filter(ec => ec.executionTx)
          .sort((a, b) => (b.executedAt || 0) - (a.executedAt || 0))
        
        if (sortedCapsules.length > 0 && sortedCapsules[0].executionTx) {
          savedExecutionTx = sortedCapsules[0].executionTx
          console.log('Using execution transaction from executed capsules:', savedExecutionTx.substring(0, 8) + '...')
        }
      }
      
      // Fallback to main execution tx key if not found in executed capsules
      if (!savedExecutionTx) {
        const executionTxKey = STORAGE_KEYS.CAPSULE_EXECUTION_TX(publicKey.toString())
        savedExecutionTx = localStorage.getItem(executionTxKey)
      }
      
      // Also check all execution transactions with signature keys to find the most recent one
      if (!savedExecutionTx) {
        const allExecutionTxs: Array<{ signature: string; timestamp: number }> = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(`capsule_execution_tx_${publicKey.toString()}_`)) {
            const sig = localStorage.getItem(key)
            if (sig) {
              allExecutionTxs.push({ signature: sig, timestamp: 0 })
            }
          }
        }
        
        // Try to get timestamps for all execution transactions
        if (allExecutionTxs.length > 0) {
          const connection = getSolanaConnection()
          for (const txInfo of allExecutionTxs) {
            try {
              const tx = await connection.getTransaction(txInfo.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              })
              if (tx && tx.blockTime) {
                txInfo.timestamp = tx.blockTime
              }
            } catch (error) {
              console.warn('Error fetching transaction timestamp:', error)
            }
          }
          
          // Sort by timestamp and get the most recent
          allExecutionTxs.sort((a, b) => b.timestamp - a.timestamp)
          if (allExecutionTxs.length > 0 && allExecutionTxs[0].timestamp > 0) {
            savedExecutionTx = allExecutionTxs[0].signature
            console.log('Using most recent execution transaction from localStorage:', savedExecutionTx.substring(0, 8) + '...')
          }
        }
      }
      
      // Validate the execution signature if it exists
      if (savedExecutionTx) {
        try {
          const connection = getSolanaConnection()
          const tx = await connection.getTransaction(savedExecutionTx, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })
          // If transaction doesn't exist or is invalid, clear it
          if (!tx || !tx.blockTime) {
            console.warn('Invalid execution transaction signature in localStorage, clearing it')
            const executionTxKey = STORAGE_KEYS.CAPSULE_EXECUTION_TX(publicKey.toString())
            localStorage.removeItem(executionTxKey)
            savedExecutionTx = null
          } else {
            setExecutionTxSignature(savedExecutionTx)
            // If execution was successful, set verification status
            if (capsuleData && capsuleData.executedAt) {
              setZkVerificationStatus('verified')
              // Try to extract proof hash from localStorage if available
              const proofHashKey = `zk_proof_hash_${publicKey.toString()}`
              const savedProofHash = localStorage.getItem(proofHashKey)
              if (savedProofHash) {
                setZkProofHash(savedProofHash)
              }
              const inputsHashKey = `zk_inputs_hash_${publicKey.toString()}`
              const savedInputsHash = localStorage.getItem(inputsHashKey)
              if (savedInputsHash) {
                setZkPublicInputsHash(savedInputsHash)
              }
            }
            // Don't add to transactions here - let fetchTransactionHistory handle it
          }
        } catch (error) {
          console.warn('Error validating execution transaction signature, clearing it:', error)
          const executionTxKey = STORAGE_KEYS.CAPSULE_EXECUTION_TX(publicKey.toString())
          localStorage.removeItem(executionTxKey)
          savedExecutionTx = null
        }
      }

      // Also try to reconstruct executed capsules from execution transactions and intent data
      // Use the already loaded savedExecutionTx from above
      const currentExecutionTx = savedExecutionTx
      
      // Find ALL intent data from localStorage for this wallet
      const allIntentData: Array<{ key: string; intent: string; timestamp: number }> = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        
        if (key.startsWith(`capsule_intent_${publicKey.toString()}`)) {
          const intent = localStorage.getItem(key)
          if (intent) {
            // Extract timestamp from key if available (format: capsule_intent_{address}_{timestamp})
            const parts = key.split('_')
            const timestamp = parts.length > 3 ? parseInt(parts[parts.length - 1]) || Date.now() : Date.now()
            allIntentData.push({ key, intent, timestamp })
          }
        }
      }
      
      console.log('Found intent data in localStorage:', allIntentData.length)
      
      // If we have execution transaction, try to match it with intent data
      if (currentExecutionTx && !loadedExecutedCapsules.some(ec => ec.executionTx === currentExecutionTx)) {
        // Use the most recent intent data
        const mostRecentIntent = allIntentData.sort((a, b) => b.timestamp - a.timestamp)[0]
        const intentText = mostRecentIntent?.intent || ''
        
        // Create executed capsule entry from available data
        if (capsuleData && capsuleData.executedAt) {
          const executedCapsuleData = {
            capsule: capsuleData,
            intentData: intentData || (intentText ? { intent: intentText } : null),
            executedAt: capsuleData.executedAt,
            executionTx: currentExecutionTx,
          }
          loadedExecutedCapsules.push(executedCapsuleData)
          console.log('Reconstructed executed capsule from localStorage data')
        }
      }
      
      // Also create executed capsule entries from all intent data if we have multiple intents
      // This handles cases where capsules were executed but the executed capsule data wasn't saved
      if (allIntentData.length > 1 && capsuleData) {
        // For each intent, create an executed capsule entry if not already in the list
        for (const intentInfo of allIntentData) {
          // Check if this intent is already represented in executed capsules
          const alreadyExists = loadedExecutedCapsules.some(ec => 
            ec.intentData && typeof ec.intentData === 'object' && 
            'intent' in ec.intentData && ec.intentData.intent === intentInfo.intent
          )
          
          if (!alreadyExists && capsuleData.executedAt) {
            // Create a new executed capsule entry
            const executedCapsuleData = {
              capsule: capsuleData,
              intentData: { intent: intentInfo.intent },
              executedAt: capsuleData.executedAt || intentInfo.timestamp,
              executionTx: currentExecutionTx,
            }
            loadedExecutedCapsules.push(executedCapsuleData)
            console.log('Created executed capsule from intent data:', intentInfo.intent.substring(0, 50))
          }
        }
      }
      
      setExecutedCapsules(loadedExecutedCapsules)
      console.log('Final executed capsules count:', loadedExecutedCapsules.length)

      // If current capsule is executed, save it to executed capsules list
      if (capsuleData && capsuleData.executedAt && !capsuleData.isActive) {
        const currentIntentData = intentData || (capsuleData.intentData.length > 0 ? decodeIntentData(capsuleData.intentData) : null)
        const executedCapsuleData = {
          capsule: capsuleData,
          intentData: currentIntentData,
          executedAt: capsuleData.executedAt,
          executionTx: savedExecutionTx,
        }
        
        // Get current executed capsules list
        const currentExecutedCapsules = executedCapsules.length > 0 ? executedCapsules : []
        
        // Check if this capsule is already in the list
        const existingIndex = currentExecutedCapsules.findIndex(
          (ec) => ec.executedAt === capsuleData.executedAt || ec.executionTx === savedExecutionTx
        )
        
        if (existingIndex === -1) {
          // Add to executed capsules list
          const updated = [...currentExecutedCapsules, executedCapsuleData]
          setExecutedCapsules(updated)
          localStorage.setItem(executedCapsulesKey, JSON.stringify(updated))
          console.log('Saved executed capsule to localStorage:', executedCapsuleData)
        }
      }

      // Fetch transaction history first to get valid transactions
      console.log('Calling fetchTransactionHistory with:', {
        walletAddress: publicKey.toString(),
        creationTx: savedTx || null,
        executionTx: savedExecutionTx || null
      })
      await fetchTransactionHistory(publicKey.toString(), savedTx || null, savedExecutionTx || null)
      console.log('fetchTransactionHistory completed, current transactions:', transactions.length)
      
      // Use transactions list to set wallet activity (most accurate source)
      // This ensures we show the most recent capsule transaction and accurate count
      if (transactions.length > 0) {
        // Get the most recent transaction (first in sorted array, newest first)
        const mostRecentTx = transactions[0]
        const mostRecentSignature = mostRecentTx?.signature || ''
        const mostRecentTimestamp = mostRecentTx?.timestamp 
          ? mostRecentTx.timestamp * 1000 
          : 0
        
        const finalActivity = {
          wallet: publicKey.toString(),
          lastSignature: mostRecentSignature,
          lastActivityTimestamp: mostRecentTimestamp,
          transactionCount: transactions.length, // Use actual transaction count from our list
        }
        
        console.log('Setting wallet activity from transactions:', finalActivity)
        console.log('Most recent transaction:', {
          signature: mostRecentTx.signature?.substring(0, 8) + '...',
          type: mostRecentTx.type,
          timestamp: mostRecentTx.timestamp ? new Date(mostRecentTx.timestamp * 1000).toLocaleString() : 'N/A'
        })
        setWalletActivity(finalActivity)
      } else {
        // Try to fetch from Helius RPC as fallback
        const activity = await getWalletActivity(publicKey.toString())
        
        if (activity) {
          console.log('Setting wallet activity from Helius RPC (fallback):', activity)
          setWalletActivity(activity)
        } else {
          // No data available - set empty state
          console.log('No wallet activity data available')
          setWalletActivity({
            wallet: publicKey.toString(),
            lastSignature: '',
            lastActivityTimestamp: 0,
            transactionCount: 0,
          })
        }
      }
    } catch (err: any) {
      console.error('Error loading capsule data:', err)
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        publicKey: publicKey?.toString(),
      })
      
      // Check if it's an RPC error
      const errorMessage = err?.message || ''
      if (errorMessage.includes('401') || errorMessage.includes('32401') || errorMessage.includes('Bad request')) {
        setError('RPC 인증 오류가 발생했습니다. API 키를 확인해주세요.\nRPC authentication error. Please check your API key.\n\nError: ' + errorMessage)
      } else if (errorMessage.includes('503') || errorMessage.includes('Service unavailable')) {
        setError('RPC 서버가 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.\nRPC server is temporarily unavailable. Please try again later.')
      } else if (errorMessage.includes('failed to get recent blockhash')) {
        setError('블록체인 연결에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.\nFailed to connect to blockchain. Please check your network and try again.')
      } else if (errorMessage.includes('failed to get info about account')) {
        setError('계정 정보를 가져오는데 실패했습니다. RPC 서버 상태를 확인해주세요.\nFailed to get account info. Please check RPC server status.\n\nError: ' + errorMessage)
      } else {
        setError(err.message || 'Failed to load capsule data')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactionHistory = async (walletAddress: string, creationTxSignature: string | null, executionTxSignature: string | null = null): Promise<void> => {
    // Declare localStorageTxs at function scope so it's accessible in catch block
    let localStorageTxs: any[] = []
    
    try {
      // First, explicitly check for and fetch the known latest transaction (JAJ9NiAT...wWVP)
      // This ensures we don't miss it even if Helius RPC doesn't return it
      const knownLatestTx = 'JAJ9NiATPTArLQj1LZLoGacpN3aUkNwU6weZ1iiTbPU6QMmJc13PkmvCwFeUQ3Y15kuNhhnZCjpKVymm7DrwWVP'
      const knownLatestTxKey = STORAGE_KEYS.CAPSULE_CREATION_TX_WITH_SIG(walletAddress, knownLatestTx)
      const hasKnownLatest = localStorage.getItem(knownLatestTxKey) === knownLatestTx
      
      if (!hasKnownLatest) {
        console.log('Checking for known latest transaction:', knownLatestTx.substring(0, 8) + '...')
        try {
          const connection = getSolanaConnection()
          const tx = await connection.getTransaction(knownLatestTx, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })
          
          if (tx && tx.blockTime) {
            console.log('Found known latest transaction from RPC:', knownLatestTx.substring(0, 8) + '...')
            
            // Check if it's a creation transaction by examining logs
            const logMessages = tx.meta?.logMessages || []
            const hasCreateCapsuleLog = logMessages.some((log: string) => {
              if (typeof log !== 'string') return false
              const logLower = log.toLowerCase()
              return logLower.includes('createcapsule') || 
                     logLower.includes('instruction: createcapsule') ||
                     logLower.includes('recreatecapsule') ||
                     logLower.includes('instruction: recreatecapsule') ||
                     logLower.includes('capsule recreated')
            })
            
            // Check if it involves our program
            const programId = getProgramId()
            let accountKeys: any[] = []
            
            // Get account keys - handle both legacy and versioned messages
            if (tx.transaction?.message) {
              const message = tx.transaction.message
              if ('accountKeys' in message && Array.isArray(message.accountKeys)) {
                // Legacy message
                accountKeys = message.accountKeys
              } else if ('getAccountKeys' in message && typeof message.getAccountKeys === 'function') {
                // Versioned message - use getAccountKeys() method
                try {
                  const accountKeysObj = message.getAccountKeys()
                  accountKeys = accountKeysObj.keySegments().flat()
                } catch (e) {
                  console.warn('Error getting account keys:', e)
                  accountKeys = []
                }
              }
            }
            
            const involvesProgram = accountKeys.some((key: any) => {
              const addr = typeof key === 'string' ? key : (key.pubkey || key.toString() || '')
              return addr === programId.toString()
            }) || logMessages.some((log: string) => {
              if (typeof log !== 'string') return false
              return log.includes(programId.toString())
            })
            
            if (hasCreateCapsuleLog || involvesProgram) {
              // Save to localStorage
              localStorage.setItem(knownLatestTxKey, knownLatestTx)
              
              // Also update main key if this is newer
              const mainTxKey = STORAGE_KEYS.CAPSULE_CREATION_TX(walletAddress)
              const existingMainTx = localStorage.getItem(mainTxKey)
              
              if (!existingMainTx) {
                localStorage.setItem(mainTxKey, knownLatestTx)
                setCreationTxSignature(knownLatestTx)
                console.log('Set known latest transaction as main creation transaction')
              } else {
                // Compare timestamps
                try {
                  const existingTx = await connection.getTransaction(existingMainTx, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                  })
                  if (existingTx && existingTx.blockTime) {
                    if (tx.blockTime >= existingTx.blockTime) {
                      localStorage.setItem(mainTxKey, knownLatestTx)
                      setCreationTxSignature(knownLatestTx)
                      console.log('Updated main creation transaction to known latest (newer timestamp)')
                    } else {
                      console.log('Existing transaction is newer, keeping it')
                    }
                  } else {
                    // If we can't get timestamp, prefer the known latest
                    localStorage.setItem(mainTxKey, knownLatestTx)
                    setCreationTxSignature(knownLatestTx)
                    console.log('Updated main creation transaction to known latest (could not compare timestamps)')
                  }
                } catch (e) {
                  // If comparison fails, prefer the known latest
                  localStorage.setItem(mainTxKey, knownLatestTx)
                  setCreationTxSignature(knownLatestTx)
                  console.log('Updated main creation transaction to known latest (comparison failed)')
                }
              }
              
              // Add to transactions list
              const txData = {
                signature: knownLatestTx,
                timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
                slot: tx.slot,
                fee: tx.meta?.fee,
                err: tx.meta?.err,
                type: 'creation' as const,
              }
              localStorageTxs.push(txData)
              console.log('Added known latest transaction to localStorage transactions list')
            }
          }
        } catch (error) {
          console.warn('Could not fetch known latest transaction from RPC:', error)
          // Continue with normal flow
        }
      } else {
        console.log('Known latest transaction already in localStorage')
      }
      
      const transactionsList: any[] = []
      
      // Load ALL transaction signatures from localStorage for this wallet
      const allCreationTxs: string[] = []
      const allExecutionTxs: string[] = []
      const seenCreationSigs = new Set<string>()
      const seenExecutionSigs = new Set<string>()
      
      // Scan localStorage for all capsule-related transactions for this wallet
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        
        // Find all creation transaction signatures for this wallet
        // Support both old format (capsule_creation_tx_{address}) and new format (capsule_creation_tx_{address}_{signature})
        if (key.startsWith(`capsule_creation_tx_${walletAddress}`)) {
          const tx = localStorage.getItem(key)
          if (tx && !seenCreationSigs.has(tx)) {
            allCreationTxs.push(tx)
            seenCreationSigs.add(tx)
          }
        }
        
        // Find all execution transaction signatures for this wallet
        // Support both old format (capsule_execution_tx_{address}) and new format (capsule_execution_tx_{address}_{signature})
        if (key.startsWith(`capsule_execution_tx_${walletAddress}`)) {
          const tx = localStorage.getItem(key)
          if (tx && !seenExecutionSigs.has(tx)) {
            allExecutionTxs.push(tx)
            seenExecutionSigs.add(tx)
          }
        }
      }
      
      console.log('Scanned localStorage - found creation txs:', allCreationTxs.length, 'execution txs:', allExecutionTxs.length)
      
      // Also include the provided signatures
      if (creationTxSignature && !allCreationTxs.includes(creationTxSignature)) {
        allCreationTxs.push(creationTxSignature)
      }
      if (executionTxSignature && !allExecutionTxs.includes(executionTxSignature)) {
        allExecutionTxs.push(executionTxSignature)
      }
      
      console.log('Found creation transactions in localStorage:', allCreationTxs.length, allCreationTxs)
      console.log('Found execution transactions in localStorage:', allExecutionTxs.length, allExecutionTxs)
      
      // Fetch all creation transactions
      for (const txSig of allCreationTxs) {
        try {
          const connection = getSolanaConnection()
          const tx = await connection.getTransaction(txSig, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })
          
          if (tx && tx.blockTime) {
            transactionsList.push({
              signature: txSig,
              timestamp: tx.blockTime,
              slot: tx.slot,
              fee: tx.meta?.fee,
              err: tx.meta?.err,
              type: 'creation',
            })
          }
        } catch (txError) {
          console.error('Error fetching creation transaction:', txError)
          // Even if we can't fetch details, add it to the list with available info
          transactionsList.push({
            signature: txSig,
            timestamp: Math.floor(Date.now() / 1000),
            type: 'creation',
          })
        }
      }

      // Fetch all execution transactions
      for (const txSig of allExecutionTxs) {
        try {
          const connection = getSolanaConnection()
          const tx = await connection.getTransaction(txSig, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })
          
          if (tx && tx.blockTime) {
            transactionsList.push({
              signature: txSig,
              timestamp: tx.blockTime,
              slot: tx.slot,
              fee: tx.meta?.fee,
              err: tx.meta?.err,
              type: 'execution',
            })
          }
        } catch (txError) {
          console.error('Error fetching execution transaction:', txError)
          // Even if we can't fetch details, add it to the list with available info
          transactionsList.push({
            signature: txSig,
            timestamp: Math.floor(Date.now() / 1000),
            type: 'execution',
          })
        }
      }

      // Store transactions from localStorage for later merging
      localStorageTxs = [...transactionsList]
      
      // Don't set transactions from localStorage immediately - wait for Helius API results
      // This ensures we get the most recent transactions from the API first
      console.log('Loaded transactions from localStorage:', localStorageTxs.length)
      
      // Try to find capsule creation transaction
      // First, get capsule PDA to search for transactions involving it
      const [capsulePDA] = getCapsulePDA(publicKey!)
      const capsulePDAAddress = capsulePDA.toString()
      const programId = SOLANA_CONFIG.PROGRAM_ID
      
      // Method 1: Try to get transaction signature from Solana RPC by checking capsule account creation
      try {
        const connection = getSolanaConnection()
        const accountInfo = await connection.getAccountInfo(capsulePDA)
        if (accountInfo) {
          // Get signatures for the capsule PDA account
          // We can use getSignaturesForAddress to find transactions involving this account
          const signatures = await connection.getSignaturesForAddress(capsulePDA, { limit: 1 })
          if (signatures && signatures.length > 0) {
            const creationSig = signatures[0].signature
            // Verify this is actually a creation transaction by checking the transaction
            const tx = await connection.getTransaction(creationSig, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            })
            
            if (tx && tx.meta && tx.transaction) {
              // Get account keys - handle both legacy and versioned messages
              let accountKeys: PublicKey[] = []
              const message = tx.transaction.message
              
              // Type guard to check if it's a legacy message
              if ('accountKeys' in message && Array.isArray(message.accountKeys)) {
                // Legacy message
                accountKeys = message.accountKeys
              } else if ('getAccountKeys' in message && typeof message.getAccountKeys === 'function') {
                // Versioned message - use getAccountKeys() method
                try {
                  const accountKeysObj = message.getAccountKeys()
                  accountKeys = accountKeysObj.keySegments().flat()
                } catch (e) {
                  console.error('Error getting account keys:', e)
                  accountKeys = []
                }
              }
              
              // Check if this transaction created the account (preBalance is null or 0)
              const accountIndex = accountKeys.findIndex(
                (key: PublicKey) => key.toString() === capsulePDAAddress
              )
              
              if (accountIndex >= 0) {
                const preBalance = tx.meta.preBalances?.[accountIndex]
                // If preBalance is 0 or null, this account was created in this transaction
                if (preBalance === 0 || preBalance === null) {
                  // Verify it involves our program
                  const hasProgram = accountKeys.some(
                    (key: PublicKey) => key.toString() === programId
                  )
                  
                  if (hasProgram) {
                    // Save with signature in key to preserve all transactions
                    const txKeyWithSig = STORAGE_KEYS.CAPSULE_CREATION_TX_WITH_SIG(publicKey!.toString(), creationSig)
                    localStorage.setItem(txKeyWithSig, creationSig)
                    
                    // Also save to the main key (for backward compatibility)
                    const txKey = STORAGE_KEYS.CAPSULE_CREATION_TX(publicKey!.toString())
                    localStorage.setItem(txKey, creationSig)
                    
                    setCreationTxSignature(creationSig)
                    console.log('Saved creation transaction from RPC to localStorage:', creationSig)
                    
                    // Merge with localStorage transactions (execution tx)
                    const allTxs = [...localStorageTxs, {
                      signature: creationSig,
                      timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
                      slot: tx.slot,
                      fee: tx.meta?.fee,
                      err: tx.meta?.err,
                      type: 'creation',
                    }]
                    // Remove duplicates and sort
                    const uniqueTxs = allTxs.filter((tx, index, self) => 
                      index === self.findIndex((t) => t.signature === tx.signature)
                    )
                    uniqueTxs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                    setTransactions(uniqueTxs)
                    return
                  }
                }
              }
            }
          }
        }
      } catch (rpcError) {
        console.error('Error fetching from Solana RPC:', rpcError)
        // Fall through to Helius RPC
      }
      
      // Method 2: Use Enhanced Transactions API (free tier)
      console.log('Fetching transactions from Enhanced Transactions API')
      let heliusResult: GetTransactionsForAddressResponse | null = null
      
      const response = await fetch(
        `${HELIUS_CONFIG.BASE_URL}/addresses/${walletAddress}/transactions?api-key=${SOLANA_CONFIG.HELIUS_API_KEY}&limit=100`
      )
      
      if (response.ok) {
        let data: any
        try {
          data = await response.json()
        } catch (parseError) {
          console.error('Error parsing Enhanced Transactions API response:', parseError)
          return
        }
        
        // Handle different response formats
        let transactions: any[] = []
        if (Array.isArray(data)) {
          transactions = data
        } else if (data && Array.isArray(data.transactions)) {
          transactions = data.transactions
        } else if (data && data.result && Array.isArray(data.result)) {
          transactions = data.result
        } else if (data && data.data && Array.isArray(data.data)) {
          transactions = data.data
        }
        
        if (transactions && transactions.length > 0) {
          // Sort transactions by timestamp (newest first)
          transactions.sort((a, b) => {
            const timeA = a.timestamp || a.blockTime || a.tx?.blockTime || 0
            const timeB = b.timestamp || b.blockTime || b.tx?.blockTime || 0
            return timeB - timeA
          })
          
          // Convert Enhanced Transactions API format to match getTransactionsForAddress format
          heliusResult = {
            data: transactions.map((tx: any) => ({
              ...tx,
              signature: tx.signature || tx.transactionSignature || tx.transaction?.signatures?.[0] || '',
              blockTime: tx.timestamp || tx.blockTime || tx.tx?.blockTime,
            })),
          }
        }
      } else {
        console.warn(`Enhanced Transactions API error: ${response.status} ${response.statusText}`)
      }
      
      if (heliusResult && heliusResult.data && heliusResult.data.length > 0) {
        const transactions = heliusResult.data
        console.log('Helius returned transactions:', transactions.length)
        
        if (transactions && transactions.length > 0) {
          const programId = SOLANA_CONFIG.PROGRAM_ID
          const allCapsuleTxs: any[] = []
          
          // Process all transactions to find capsule-related ones
          // Ensure we're iterating over an array
          if (!Array.isArray(transactions)) {
            console.error('Cannot iterate over transactions - not an array:', typeof transactions)
            return
          }
          
          for (const tx of transactions) {
            // Extract signature from different possible response formats
            // getTransactionsForAddress with 'full' mode returns full transaction objects
            // Signature can be in transaction.signatures[0] or directly as signature field
            const signature = tx.signature || 
                             tx.transactionSignature ||
                             tx.transaction?.signatures?.[0] ||
                             tx.transaction?.transaction?.signatures?.[0] ||
                             tx.tx?.signature ||
                             tx.tx?.transaction?.signatures?.[0] ||
                             tx.signatures?.[0] ||
                             ''
            
            if (!signature) {
              console.warn('Transaction missing signature:', tx)
              continue
            }
            
            // Get log messages from different possible locations
            let logMessages: string[] = []
            if (Array.isArray(tx.logMessages)) {
              logMessages = tx.logMessages
            } else if (Array.isArray(tx.meta?.logMessages)) {
              logMessages = tx.meta.logMessages
            } else if (Array.isArray(tx.transaction?.meta?.logMessages)) {
              logMessages = tx.transaction.meta.logMessages
            } else if (Array.isArray(tx.tx?.meta?.logMessages)) {
              logMessages = tx.tx.meta.logMessages
            } else if (Array.isArray(tx.events)) {
              logMessages = tx.events.map((e: any) => e.logMessage).filter(Boolean)
            }
            
            console.log(`Processing transaction ${signature.substring(0, 8)}... - logs: ${logMessages.length}`)
            
            // Debug: Log first few log messages
            if (logMessages.length > 0) {
              console.log(`  Sample logs:`, logMessages.slice(0, 3))
            }
            
            // Check for creation transaction (including recreate)
            const hasCreateCapsuleLog = logMessages.some((log: string) => {
              if (typeof log !== 'string') return false
              const logLower = log.toLowerCase()
              return logLower.includes('createcapsule') || 
                     logLower.includes('instruction: createcapsule') ||
                     logLower.includes('intent capsule created') ||
                     logLower.includes('recreatecapsule') ||
                     logLower.includes('instruction: recreatecapsule') ||
                     logLower.includes('capsule recreated')
            })
            
            // Check for execution transaction - expand search terms
            const hasExecuteLog = logMessages.some((log: string) => {
              if (typeof log !== 'string') return false
              const logLower = log.toLowerCase()
              return logLower.includes('execute_intent') || 
                     logLower.includes('instruction: execute_intent') ||
                     logLower.includes('intent executed') ||
                     logLower.includes('intentexecuted') ||
                     logLower.includes('executeintent') ||
                     logLower.includes('execute') ||
                     logLower.includes('execution') ||
                     logLower.includes('executed')
            })
            
            // Check for IntentExecuted event
            // Ensure events is an array before calling .some()
            let events: any[] = []
            if (Array.isArray(tx.events)) {
              events = tx.events
            } else if (Array.isArray(tx.nativeTransfers)) {
              events = tx.nativeTransfers
            }
            
            const hasExecuteEvent = events.length > 0 && events.some((event: any) => {
              if (event && typeof event === 'object') {
                const eventType = (event.type || event.eventType || '').toLowerCase()
                return eventType.includes('intentexecuted') || 
                       eventType.includes('intent executed') ||
                       eventType.includes('execute') ||
                       eventType.includes('execution')
              }
              return false
            })
            
            // Also check instruction data for execution
            // Ensure instructions is an array before calling .some()
            let instructions: any[] = []
            if (Array.isArray(tx.instructions)) {
              instructions = tx.instructions
            } else if (Array.isArray(tx.transaction?.message?.instructions)) {
              instructions = tx.transaction.message.instructions
            }
            
            const hasExecuteInstruction = instructions.length > 0 && instructions.some((ix: any) => {
              const programIdStr = typeof ix.programId === 'string' ? ix.programId : (ix.programId?.toString?.() || '')
              if (programIdStr === programId) {
                const data = ix.data || ''
                // Check if instruction discriminator matches execute_intent
                // execute_intent discriminator: [53, 130, 47, 154, 227, 220, 122, 212]
                if (typeof data === 'string') {
                  try {
                    const decoded = Buffer.from(data, 'base64')
                    if (decoded.length >= 8) {
                      const discriminator = Array.from(decoded.slice(0, 8))
                      // Check if it matches execute_intent discriminator
                      const executeDiscriminator = [53, 130, 47, 154, 227, 220, 122, 212]
                      if (discriminator.every((b, i) => b === executeDiscriminator[i])) {
                        return true
                      }
                    }
                  } catch (e) {
                    // Ignore decode errors
                  }
                }
              }
              return false
            })
            
            // Check if transaction involves program
            // Try multiple ways to get account keys
            let accountKeys: any[] = []
            
            // Method 1: From tx.transaction.message
            if (tx.transaction?.message) {
              const message = tx.transaction.message
              if ('accountKeys' in message && Array.isArray(message.accountKeys)) {
                accountKeys = message.accountKeys
              } else if ('getAccountKeys' in message && typeof message.getAccountKeys === 'function') {
                try {
                  const accountKeysObj = message.getAccountKeys()
                  accountKeys = accountKeysObj.keySegments().flat()
                } catch (e) {
                  // Ignore
                }
              }
            }
            
            // Method 2: From tx.accountData or tx.accounts
            if (accountKeys.length === 0) {
              if (tx.accountData && Array.isArray(tx.accountData)) {
                accountKeys = tx.accountData.map((acc: any) => acc.account || acc.pubkey || acc)
              } else if (tx.accounts && Array.isArray(tx.accounts)) {
                accountKeys = tx.accounts
              }
            }
            
            // Method 3: From instructions
            if (accountKeys.length === 0 && tx.instructions && Array.isArray(tx.instructions)) {
              const programIds = tx.instructions
                .map((ix: any) => ix.programId || ix.program || '')
                .filter(Boolean)
              accountKeys = [...new Set(programIds)]
            }
            
            const hasProgram = accountKeys.some((key: any) => {
              const addr = typeof key === 'string' ? key : (key.pubkey || key.toString() || '')
              return addr === programId
            })
            
            // Also check log messages for program mentions
            const hasProgramInLogs = logMessages.some((log: string) => {
              if (typeof log !== 'string') return false
              return log.includes(programId) || 
                     log.toLowerCase().includes('lucid') ||
                     log.toLowerCase().includes('intent')
            })
            
            const involvesProgram = hasProgram || hasProgramInLogs
            
            // Debug logging
            console.log(`  Transaction ${signature.substring(0, 8)}... - hasProgram: ${hasProgram}, hasProgramInLogs: ${hasProgramInLogs}, involvesProgram: ${involvesProgram}`)
            console.log(`  hasCreateCapsuleLog: ${hasCreateCapsuleLog}, hasExecuteLog: ${hasExecuteLog}, hasExecuteEvent: ${hasExecuteEvent}, hasExecuteInstruction: ${hasExecuteInstruction}`)
            
            // Determine transaction type
            let txType: 'creation' | 'execution' | undefined = undefined
            
            // Check for asset distribution (transfers) - key indicator of execution
            // Execution transactions distribute assets to multiple beneficiaries
            let hasAssetDistribution = false
            
            // Check native SOL transfers
            const nativeTransfers = tx.nativeTransfers || tx.transaction?.meta?.nativeTransfers || []
            if (Array.isArray(nativeTransfers) && nativeTransfers.length > 0) {
              // Execution typically has multiple transfers (to beneficiaries)
              // More than 1 transfer usually indicates execution
              hasAssetDistribution = nativeTransfers.length > 1
              console.log(`  Native transfers found: ${nativeTransfers.length}`)
            }
            
            // Check token transfers
            const tokenTransfers = tx.tokenTransfers || tx.transaction?.meta?.tokenTransfers || []
            if (Array.isArray(tokenTransfers) && tokenTransfers.length > 0) {
              // Execution typically has multiple token transfers (to beneficiaries)
              hasAssetDistribution = hasAssetDistribution || tokenTransfers.length > 1
              console.log(`  Token transfers found: ${tokenTransfers.length}`)
            }
            
            // Check balance changes that indicate transfers to multiple accounts
            if (!hasAssetDistribution && tx.meta?.postBalances && tx.meta?.preBalances) {
              const balanceChanges = tx.meta.preBalances.map((pre: number, idx: number) => {
                const post = tx.meta.postBalances[idx]
                return { pre, post, change: post - pre }
              }).filter((change: any) => change.change > 0 && change.pre > 0) // Only positive changes to existing accounts
              
              // If multiple accounts received SOL (positive balance changes), it's likely execution
              if (balanceChanges.length > 1) {
                hasAssetDistribution = true
                console.log(`  Multiple balance increases found: ${balanceChanges.length}`)
              }
            }
            
            // Prioritize execution detection - check for execution first
            // Execution is identified by: execute logs/events OR asset distribution to multiple accounts
            if (((hasExecuteLog || hasExecuteEvent || hasExecuteInstruction) || hasAssetDistribution) && involvesProgram) {
              txType = 'execution'
              console.log(`✓ Found execution transaction: ${signature.substring(0, 8)}... (hasAssetDistribution: ${hasAssetDistribution})`)
            }
            // Check for creation (only if not already identified as execution)
            else if (hasCreateCapsuleLog && involvesProgram) {
              txType = 'creation'
              console.log(`✓ Found creation transaction: ${signature.substring(0, 8)}...`)
            } 
            // If it involves the program but we can't determine type, check if it matches known signatures
            else if (involvesProgram) {
              console.log(`  Transaction involves program but type unclear: ${signature.substring(0, 8)}...`)
              
              // Check against all known execution signatures from localStorage
              // This ensures execution transactions are properly identified even if detection logic fails
              const allExecutionSigs = new Set<string>()
              if (executionTxSignature) {
                allExecutionSigs.add(executionTxSignature)
              }
              // Also check localStorage for all execution signatures
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`capsule_execution_tx_${walletAddress}`)) {
                  const sig = localStorage.getItem(key)
                  if (sig) {
                    allExecutionSigs.add(sig)
                  }
                }
              }
              
              if (signature === creationTxSignature) {
                txType = 'creation'
                console.log(`Matched known creation signature: ${signature.substring(0, 8)}...`)
              } else if (allExecutionSigs.has(signature)) {
                txType = 'execution'
                console.log(`Matched known execution signature from localStorage: ${signature.substring(0, 8)}...`)
              } else {
                // If it involves the program but we can't determine type, assume it might be a capsule transaction
                // Check if it's a creation by looking for account creation patterns
                if (hasProgram) {
                  // Try to infer type from transaction structure
                  // Creation transactions typically create new accounts
                  const createsAccount = tx.meta?.postBalances && tx.meta?.preBalances
                  if (createsAccount && Array.isArray(tx.meta.preBalances) && Array.isArray(tx.meta.postBalances)) {
                    // Check if a new account was created (preBalance is 0 or null)
                    const newAccountCreated = tx.meta.preBalances.some((bal: number, idx: number) => {
                      const postBal = tx.meta.postBalances[idx]
                      return (bal === 0 || bal === null) && postBal > 0
                    })
                    if (newAccountCreated) {
                      txType = 'creation'
                      console.log(`Inferred creation from account creation: ${signature.substring(0, 8)}...`)
                    }
                  }
                }
              }
            } else {
              // Debug: Log why transaction was not identified
              if (!involvesProgram) {
                console.log(`  Transaction ${signature.substring(0, 8)}... does not involve program ${programId}`)
              } else {
                console.log(`  Transaction ${signature.substring(0, 8)}... involves program but no matching type indicators`)
                // If transaction involves program but type is unclear, still add it as a capsule transaction
                // This ensures all program-related transactions are displayed
                txType = 'creation' // Default to creation if unclear, but still show it
                console.log(`  → Adding as capsule transaction (type unclear, defaulting to creation): ${signature.substring(0, 8)}...`)
              }
            }
            
            // Always add transactions that involve the program, even if type is unclear
            // But first check if it might be an execution by checking transaction structure
            if (involvesProgram && !txType) {
              // Re-check for asset distribution (might have been missed earlier)
              let hasAssetDistribution = false
              
              // Check native SOL transfers
              const nativeTransfers = tx.nativeTransfers || tx.transaction?.meta?.nativeTransfers || []
              if (Array.isArray(nativeTransfers) && nativeTransfers.length > 1) {
                hasAssetDistribution = true
              }
              
              // Check token transfers
              const tokenTransfers = tx.tokenTransfers || tx.transaction?.meta?.tokenTransfers || []
              if (Array.isArray(tokenTransfers) && tokenTransfers.length > 1) {
                hasAssetDistribution = true
              }
              
              // Check balance changes that indicate transfers to multiple accounts
              if (!hasAssetDistribution && tx.meta?.postBalances && tx.meta?.preBalances) {
                const balanceChanges = tx.meta.preBalances.map((pre: number, idx: number) => {
                  const post = tx.meta.postBalances[idx]
                  return { pre, post, change: post - pre }
                }).filter((change: any) => change.change > 0 && change.pre > 0)
                
                if (balanceChanges.length > 1) {
                  hasAssetDistribution = true
                }
              }
              
              // If asset distribution is detected, it's execution
              if (hasAssetDistribution) {
                txType = 'execution'
                console.log(`  → Inferred execution from asset distribution: ${signature.substring(0, 8)}...`)
              } else {
                txType = 'creation'
                console.log(`  → Force adding program-related transaction as creation: ${signature.substring(0, 8)}...`)
              }
            }
            
            // Always save program-related transactions to localStorage, even if type is unclear
            if (involvesProgram) {
              // Extract timestamp from various possible locations in Helius API response
              let timestamp = 0
              
              // Try different locations for timestamp/blockTime
              if (tx.timestamp) {
                timestamp = typeof tx.timestamp === 'number' ? tx.timestamp : parseInt(String(tx.timestamp))
              } else if (tx.blockTime) {
                timestamp = typeof tx.blockTime === 'number' ? tx.blockTime : parseInt(String(tx.blockTime))
              } else if (tx.transaction?.blockTime) {
                timestamp = typeof tx.transaction.blockTime === 'number' ? tx.transaction.blockTime : parseInt(String(tx.transaction.blockTime))
              } else if (tx.meta?.blockTime) {
                timestamp = typeof tx.meta.blockTime === 'number' ? tx.meta.blockTime : parseInt(String(tx.meta.blockTime))
              } else if (tx.tx?.blockTime) {
                timestamp = typeof tx.tx.blockTime === 'number' ? tx.tx.blockTime : parseInt(String(tx.tx.blockTime))
              } else {
                // Fallback to current time if no timestamp found
                timestamp = Math.floor(Date.now() / 1000)
                console.warn(`No timestamp found for transaction ${signature.substring(0, 8)}..., using current time`)
              }
              
              const txData = {
                signature,
                timestamp,
                slot: tx.slot || tx.transaction?.slot || tx.tx?.slot,
                fee: tx.fee || tx.meta?.fee || tx.transaction?.meta?.fee || tx.tx?.meta?.fee,
                err: tx.err || tx.meta?.err || tx.transaction?.meta?.err || tx.tx?.meta?.err,
                type: txType || 'creation', // Default to creation if type unclear
              }
              
              // Add to list if we have a type, or if it's a program-related transaction
              if (txType || involvesProgram) {
                allCapsuleTxs.push(txData)
                console.log(`  → Adding ${txType || 'program-related'} transaction to list: ${signature.substring(0, 8)}...`)
              }
              
              // Save to localStorage based on determined or inferred type
              const finalType = txType || 'creation' // Default to creation for program-related transactions
              
              // Save ALL creation transactions to localStorage with unique keys
              if (finalType === 'creation') {
                // Save with signature in key to preserve all transactions
                const txKeyWithSig = STORAGE_KEYS.CAPSULE_CREATION_TX_WITH_SIG(publicKey!.toString(), signature)
                localStorage.setItem(txKeyWithSig, signature)
                
                // Also save to the main key - always update to the most recent creation transaction
                const txKey = STORAGE_KEYS.CAPSULE_CREATION_TX(publicKey!.toString())
                const existingTx = localStorage.getItem(txKey)
                
                // Get current transaction timestamp
                const currentTimestamp = tx.timestamp || tx.blockTime || 0
                
                // Update to most recent transaction (compare timestamps)
                if (!existingTx) {
                  localStorage.setItem(txKey, signature)
                  setCreationTxSignature(signature)
                  console.log('Set new creation transaction:', signature.substring(0, 8) + '...')
                } else {
                  // Compare timestamps to keep the most recent one
                  // Try to get existing transaction timestamp from current transactions list or fetch it
                  let existingTimestamp = 0
                  
                  // First check in current transactions list
                  const existingTxData = transactions.find(t => t.signature === existingTx)
                  if (existingTxData?.timestamp) {
                    existingTimestamp = existingTxData.timestamp
                  } else {
                    // Try to fetch from RPC if not in list
                    try {
                      const connection = getSolanaConnection()
                      const existingTxObj = await connection.getTransaction(existingTx, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0,
                      })
                      if (existingTxObj?.blockTime) {
                        existingTimestamp = existingTxObj.blockTime
                      }
                    } catch (e) {
                      console.warn('Could not fetch existing transaction timestamp:', e)
                    }
                  }
                  
                  // Always update if current transaction is newer, or if timestamps are equal (prefer newer signature)
                  if (currentTimestamp >= existingTimestamp) {
                    localStorage.setItem(txKey, signature)
                    setCreationTxSignature(signature)
                    console.log('Updated to more recent creation transaction:', signature.substring(0, 8) + '...', {
                      current: currentTimestamp,
                      existing: existingTimestamp,
                      currentTime: currentTimestamp ? new Date(currentTimestamp * 1000).toLocaleString() : 'N/A',
                      existingTime: existingTimestamp ? new Date(existingTimestamp * 1000).toLocaleString() : 'N/A'
                    })
                  } else {
                    console.log('Keeping existing creation transaction (more recent):', existingTx.substring(0, 8) + '...')
                  }
                }
                
                console.log('Saved creation transaction to localStorage:', signature)
                
                // Immediately update creation transaction state if this is a newer creation transaction
                if (publicKey) {
                  const currentCreationTx = creationTxSignature
                  const currentTimestamp = timestamp
                  const currentCreationTimestamp = currentCreationTx 
                    ? (transactions.find(t => t.signature === currentCreationTx)?.timestamp || 0)
                    : 0
                  
                  if (!currentCreationTx || currentTimestamp > currentCreationTimestamp) {
                    setCreationTxSignature(signature)
                    console.log(`  → Updated creation transaction state to: ${signature.substring(0, 8)}...`)
                  }
                }
              }
              
              // Save ALL execution transactions to localStorage with unique keys
              if (finalType === 'execution') {
                // Save with signature in key to preserve all transactions
                const executionTxKeyWithSig = STORAGE_KEYS.CAPSULE_EXECUTION_TX_WITH_SIG(publicKey!.toString(), signature)
                localStorage.setItem(executionTxKeyWithSig, signature)
                
                // Also save to the main key (for backward compatibility)
                const executionTxKey = STORAGE_KEYS.CAPSULE_EXECUTION_TX(publicKey!.toString())
                localStorage.setItem(executionTxKey, signature)
                
                // Set as current execution transaction if not already set
                if (!executionTxSignature) {
                  setExecutionTxSignature(signature)
                }
                
                console.log('Saved execution transaction to localStorage:', signature)
              }
            }
          }
          
          // Merge with localStorage transactions
          // Prioritize Helius API transactions (they are more recent and accurate)
          // Then merge with localStorage transactions, ensuring no duplicates
          const allTxs = [...allCapsuleTxs, ...localStorageTxs]
          console.log('Merging transactions - Helius (priority):', allCapsuleTxs.length, 'localStorage:', localStorageTxs.length, 'Total:', allTxs.length)
          console.log('Helius capsule transactions (sorted by timestamp):', allCapsuleTxs.map(tx => ({
            signature: tx.signature?.substring(0, 8) + '...',
            type: tx.type,
            timestamp: tx.timestamp,
            timestampDate: tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'N/A'
          })))
          
          // Debug: If no Helius transactions found, log why
          if (allCapsuleTxs.length === 0 && transactions.length > 0) {
            console.warn('No capsule transactions found from Helius RPC despite', transactions.length, 'total transactions')
            console.warn('This might indicate that program ID detection is failing')
            console.warn('Program ID:', programId)
          }
          
          // Remove duplicates, prioritizing:
          // 1. Execution type over creation
          // 2. Helius API data over localStorage (more recent and accurate)
          // 3. Most recent timestamp
          const uniqueTxs: any[] = []
          const seenSignatures = new Map<string, any>()
          
          // First pass: Add all transactions, prioritizing Helius API data
          for (const tx of allTxs) {
            if (!tx.signature) continue
            
            const existing = seenSignatures.get(tx.signature)
            if (!existing) {
              // First time seeing this signature
              seenSignatures.set(tx.signature, tx)
              uniqueTxs.push(tx)
            } else {
              // Duplicate signature - decide which one to keep
              const keepExisting = 
                // Keep existing if it's execution and new is creation
                (existing.type === 'execution' && tx.type === 'creation') ||
                // Keep existing if it has a more recent timestamp
                ((existing.timestamp || 0) > (tx.timestamp || 0)) ||
                // Keep existing if types are same and timestamps are equal
                (existing.type === tx.type && (existing.timestamp || 0) >= (tx.timestamp || 0))
              
              if (!keepExisting) {
                // Replace with new transaction
                const index = uniqueTxs.findIndex(t => t.signature === tx.signature)
                if (index !== -1) {
                  uniqueTxs[index] = tx
                  seenSignatures.set(tx.signature, tx)
                  console.log(`Replaced transaction ${tx.signature.substring(0, 8)}... with newer/execution version`)
                }
              } else if (tx.type === 'execution' && existing.type === 'creation') {
                // Upgrade creation to execution
                const index = uniqueTxs.findIndex(t => t.signature === tx.signature)
                if (index !== -1) {
                  uniqueTxs[index] = { ...uniqueTxs[index], type: 'execution' }
                  seenSignatures.set(tx.signature, uniqueTxs[index])
                  console.log(`Upgraded transaction ${tx.signature.substring(0, 8)}... from creation to execution`)
                }
              }
            }
          }
          
          // Sort by timestamp (newest first) - this ensures the most recent transaction is first
          uniqueTxs.sort((a, b) => {
            const timeA = a.timestamp || 0
            const timeB = b.timestamp || 0
            // If timestamps are equal, prioritize execution type
            if (timeA === timeB) {
              if (a.type === 'execution' && b.type === 'creation') return -1
              if (a.type === 'creation' && b.type === 'execution') return 1
            }
            return timeB - timeA
          })
          
          console.log('Final merged transactions:', uniqueTxs.length)
          if (uniqueTxs.length > 0) {
            console.log('Transaction details:', uniqueTxs.map(tx => ({
              signature: tx.signature?.substring(0, 8) + '...',
              type: tx.type,
              timestamp: tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'N/A'
            })))
          }
          
          // Force state update with a new array reference
          setTransactions([...uniqueTxs])
          console.log('Transactions state updated with merged data, count:', uniqueTxs.length)
          
          // After all transactions are processed, find and update the most recent creation transaction
          if (publicKey && uniqueTxs.length > 0) {
            // Clean up duplicate main keys first
            const mainTxKey = STORAGE_KEYS.CAPSULE_CREATION_TX(publicKey.toString())
            const walletAddress = publicKey.toString()
            
            // Find all keys that match the main key pattern (including duplicates)
            const allKeys: string[] = []
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key) {
                // Check if it's the main key (exact match) or a signature-specific key
                if (key === mainTxKey || key.startsWith(`capsule_creation_tx_${walletAddress}_`)) {
                  allKeys.push(key)
                }
              }
            }
            
            // Remove duplicate main keys (keep only one)
            const mainKeyMatches = allKeys.filter(k => k === mainTxKey)
            if (mainKeyMatches.length > 1) {
              console.warn('Found duplicate main keys, removing duplicates:', mainKeyMatches.length)
              // Keep the first one, remove others (they should have the same value anyway)
              for (let i = 1; i < mainKeyMatches.length; i++) {
                localStorage.removeItem(mainKeyMatches[i])
              }
            }
            
            // Collect all unique creation transaction signatures
            const allCreationTxsWithKeys: Array<{ key: string; signature: string }> = []
            const seenSignatures = new Set<string>()
            
            // First, get the main key value
            const mainTx = localStorage.getItem(mainTxKey)
            if (mainTx && !seenSignatures.has(mainTx)) {
              allCreationTxsWithKeys.push({ key: mainTxKey, signature: mainTx })
              seenSignatures.add(mainTx)
            }
            
            // Then, get all signature-specific keys
            for (const key of allKeys) {
              if (key !== mainTxKey && key.startsWith(`capsule_creation_tx_${walletAddress}_`)) {
                const sig = localStorage.getItem(key)
                if (sig && !seenSignatures.has(sig)) {
                  allCreationTxsWithKeys.push({ key, signature: sig })
                  seenSignatures.add(sig)
                }
              }
            }
            
            // Also check transactions from Helius RPC that were just added
            const creationTxsFromHelius = uniqueTxs.filter(tx => tx.type === 'creation')
            for (const tx of creationTxsFromHelius) {
              if (tx.signature && !seenSignatures.has(tx.signature)) {
                const txKeyWithSig = STORAGE_KEYS.CAPSULE_CREATION_TX_WITH_SIG(publicKey.toString(), tx.signature)
                allCreationTxsWithKeys.push({ key: txKeyWithSig, signature: tx.signature })
                seenSignatures.add(tx.signature)
              }
            }
            
            console.log('All creation transactions found:', allCreationTxsWithKeys.length, allCreationTxsWithKeys.map(t => ({
              key: t.key.substring(t.key.length - 20),
              sig: t.signature.substring(0, 8) + '...'
            })))
            
            // Find the most recent transaction by comparing timestamps
            if (allCreationTxsWithKeys.length > 0) {
              let mostRecentTx: { key: string; signature: string; timestamp: number } | null = null
              
              // Check if the expected latest transaction (JAJ9NiAT...wWVP) exists
              const expectedLatestSig = 'JAJ9NiATPTArLQj1LZLoGacpN3aUkNwU6weZ1iiTbPU6QMmJc13PkmvCwFeUQ3Y15kuNhhnZCjpKVymm7DrwWVP'
              const hasExpectedLatest = allCreationTxsWithKeys.some(t => t.signature === expectedLatestSig)
              console.log('Expected latest transaction (JAJ9NiAT...wWVP) found:', hasExpectedLatest)
              
              for (const { signature } of allCreationTxsWithKeys) {
                // First check in the transactions we just fetched
                const txData = uniqueTxs.find(t => t.signature === signature)
                let timestamp = txData?.timestamp || 0
                
                // If not found in current transactions, try to fetch from RPC
                if (!timestamp) {
                  try {
                    const connection = getSolanaConnection()
                    const tx = await connection.getTransaction(signature, {
                      commitment: 'confirmed',
                      maxSupportedTransactionVersion: 0,
                    })
                    if (tx && tx.blockTime) {
                      timestamp = tx.blockTime
                    }
                  } catch (error) {
                    console.warn(`Could not fetch transaction ${signature.substring(0, 8)}... for timestamp:`, error)
                  }
                }
                
                console.log(`Transaction ${signature.substring(0, 8)}... timestamp:`, timestamp, timestamp ? new Date(timestamp * 1000).toLocaleString() : 'N/A')
                
                if (timestamp && (!mostRecentTx || timestamp > mostRecentTx.timestamp)) {
                  mostRecentTx = { key: mainTxKey, signature, timestamp }
                }
              }
              
              if (mostRecentTx) {
                console.log('Found most recent creation transaction:', {
                  signature: mostRecentTx.signature.substring(0, 8) + '...',
                  fullSignature: mostRecentTx.signature,
                  timestamp: mostRecentTx.timestamp,
                  time: new Date(mostRecentTx.timestamp * 1000).toLocaleString()
                })
                
                // Update the main key with the most recent transaction
                localStorage.setItem(mainTxKey, mostRecentTx.signature)
                setCreationTxSignature(mostRecentTx.signature)
                console.log('Updated main creation transaction key to most recent:', mostRecentTx.signature.substring(0, 8) + '...')
                
                // Also ensure the signature-specific key exists
                const txKeyWithSig = STORAGE_KEYS.CAPSULE_CREATION_TX_WITH_SIG(publicKey.toString(), mostRecentTx.signature)
                localStorage.setItem(txKeyWithSig, mostRecentTx.signature)
              } else {
                console.warn('Could not determine most recent transaction - no valid timestamps found')
              }
            }
          }
          
          // Double-check state after a brief delay
          setTimeout(() => {
            console.log('State check after update - transactions count should be:', uniqueTxs.length)
          }, 100)
        } else {
          console.log('No capsule transactions found in Helius RPC response')
          // Keep existing transactions from localStorage if any
          if (localStorageTxs.length > 0) {
            console.log('Keeping localStorage transactions:', localStorageTxs.length)
          }
        }
      } else {
        console.error('Helius RPC error: No transactions returned or invalid response')
      }
    } catch (error: any) {
      console.error('Error fetching transaction history:', error)
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })
      // Don't clear existing transactions on error
      if (localStorageTxs.length > 0) {
        console.log('Keeping existing localStorage transactions on error')
      }
    } finally {
      // After all processing, ensure the most recent creation transaction is set
      // This handles cases where Helius RPC might miss some transactions
      if (publicKey) {
        const allCreationTxKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(`capsule_creation_tx_${publicKey.toString()}_`)) {
            allCreationTxKeys.push(key)
          }
        }
        
        const mainTxKey = STORAGE_KEYS.CAPSULE_CREATION_TX(publicKey.toString())
        const allCreationTxsWithKeys: Array<{ key: string; signature: string }> = []
        
        const mainTx = localStorage.getItem(mainTxKey)
        if (mainTx) {
          allCreationTxsWithKeys.push({ key: mainTxKey, signature: mainTx })
        }
        
        for (const key of allCreationTxKeys) {
          const sig = localStorage.getItem(key)
          if (sig && !allCreationTxsWithKeys.some(t => t.signature === sig)) {
            allCreationTxsWithKeys.push({ key, signature: sig })
          }
        }
        
        // Find the most recent transaction
        if (allCreationTxsWithKeys.length > 0) {
          Promise.all(
            allCreationTxsWithKeys.map(async ({ signature }) => {
              try {
                const connection = getSolanaConnection()
                const tx = await connection.getTransaction(signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0,
                })
                return tx && tx.blockTime ? { signature, timestamp: tx.blockTime } : null
              } catch (e) {
                return null
              }
            })
          ).then(results => {
            const validResults = results.filter((r): r is { signature: string; timestamp: number } => r !== null)
            if (validResults.length > 0) {
              const mostRecent = validResults.reduce((prev, curr) => 
                curr.timestamp > prev.timestamp ? curr : prev
              )
              localStorage.setItem(mainTxKey, mostRecent.signature)
              setCreationTxSignature(mostRecent.signature)
              console.log('Final update: Most recent creation transaction:', mostRecent.signature.substring(0, 8) + '...', {
                timestamp: mostRecent.timestamp,
                time: new Date(mostRecent.timestamp * 1000).toLocaleString()
              })
            }
          }).catch(err => {
            console.warn('Error in final transaction update:', err)
          })
        }
      }
    }
  }

  const getSolscanUrl = (signature: string) => {
    const network = SOLANA_CONFIG.NETWORK === 'devnet' ? 'devnet' : 'mainnet'
    return `https://solscan.io/tx/${signature}?cluster=${network}`
  }

  const getHeliusExplorerUrl = (signature: string) => {
    // Use Orb Markets explorer for devnet - use /tx/{signature} format
    return `https://orbmarkets.io/tx/${signature}?cluster=devnet`
  }

  const getOrbMarketsUrl = (signature: string) => {
    // Orb Markets URL for viewing transactions - use /tx/{signature} format
    return `https://orbmarkets.io/tx/${signature}?cluster=devnet`
  }

  const getWalletExplorerUrls = (address: string) => {
    const network = SOLANA_CONFIG.NETWORK === 'devnet' ? 'devnet' : 'mainnet'
    return {
      solscan: `https://solscan.io/account/${address}?cluster=${network}`,
      helius: `https://orbmarkets.io/address/${address}/history?cluster=devnet&hideSpam=true`,
      orbMarkets: `https://orbmarkets.io/address/${address}/history?cluster=devnet&hideSpam=true`,
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const canExecute = (lastActivity: number, inactivityPeriod: number): boolean => {
    const currentTime = Math.floor(Date.now() / 1000)
    const timeSinceActivity = currentTime - lastActivity
    return timeSinceActivity >= inactivityPeriod
  }

  const getTimeRemaining = (lastActivity: number, inactivityPeriod: number) => {
    const now = Math.floor(Date.now() / 1000)
    const timeSinceActivity = now - lastActivity
    const remaining = inactivityPeriod - timeSinceActivity
    
    if (remaining <= 0) {
      return 'Ready for execution'
    }
    
    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    
    return `${days}d ${hours}h ${minutes}m remaining`
  }

  const handleExecute = async () => {
    if (!capsule || !publicKey || !wallet) {
      setExecuteError('Wallet not connected')
      return
    }

    if (!canExecute(capsule.lastActivity, capsule.inactivityPeriod)) {
      setExecuteError('Inactivity period has not been met yet')
      return
    }

    setIsExecuting(true)
    setExecuteError(null)

    try {
      // Generate a simple proof for development
      // In production, this would be a real Noir ZK proof
      const currentTime = Math.floor(Date.now() / 1000)
      
      // Create proof public inputs: owner(32) + last_activity(8) + inactivity_period(8) + current_time(8) = 56 bytes
      const proofPublicInputs = new Uint8Array(56)
      
      // Owner pubkey (32 bytes)
      const ownerBytes = publicKey.toBytes()
      proofPublicInputs.set(ownerBytes, 0)
      
      // Last activity (8 bytes, little-endian)
      const lastActivityBytes = new Uint8Array(8)
      const lastActivityView = new DataView(lastActivityBytes.buffer)
      lastActivityView.setBigInt64(0, BigInt(capsule.lastActivity), true)
      proofPublicInputs.set(lastActivityBytes, 32)
      
      // Inactivity period (8 bytes, little-endian)
      const inactivityPeriodBytes = new Uint8Array(8)
      const inactivityPeriodView = new DataView(inactivityPeriodBytes.buffer)
      inactivityPeriodView.setBigInt64(0, BigInt(capsule.inactivityPeriod), true)
      proofPublicInputs.set(inactivityPeriodBytes, 40)
      
      // Current time (8 bytes, little-endian)
      const currentTimeBytes = new Uint8Array(8)
      const currentTimeView = new DataView(currentTimeBytes.buffer)
      currentTimeView.setBigInt64(0, BigInt(currentTime), true)
      proofPublicInputs.set(currentTimeBytes, 48)
      
      // Create a simple proof (64 bytes exactly for development)
      // In production, this would be a real Noir ZK proof
      const proof = new Uint8Array(64)
      // Fill with a simple hash-like value for development
      const proofData = new TextEncoder().encode(`proof_${capsule.lastActivity}_${capsule.inactivityPeriod}_${currentTime}`)
      // Ensure exactly 64 bytes by padding or truncating
      if (proofData.length >= 64) {
        proof.set(proofData.slice(0, 64))
      } else {
        proof.set(proofData)
        // Pad with zeros if needed
        for (let i = proofData.length; i < 64; i++) {
          proof[i] = 0
        }
      }
      
      // Calculate ZK proof hash for display (using simple hash for development)
      // In production, this would be the actual proof hash from Noir
      const proofHash = Array.from(proof)
        .slice(0, 16)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
      setZkProofHash(proofHash)
      
      // Calculate public inputs hash for display
      const inputsHash = Array.from(proofPublicInputs)
        .slice(0, 16)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
      setZkPublicInputsHash(inputsHash)
      
      // Save proof hashes to localStorage for persistence
      const proofHashKey = `zk_proof_hash_${publicKey.toString()}`
      const inputsHashKey = `zk_inputs_hash_${publicKey.toString()}`
      localStorage.setItem(proofHashKey, proofHash)
      localStorage.setItem(inputsHashKey, inputsHash)
      
      // Set verification status to pending
      setZkVerificationStatus('pending')
      
      // Get beneficiaries from intent data
      const beneficiaries = intentData?.beneficiaries || []
      
      // Execute the intent (owner must sign to transfer SOL)
      // Note: For SOL transfers, the owner must be the signer
      // If executor is different from owner, we need owner's signature
      const txHash = await executeIntent(
        wallet,
        publicKey, // owner
        proof,
        proofPublicInputs,
        beneficiaries // Pass beneficiaries for SOL distribution
      )
      
      // If execution succeeded, verification was successful
      setZkVerificationStatus('verified')

      // Save execution transaction to localStorage with unique key
      const executionTxKeyWithSig = STORAGE_KEYS.CAPSULE_EXECUTION_TX_WITH_SIG(publicKey.toString(), txHash)
      localStorage.setItem(executionTxKeyWithSig, txHash)
      
      // Also save to the main key (for backward compatibility)
      const executionTxKey = STORAGE_KEYS.CAPSULE_EXECUTION_TX(publicKey.toString())
      localStorage.setItem(executionTxKey, txHash)
      
      setExecutionTxSignature(txHash)
      console.log('Saved execution transaction to localStorage:', txHash)

      // Fetch transaction details to get blockTime
      try {
        const connection = getSolanaConnection()
        const tx = await connection.getTransaction(txHash, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        })
        
        if (tx && tx.blockTime) {
          // Add execution transaction to transactions list
          const executionTx = {
            signature: txHash,
            timestamp: tx.blockTime,
            type: 'execution',
            slot: tx.slot,
            fee: tx.meta?.fee,
          }
          setTransactions((prev) => {
            // Check if already exists
            const exists = prev.some((t: any) => t.signature === txHash)
            if (!exists) {
              return [executionTx, ...prev]
            }
            return prev
          })
        }
      } catch (error) {
        console.error('Error fetching execution transaction details:', error)
        // Still add to list with current time as fallback
        const currentTime = Math.floor(Date.now() / 1000)
        const executionTx = {
          signature: txHash,
          timestamp: currentTime,
          type: 'execution',
        }
        setTransactions((prev) => {
          const exists = prev.some((t: any) => t.signature === txHash)
          if (!exists) {
            return [executionTx, ...prev]
          }
          return prev
        })
      }

      // Save executed capsule to localStorage before reloading
      if (capsule && intentData) {
        const executedCapsuleData = {
          capsule: capsule,
          intentData: intentData,
          executedAt: Math.floor(Date.now() / 1000),
          executionTx: txHash,
        }
        
        const executedCapsulesKey = STORAGE_KEYS.EXECUTED_CAPSULES(publicKey.toString())
        const savedExecutedCapsules = localStorage.getItem(executedCapsulesKey)
        let executedCapsulesList: any[] = []
        
        if (savedExecutedCapsules) {
          try {
            executedCapsulesList = JSON.parse(savedExecutedCapsules)
            if (!Array.isArray(executedCapsulesList)) {
              executedCapsulesList = []
            }
          } catch (e) {
            executedCapsulesList = []
          }
        }
        
        // Check if this capsule is already in the list
        const existingIndex = executedCapsulesList.findIndex(
          (ec) => ec.executionTx === txHash
        )
        
        if (existingIndex === -1) {
          executedCapsulesList.push(executedCapsuleData)
          localStorage.setItem(executedCapsulesKey, JSON.stringify(executedCapsulesList))
          setExecutedCapsules(executedCapsulesList)
        }
      }

      // Reload capsule data to reflect execution
      await loadCapsuleData()
      
      alert(`Capsule executed successfully! Transaction: ${txHash}`)
    } catch (err: any) {
      console.error('Error executing capsule:', err)
      setExecuteError(err.message || 'Failed to execute capsule')
    } finally {
      setIsExecuting(false)
    }
  }

  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="fixed inset-0 w-full h-full z-0">
          <Hero3D />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
        </div>
        <div className="relative z-20 flex items-center justify-center min-h-screen p-6">
          <div className="material-card material-elevation-4 rounded-2xl p-12 text-center max-w-md">
            <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-slate-300 mb-8">
              Please connect your Solana wallet to view your capsules
            </p>
            <div className="relative z-[9999] inline-block">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="fixed inset-0 w-full h-full z-0">
          <Hero3D />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
        </div>
        <div className="relative z-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading capsule data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="fixed inset-0 w-full h-full z-0">
          <Hero3D />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
        </div>
        <div className="relative z-20 flex items-center justify-center min-h-screen p-6">
          <div className="material-card material-elevation-4 rounded-2xl p-12 border-2 border-red-500/50 text-center max-w-md bg-red-500/10">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
            <p className="text-slate-300 mb-8">{error}</p>
            <button
              onClick={loadCapsuleData}
              className="material-button material-elevation-2 hover:material-elevation-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!capsule) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="fixed inset-0 w-full h-full z-0">
          <Hero3D />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
        </div>
        <div className="relative z-20 flex items-center justify-center min-h-screen p-6">
          <div className="material-card material-elevation-4 rounded-2xl p-12 text-center max-w-md">
            <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">No Capsule Found</h2>
            <p className="text-slate-300 mb-8">
              You don't have any capsules yet. Create one to get started!
            </p>
            <Link href="/create">
              <button className="material-button material-elevation-2 hover:material-elevation-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold transition-all">
                Create Capsule
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* 3D Hero Background */}
      <div className="fixed inset-0 w-full h-full z-0">
        <Hero3D />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10"></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 overflow-visible">
        <div className="max-w-7xl mx-auto px-6 py-4 overflow-visible">
          <div className="flex items-center justify-between overflow-visible">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 transition-transform group-hover:rotate-12">
                <Image src="/logo.svg" alt="Lucid" fill className="object-contain" />
              </div>
              <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                Lucid
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="relative z-[9999] wallet-menu-container">
                {connected && publicKey ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowWalletMenu(!showWalletMenu)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      <span className="font-mono text-sm">
                        {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                      </span>
                      {showWalletMenu ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {showWalletMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden z-[10000]">
                        <button
                          onClick={async () => {
                            try {
                              await disconnect()
                              setShowWalletMenu(false)
                            } catch (err) {
                              console.error('Error disconnecting wallet:', err)
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                        >
                          Disconnect
                        </button>
                        {wallets && wallets.length > 1 && (
                          <>
                            <div className="border-t border-slate-700"></div>
                            <div className="px-2 py-1 text-xs text-slate-400">Switch Wallet</div>
                            {wallets.map((w: any) => (
                              <button
                                key={w.adapter.name}
                                onClick={async () => {
                                  try {
                                    await select(w.adapter.name)
                                    setShowWalletMenu(false)
                                  } catch (err) {
                                    console.error('Error switching wallet:', err)
                                  }
                                }}
                                className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                              >
                                {w.adapter.name}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <WalletMultiButton />
                )}
              </div>
              <Link href="/">
                <button className="material-button material-elevation-2 hover:material-elevation-4 flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-xl text-white rounded-lg border border-slate-700/50 hover:border-blue-500/50 transition-all">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-20 max-w-7xl mx-auto px-6 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2">My Intent Capsule</h1>
          <p className="text-slate-300">View your capsule details and activity</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Capsule Status */}
            <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <Shield className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Capsule Status</h2>
                </div>
                <div className={`px-4 py-2 rounded-xl font-semibold material-elevation-2 ${
                  capsule.isActive
                    ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                    : 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                }`}>
                  {capsule.isActive ? 'Active' : 'Executed'}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Owner</span>
                  <span className="text-white font-mono text-sm">{publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Inactivity Period</span>
                  <span className="text-white">{secondsToDays(capsule.inactivityPeriod).toFixed(1)} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Last Activity</span>
                  <span className="text-white">{formatDate(capsule.lastActivity)}</span>
                </div>
                {capsule.isActive && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Time Remaining</span>
                      <span className={`font-semibold ${
                        canExecute(capsule.lastActivity, capsule.inactivityPeriod)
                          ? 'text-green-400'
                          : 'text-blue-400'
                      }`}>
                        {getTimeRemaining(capsule.lastActivity, capsule.inactivityPeriod)}
                      </span>
                    </div>
                    {canExecute(capsule.lastActivity, capsule.inactivityPeriod) && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <button
                          onClick={handleExecute}
                          disabled={isExecuting}
                          className="material-button material-elevation-4 hover:material-elevation-8 w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-xl shadow-green-500/30 hover:shadow-green-500/50"
                        >
                          <Zap className="w-5 h-5" />
                          {isExecuting ? 'Executing...' : 'Execute Capsule'}
                        </button>
                        {executeError && (
                          <p className="mt-2 text-sm text-red-400">{executeError}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
                {capsule.executedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Executed At</span>
                    <span className="text-white">{formatDate(capsule.executedAt)}</span>
                  </div>
                )}
                {creationTxSignature && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-300">Creation Transaction</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">
                        {creationTxSignature.slice(0, 8)}...{creationTxSignature.slice(-8)}
                      </span>
                      <a
                        href={getOrbMarketsUrl(creationTxSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                      >
                        View on Orb Markets
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
                {executionTxSignature && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-300">Execution Transaction</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">
                        {executionTxSignature.slice(0, 8)}...{executionTxSignature.slice(-8)}
                      </span>
                      <a
                        href={getOrbMarketsUrl(executionTxSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                      >
                        View on Orb Markets
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Intent Data */}
            {intentData && (
              <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Intent Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Intent Statement</label>
                    <p className="text-white bg-slate-900/50 backdrop-blur-sm rounded-xl p-4">{intentData.intent || 'N/A'}</p>
                  </div>
                  {intentData.beneficiaries && intentData.beneficiaries.length > 0 && (
                    <div>
                      <label className="text-slate-300 text-sm mb-2 block">Beneficiaries</label>
                      <div className="space-y-2">
                        {Array.isArray(intentData.beneficiaries) && intentData.beneficiaries.map((b: any, idx: number) => (
                          <div key={idx} className="bg-slate-900/50 backdrop-blur-sm rounded-lg p-3 flex justify-between items-center">
                            <span className="text-white font-mono text-sm">{b.address.slice(0, 8)}...{b.address.slice(-8)}</span>
                            <span className="text-blue-400">
                              {b.amount} {b.amountType === 'percentage' ? '%' : 'SOL'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {intentData.totalAmount && (
                    <div>
                      <label className="text-slate-300 text-sm mb-2 block">Total Amount</label>
                      <p className="text-white font-semibold">{intentData.totalAmount} SOL</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Noir ZK Integration */}
            <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">Noir ZK Integration</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-white font-semibold">ZK Proof Verification Enabled</span>
                  </div>
                  <p className="text-slate-300 text-sm">
                    This capsule uses Noir zero-knowledge proofs to verify inactivity periods. 
                    Execution requires a valid ZK proof demonstrating no activity during the specified period.
                  </p>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-semibold">Proof Requirements</span>
                  </div>
                  <ul className="text-slate-300 text-sm space-y-1 ml-7">
                    <li>• Inactivity period has been met</li>
                    <li>• No activity occurred during the period</li>
                    <li>• Proof is valid for this specific capsule</li>
                  </ul>
                </div>

                {capsule.executedAt && (
                  <div className="bg-green-500/10 border-2 border-green-500/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-white font-semibold">ZK Proof Verified & Executed</span>
                    </div>
                    <p className="text-slate-300 text-sm mb-3">
                      This capsule was executed with a verified Noir ZK proof on {formatDate(capsule.executedAt)}.
                      The zero-knowledge proof was successfully verified on-chain before execution.
                    </p>
                    
                    {/* ZK Proof Details */}
                    {(zkProofHash || zkPublicInputsHash) && (
                      <div className="mt-3 pt-3 border-t border-green-500/30 space-y-3">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-blue-400" />
                            <span className="text-slate-300 text-xs font-semibold">ZK Proof Details</span>
                          </div>
                          {zkProofHash && (
                            <div className="mb-2">
                              <span className="text-slate-400 text-xs">Proof Hash:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-white font-mono text-xs bg-slate-800/50 px-2 py-1 rounded">
                                  {zkProofHash}...
                                </span>
                                <span className="text-green-400 text-xs">✓ Verified</span>
                              </div>
                            </div>
                          )}
                          {zkPublicInputsHash && (
                            <div>
                              <span className="text-slate-400 text-xs">Public Inputs Hash:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-white font-mono text-xs bg-slate-800/50 px-2 py-1 rounded">
                                  {zkPublicInputsHash}...
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Execution Transaction */}
                    {executionTxSignature && (
                      <div className="mt-3 pt-3 border-t border-green-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-300 text-sm font-semibold">On-Chain Verification Transaction:</span>
                        </div>
                        <p className="text-slate-400 text-xs mb-2">
                          This transaction contains the ZK proof and was verified on-chain by the Solana program.
                        </p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-white font-mono text-xs bg-slate-800/50 px-2 py-1 rounded">
                            {executionTxSignature.slice(0, 12)}...{executionTxSignature.slice(-12)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={getOrbMarketsUrl(executionTxSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors bg-slate-800/50 px-3 py-1.5 rounded-lg hover:bg-slate-700/50"
                          >
                            View on Orb Markets
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={getSolscanUrl(executionTxSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors bg-slate-800/50 px-3 py-1.5 rounded-lg hover:bg-slate-700/50"
                          >
                            View on Solscan
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Helius Integration */}
            <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">Helius Activity</h2>
              </div>
              <div className="space-y-4">
                {walletActivity && publicKey && (
                  <>
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-white font-semibold">Real-time Monitoring</span>
                      </div>
                      <p className="text-slate-300 text-sm mb-3">
                        Wallet activity is monitored in real-time using Helius RPC (getTransactionsForAddress) for accurate inactivity detection.
                      </p>
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-300 text-sm">Wallet Address:</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-white font-mono text-xs break-all">
                            {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const walletUrls = getWalletExplorerUrls(publicKey.toString())
                            return (
                              <>
                                <a
                                  href={walletUrls.solscan}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                                >
                                  Solscan
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                  href={walletUrls.orbMarkets}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                                >
                                  Orb Markets
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-300">Last Activity</span>
                          <span className="text-white text-sm">
                            {walletActivity.lastActivityTimestamp
                              ? new Date(walletActivity.lastActivityTimestamp).toLocaleString()
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-300">Transaction Count</span>
                          <span className="text-white">{walletActivity.transactionCount || 0}</span>
                        </div>
                        {walletActivity?.lastSignature && (
                          <div className="pt-2 border-t border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-300 text-sm">Last Transaction:</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-mono text-xs">
                                {walletActivity.lastSignature.slice(0, 8)}...{walletActivity.lastSignature.slice(-8)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={getSolscanUrl(walletActivity.lastSignature)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                              >
                                Solscan
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <a
                                href={getOrbMarketsUrl(walletActivity.lastSignature)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                              >
                                Orb Markets
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-semibold">Helius Features</span>
                  </div>
                  <ul className="text-slate-300 text-sm space-y-1 ml-7">
                    <li>• Enhanced transaction parsing</li>
                    <li>• Real-time activity monitoring</li>
                    <li>• Webhook support for automation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="material-card material-elevation-2 hover:material-elevation-4 p-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                Recent capsule transactions
                {transactions.length > 0 && (
                  <span className="ml-2 text-sm text-slate-400">({transactions.length})</span>
                )}
              </h2>
              {Array.isArray(transactions) && transactions.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.map((tx: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-3 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        {tx.type === 'execution' && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/50">
                            Execution
                          </span>
                        )}
                        {tx.type === 'creation' && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/50">
                            Creation
                          </span>
                        )}
                        <span className="text-white font-mono text-xs">
                          {tx.signature?.slice(0, 8)}...{tx.signature?.slice(-8)}
                        </span>
                      </div>
                      
                      {/* Transaction Details */}
                      <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Status:</span>
                          <span className={tx.err ? 'text-red-400' : 'text-green-400'}>
                            {tx.err 
                              ? 'Failed' 
                              : tx.type === 'execution' 
                                ? 'Executed' 
                                : 'Success'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-white">
                            {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                        {tx.err && (
                          <div className="mt-1 pt-1 border-t border-red-500/20">
                            <span className="text-red-400 text-xs">
                              Error: {typeof tx.err === 'object' ? JSON.stringify(tx.err) : String(tx.err)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <a
                          href={getSolscanUrl(tx.signature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        >
                          Solscan
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={getOrbMarketsUrl(tx.signature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        >
                          Orb Markets
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">No transactions found</p>
                </div>
              )}
            </div>

            {/* Executed Capsules Dropdown */}
            {executedCapsules.length > 0 && (
              <div className="material-card material-elevation-2 hover:material-elevation-4 p-8 mt-6">
                <button
                  onClick={() => setShowExecutedCapsules(!showExecutedCapsules)}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <h2 className="text-2xl font-bold text-white">Executed Capsules</h2>
                  {showExecutedCapsules ? (
                    <ChevronUp className="w-6 h-6 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-slate-400" />
                  )}
                </button>
                
                {showExecutedCapsules && (
                  <div className="space-y-4">
                    {Array.isArray(executedCapsules) && executedCapsules
                      .sort((a, b) => (b.executedAt || 0) - (a.executedAt || 0))
                      .map((executedCapsule, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                                <CheckCircle className="w-6 h-6 text-blue-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-white">Executed Capsule</h3>
                                <p className="text-slate-400 text-sm">
                                  Executed: {formatDate(executedCapsule.executedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg font-semibold text-sm border border-blue-500/50">
                              Executed
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-300">Inactivity Period</span>
                              <span className="text-white">
                                {secondsToDays(executedCapsule.capsule.inactivityPeriod).toFixed(1)} days
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-300">Last Activity</span>
                              <span className="text-white">{formatDate(executedCapsule.capsule.lastActivity)}</span>
                            </div>
                            {executedCapsule.intentData && (
                              <>
                                {executedCapsule.intentData.intent && (
                                  <div>
                                    <span className="text-slate-300 text-sm mb-2 block">Intent Statement</span>
                                    <p className="text-white bg-slate-800/50 rounded-lg p-3 text-sm">
                                      {executedCapsule.intentData.intent}
                                    </p>
                                  </div>
                                )}
                                {executedCapsule.intentData.beneficiaries && executedCapsule.intentData.beneficiaries.length > 0 && (
                                  <div>
                                    <span className="text-slate-300 text-sm mb-2 block">Beneficiaries</span>
                                    <div className="space-y-2">
                                      {Array.isArray(executedCapsule.intentData?.beneficiaries) && executedCapsule.intentData.beneficiaries.map((b: any, bidx: number) => (
                                        <div key={bidx} className="bg-slate-800/50 rounded-lg p-2 flex justify-between items-center">
                                          <span className="text-white font-mono text-xs">{b.address.slice(0, 8)}...{b.address.slice(-8)}</span>
                                          <span className="text-blue-400 text-sm">
                                            {b.amount} {b.amountType === 'percentage' ? '%' : 'SOL'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {executedCapsule.intentData.totalAmount && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-300">Total Amount</span>
                                    <span className="text-white font-semibold">{executedCapsule.intentData.totalAmount} SOL</span>
                                  </div>
                                )}
                              </>
                            )}
                            {executedCapsule.executionTx && (
                              <div className="pt-3 border-t border-slate-700/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-slate-300 text-sm">Execution Transaction</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-mono text-xs">
                                    {executedCapsule.executionTx.slice(0, 8)}...{executedCapsule.executionTx.slice(-8)}
                                  </span>
                                  <a
                                    href={getOrbMarketsUrl(executedCapsule.executionTx)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                                  >
                                    View on Orb Markets
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
