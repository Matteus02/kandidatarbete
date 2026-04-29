export function calculateChiSquared(
  measRe: number[],
  measIm: number[],
  modRe: number[],
  modIm: number[]
): number {
  const n = measRe.length
  if (n === 0 || n !== measIm.length || n !== modRe.length || n !== modIm.length) {
    return 0
  }

  let sum = 0
  for (let i = 0; i < n; i++) {
    const rMeas = measRe[i]!
    const iMeas = measIm[i]!
    const rMod = modRe[i]!
    const iMod = modIm[i]!

    // Residuals
    const dRe = rMeas - rMod
    const dIm = iMeas - iMod

  
    const weight = rMeas * rMeas + iMeas * iMeas
    const w = weight > 1e-12 ? weight : 1e-12

    sum += (dRe * dRe + dIm * dIm) / w
  }

  // Normalize by number of data points
  return sum / n
}
