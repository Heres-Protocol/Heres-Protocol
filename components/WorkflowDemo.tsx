'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Lock, Eye, Zap, CheckCircle, Clock, User, Calendar } from 'lucide-react'
import { ArrowRight, RotateCcw } from 'lucide-react'

interface WorkflowDemoProps {
  activeStep: number
}

export default function WorkflowDemo({ activeStep }: WorkflowDemoProps) {
  const [currentStep, setCurrentStep] = useState(activeStep)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    setCurrentStep(activeStep)
    if (activeStep === 4) {
      setIsExecuting(true)
      const timer = setTimeout(() => {
        setIsExecuting(false)
        setIsCompleted(true)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setIsExecuting(false)
      setIsCompleted(false)
    }
  }, [activeStep])

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleRestart = () => {
    setCurrentStep(1)
    setIsExecuting(false)
    setIsCompleted(false)
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="text-sm text-slate-200 mb-2 block font-medium">Intent Statement</label>
        <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
          <p className="text-white text-sm">
            If I am inactive for 365 days, transfer 1.5 ETH to my family...
          </p>
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-200 mb-2 block font-medium">Total Amount</label>
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl p-6 border border-blue-500/30">
          <p className="text-3xl font-bold text-blue-300">3.0 ETH</p>
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-200 mb-2 block font-medium">Beneficiaries</label>
        <div className="space-y-2">
          <div className="bg-white/[0.08] rounded-lg p-3 border border-[#A0ECFF]/25 flex justify-between items-center">
            <span className="text-white text-sm font-mono">0x742d...35Cc</span>
            <span className="text-blue-300 font-semibold">1.5 ETH (50%)</span>
          </div>
          <div className="bg-white/[0.08] rounded-lg p-3 border border-[#A0ECFF]/25 flex justify-between items-center">
            <span className="text-white text-sm font-mono">0x8a3f...9B2d</span>
            <span className="text-blue-300 font-semibold">1.5 ETH (50%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-200 font-medium">Inactivity Period</span>
          </div>
          <p className="text-xl font-bold text-white">365 days</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-200 font-medium">Delay Window</span>
          </div>
          <p className="text-xl font-bold text-white">30 days</p>
        </div>
      </div>

      <button
        onClick={handleNextStep}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all"
      >
        Next Step
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-200 font-medium">Inactivity Period</span>
          </div>
          <p className="text-2xl font-bold text-white mb-1">365 days</p>
          <p className="text-xs text-slate-200">No activity detected for this duration</p>
        </div>

        <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-300" />
            <span className="text-xs text-slate-200 font-medium">Delay Window</span>
          </div>
          <p className="text-2xl font-bold text-white mb-1">30 days</p>
          <p className="text-xs text-slate-200">Grace period before execution</p>
        </div>

        <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-slate-300" />
            <span className="text-xs text-slate-200 font-medium">Last Activity</span>
          </div>
          <p className="text-lg font-bold text-white mb-1 font-mono">0x5a3b...2F1c</p>
          <p className="text-xs text-slate-200">Wallet address to monitor</p>
        </div>

        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl p-4 border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-200 font-medium">Estimated Trigger Time</span>
          </div>
          <p className="text-2xl font-bold text-white mb-1">Jan 15, 2026</p>
          <p className="text-xs text-slate-200">If no activity until this date</p>
        </div>
      </div>

      <button
        onClick={handleNextStep}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all"
      >
        Next Step
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
        <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
        <h4 className="text-sm font-semibold text-white mb-3">Capsule Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-200">Intent:</span>
            <span className="text-white">Transfer assets after 365 days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-200">Total Amount:</span>
            <span className="text-blue-400 font-semibold">3.0 ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-200">Beneficiaries:</span>
            <span className="text-white">2 addresses</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-200">Trigger:</span>
            <span className="text-white">365 days inactivity</span>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-semibold text-white">All Validations Passed</h4>
        </div>
        <div className="space-y-2">
          {[
            'Intent statement is valid',
            'Beneficiary addresses are valid',
            'Total allocation equals 100%',
            'Trigger conditions are set',
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-slate-200">
              <CheckCircle className="w-3 h-3 text-blue-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

        <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
        <h4 className="text-sm font-semibold text-white mb-3">Simulation Result</h4>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold">Execution would succeed</span>
        </div>
        <p className="text-xs text-slate-200">
          All conditions are met. The capsule is ready for automatic execution.
        </p>
      </div>

      <button
        onClick={handleNextStep}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all"
      >
        Next Step
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      {isExecuting ? (
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-8 border border-blue-500/30 text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-bold text-white mb-2">Executing...</p>
          <p className="text-sm text-slate-100">Conditions met. Transferring assets...</p>
        </div>
      ) : isCompleted ? (
        <>
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-8 border border-blue-500/30 text-center">
            <CheckCircle className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <p className="text-2xl font-bold text-white mb-2">Execution Completed!</p>
            <p className="text-sm text-slate-100">Assets have been successfully transferred</p>
          </div>

          <div className="space-y-3">
            <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-200">To:</span>
                <span className="text-sm font-semibold text-blue-400">1.5 ETH</span>
              </div>
              <p className="text-sm text-white font-mono mb-2">0x742d...35Cc</p>
              <div className="flex items-center gap-2 text-xs text-slate-200">
                <CheckCircle className="w-3 h-3 text-blue-400" />
                <span>Transaction confirmed on-chain</span>
              </div>
            </div>
            <div className="bg-white/[0.08] rounded-xl p-4 border border-[#A0ECFF]/25">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-200">To:</span>
                <span className="text-sm font-semibold text-blue-400">1.5 ETH</span>
              </div>
              <p className="text-sm text-white font-mono mb-2">0x8a3f...9B2d</p>
              <div className="flex items-center gap-2 text-xs text-slate-200">
                <CheckCircle className="w-3 h-3 text-blue-400" />
                <span>Transaction confirmed on-chain</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-8 border border-blue-500/30 text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-bold text-white mb-2">Executing...</p>
          <p className="text-sm text-slate-100">Conditions met. Transferring assets...</p>
        </div>
      )}

      <button
        onClick={handleRestart}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all"
      >
        <RotateCcw className="w-4 h-4" />
        Restart Demo
      </button>
    </div>
  )

  const steps = [
    { number: 1, title: 'Create Memory Capsule', icon: Sparkles, render: renderStep1 },
    { number: 2, title: 'Set Trigger Conditions', icon: Lock, render: renderStep2 },
    { number: 3, title: 'Simulate Execution', icon: Eye, render: renderStep3 },
    { number: 4, title: 'Automatic Execution', icon: Zap, render: renderStep4 },
  ]

  const currentStepData = steps[currentStep - 1]
  const Icon = currentStepData.icon

  return (
    <div className="w-full h-full bg-white/[0.12] backdrop-blur-xl rounded-2xl border border-[#A0ECFF]/40 p-8 shadow-lg">
      {/* Step Indicator */}
      <div className="flex justify-center gap-3 mb-6">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              step.number === currentStep
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white scale-110'
                : 'bg-white/20 text-slate-200 border border-[#A0ECFF]/30'
            }`}
          >
            {step.number}
          </div>
        ))}
      </div>

      {/* Step Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500/25 to-cyan-500/25 rounded-xl flex items-center justify-center border border-blue-500/40">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white">{currentStepData.title}</h3>
          <p className="text-sm text-slate-200">Step {currentStep} of 4</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStepData.render()}
      </div>
    </div>
  )
}
