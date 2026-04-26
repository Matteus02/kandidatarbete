import type { KKResult } from '@/types/eis'

/**
 * Performs a Kramers-Kronig (KK) consistency test on EIS data.
 * 
 * Logic: Compares the measured phase with the "KK-expected" phase 
 * calculated from the magnitude slope. 
 * Relation: Phase ≈ (π/2) * d(log|Z|) / d(log f) [90° per decade of magnitude change]
 */
export function performKKTest(frequencies: number[], zReal: number[], zImag: number[]): KKResult {
  const n = frequencies.length
  if (n < 10) {
    return { 
      isConsistent: false, 
      rmse: 0, 
      message: 'Too few data points (min 10) for a reliable validation.',
      testedAt: new Date().toISOString()
    }
  }

  let totalDeviation = 0
  let count = 0

  // We use a windowed approach to calculate slopes
  // Skip edges to avoid boundary artifacts
  for (let i = 2; i < n - 2; i++) {
    const f1 = frequencies[i - 1]!
    const f2 = frequencies[i + 1]!
    const z1 = Math.sqrt(zReal[i - 1]! ** 2 + zImag[i - 1]! ** 2)
    const z2 = Math.sqrt(zReal[i + 1]! ** 2 + zImag[i + 1]! ** 2)

    if (f1 === f2 || z1 === 0 || z2 === 0) continue

    // Logarithmic slope: d(log10|Z|) / d(log10 f)
    const slope = (Math.log10(z2) - Math.log10(z1)) / (Math.log10(f2) - Math.log10(f1))
    
    // Kramers-Kronig relation for phase (in degrees)
    // A slope of -1 (capacitive/inductive) corresponds to -90° or +90°
    const expectedPhase = slope * 90 
    
    // Actual phase from measurements (in degrees)
    // Note: zImag is -Im(Z) in our store, so atan2(-zImag, zReal) gives true phase
    const actualPhase = Math.atan2(-zImag[i]!, zReal[i]!) * (180 / Math.PI)
    
    totalDeviation += Math.abs(actualPhase - expectedPhase)
    count++
  }

  const avgDeviation = count > 0 ? totalDeviation / count : 100
  
  // Threshold: systems with > 12° average phase deviation from KK-expected 
  // are likely non-linear, non-causal or extremely noisy.
  const threshold = 12
  const isConsistent = avgDeviation < threshold

  return {
    isConsistent,
    rmse: avgDeviation,
    message: isConsistent 
      ? `Validation Successful: Data is consistent with KK relations (Avg dev: ${avgDeviation.toFixed(1)}°).`
      : `Validation Warning: Significant deviation detected (${avgDeviation.toFixed(1)}°). Data may be non-linear or noisy.`,
    testedAt: new Date().toISOString()
  }
}
