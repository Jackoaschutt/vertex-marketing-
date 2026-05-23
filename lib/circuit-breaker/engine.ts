import type { PnLState, CircuitBreakerResult, CircuitBreakerThreshold } from '@/types'

export function computeSessionPnLState(sessionPnl: number, dllAmount: number): PnLState {
  const pctOfDll = sessionPnl < 0 ? (Math.abs(sessionPnl) / dllAmount) * 100 : 0
  return { sessionPnl, dllAmount, pctOfDll }
}

export function evaluateCircuitBreaker(
  pnlState: PnLState,
  triggeredThresholds: Set<CircuitBreakerThreshold>
): CircuitBreakerResult {
  if (pnlState.pctOfDll >= 80 && !triggeredThresholds.has(80)) {
    return { shouldFire: true, threshold: 80 }
  }
  if (pnlState.pctOfDll >= 50 && !triggeredThresholds.has(50)) {
    return { shouldFire: true, threshold: 50 }
  }
  return { shouldFire: false, threshold: null }
}
