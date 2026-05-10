import type { EisDataPoint } from '@/types/eis'

export interface ArcPeak {
  f: number
  imPeak: number
}


// Detects individual RC arcs by finding local maxima in -Im(Z).

export function detectArcPeaks(data: EisDataPoint[]): ArcPeak[] {
  const N = data.length
  if (N < 3) return []

  const imZ = data.map(d => d['-Im(Z)/Ohm'])
  const freq = data.map(d => d['freq/Hz'])

  // Light 3-point smoothing
  const smoothed: number[] = imZ.map((_, i) => {
    const lo = Math.max(0, i - 1)
    const hi = Math.min(N - 1, i + 1)
    let s = 0
    for (let k = lo; k <= hi; k++) s += imZ[k]!
    return s / (hi - lo + 1)
  })

  const globalMaxIm = Math.max(...smoothed, 1e-30)
  const minProm = globalMaxIm * 0.05

  const arcPeaks: ArcPeak[] = []
  for (let i = 1; i < N - 1; i++) {
    const v = smoothed[i]!
    if (v > smoothed[i - 1]! && v >= smoothed[i + 1]! && v >= minProm) {
      arcPeaks.push({ f: freq[i]!, imPeak: imZ[i]! })
    }
  }

  if (arcPeaks.length === 0) {
    const idx = smoothed.indexOf(globalMaxIm)
    arcPeaks.push({ f: freq[idx] ?? 1, imPeak: Math.max(imZ[idx] ?? 1, 1) })
  }

  return arcPeaks
}

// Estimates the Warburg coefficient (A) from the low-frequency tail.
// Regresses imZ vs 1/sqrt(omega).

export function estimateWarburgA(data: EisDataPoint[], Rs: number): number {
  const N = data.length
  if (N < 2) return 1

  const reZ = data.map(d => d['Re(Z)/Ohm'])
  const freq = data.map(d => d['freq/Hz'])
  const ReMax = Math.max(...reZ)

  const nLow = Math.max(3, Math.min(7, Math.floor(N / 4)))
  const lowPts = data.slice(N - nLow)

  let warburgA = Math.max((ReMax - Rs) * Math.sqrt(2 * Math.PI * (freq[N - 1] ?? 0.01)), 1)

  if (lowPts.length >= 2) {
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0
    for (const d of lowPts) {
      const x = 1 / Math.sqrt(2 * Math.PI * Math.max(d['freq/Hz'], 1e-10))
      const y = d['-Im(Z)/Ohm']
      sumX += x
      sumY += y
      sumXX += x * x
      sumXY += x * y
    }
    const nL = lowPts.length
    const det = nL * sumXX - sumX * sumX
    if (det > 1e-30) {
      const slope = (nL * sumXY - sumX * sumY) / det
      warburgA = Math.max(slope * Math.SQRT2, 1)
    }
  }

  return warburgA
}


// Calculates R from the -Im(Z) peak amplitude and CPE exponent n.
// R = 2 * Im_peak / tan(n * pi / 4)

export function rFromPeak(imPeak: number, n: number): number {
  const t = Math.tan((n * Math.PI) / 4)
  return Math.max((2 * imPeak) / (t > 0 ? t : 1), 1)
}
