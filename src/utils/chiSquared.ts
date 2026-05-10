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

    // Beräknar im och re residualer och väger dem med mätvärdets storlek för att undvika att små värden dominerar.
    const dRe = rMeas - rMod
    const dIm = iMeas - iMod


    const weight = rMeas * rMeas + iMeas * iMeas
    const w = weight > 1e-12 ? weight : 1e-12

    sum += (dRe * dRe + dIm * dIm) / w
  }

  // Normalisera med antal punkter.
  return sum / n
}
