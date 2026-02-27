import { motion, AnimatePresence } from 'framer-motion'
import { useState, useMemo, useEffect } from 'react'
import {
    classifyBuildIntent,
    detectBuildIntent,
    detectScopeTier,
    SCOPE_TIER_INFO,
    BUILD_PHASES,
    type CategoryMatch,
    type ScopeTier
} from '@/lib/ntntn/engine'

/**
 * ACHEEVY-009 — NtNtN Build Intent Analyzer
 * Shows real-time NLP analysis as the user types, displaying detected categories,
 * scope tier, estimated cost/time, and the pipeline phases.
 */

interface NtNtNAnalyzerProps {
    inputText: string
    isVisible?: boolean
    className?: string
}

function CategoryChip({ match, index }: { match: CategoryMatch; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]"
        >
            <span className="text-[10px]" style={{ color: match.color }}>
                {match.icon}
            </span>
            <span className="text-[10px] font-medium text-white/80">
                {match.label}
            </span>
            <span
                className="text-[9px] font-mono px-1 py-0.5 rounded-full"
                style={{ backgroundColor: `${match.color}20`, color: match.color }}
            >
                {match.score}
            </span>
        </motion.div>
    )
}

function ScopeBadge({ tier }: { tier: ScopeTier }) {
    const info = SCOPE_TIER_INFO[tier]
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03]"
        >
            <div>
                <span
                    className="text-xs font-semibold"
                    style={{ color: info.color }}
                >
                    {info.label}
                </span>
                <p className="text-[10px] text-grey-2 mt-0.5">
                    {info.description}
                </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-mono text-white/60">{info.cost}</span>
                <span className="text-[10px] font-mono text-white/40">{info.time}</span>
            </div>
        </motion.div>
    )
}

function PipelinePhases({ activePhase }: { activePhase: number }) {
    return (
        <div className="flex items-center gap-1">
            {BUILD_PHASES.map((phase, i) => (
                <motion.div
                    key={phase.id}
                    className="flex items-center gap-1"
                    animate={{
                        opacity: i <= activePhase ? 1 : 0.3
                    }}
                >
                    <motion.div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] border"
                        style={{
                            borderColor: i <= activePhase ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)',
                            backgroundColor: i <= activePhase ? 'rgba(168,85,247,0.1)' : 'transparent',
                            color: i <= activePhase ? '#c4b5fd' : 'rgba(255,255,255,0.3)'
                        }}
                        animate={i === activePhase ? {
                            scale: [1, 1.15, 1],
                            borderColor: ['rgba(168,85,247,0.5)', 'rgba(168,85,247,0.8)', 'rgba(168,85,247,0.5)']
                        } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        {phase.icon}
                    </motion.div>
                    {i < BUILD_PHASES.length - 1 && (
                        <div
                            className="w-3 h-px"
                            style={{
                                backgroundColor: i < activePhase ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.08)'
                            }}
                        />
                    )}
                </motion.div>
            ))}
        </div>
    )
}

export function NtNtNAnalyzer({ inputText, isVisible = true, className = '' }: NtNtNAnalyzerProps) {
    const [animPhase, setAnimPhase] = useState(0)

    const hasBuildIntent = useMemo(() => detectBuildIntent(inputText), [inputText])
    const categories = useMemo(() => classifyBuildIntent(inputText), [inputText])
    const scopeTier = useMemo(() => detectScopeTier(inputText), [inputText])

    // Animate through phases when build intent is detected
    useEffect(() => {
        if (!hasBuildIntent) {
            setAnimPhase(0)
            return
        }
        const interval = setInterval(() => {
            setAnimPhase((prev) => (prev + 1) % BUILD_PHASES.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [hasBuildIntent])

    if (!isVisible || !inputText.trim() || !hasBuildIntent) return null

    return (
        <motion.div
            className={`rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md p-3 ${className}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <motion.div
                        className="w-2 h-2 rounded-full bg-green"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-[10px] font-mono text-grey-2 uppercase tracking-wider">
                        NtNtN Engine — Build Intent Detected
                    </span>
                </div>
                <PipelinePhases activePhase={animPhase} />
            </div>

            {/* Categories */}
            <AnimatePresence mode="popLayout">
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {categories.map((match, i) => (
                        <CategoryChip key={match.category} match={match} index={i} />
                    ))}
                </div>
            </AnimatePresence>

            {/* Scope */}
            <ScopeBadge tier={scopeTier} />
        </motion.div>
    )
}

export default NtNtNAnalyzer
