
// Beräknar residualer i procent av mätvärdets storlek: både real- och imaginärdel. Används för att plotta residualer i Bode-plot.

export function calculateResiduals(
  measRe: number[],
  measIm: number[],
  modRe: number[],
  modIm: number[]
): { re: number[]; im: number[] } {
  const n = measRe.length
  if (n === 0 || n !== measIm.length || n !== modRe.length || n !== modIm.length) {
    return { re: [], im: [] }
  }

  const resRe: number[] = []
  const resIm: number[] = []

  for (let i = 0; i < n; i++) {
    const rMeas = measRe[i]!
    const iMeas = measIm[i]!
    const rMod = modRe[i]!
    const iMod = modIm[i]!

    // Modulus |Z| = sqrt(Re² + Im²)
    const modulus = Math.sqrt(rMeas * rMeas + iMeas * iMeas)
    const norm = modulus > 1e-12 ? modulus : 1e-12

    // procentuella residualer, vägt med mätvärdets storlek för att undvika att små värden dominerar.
    resRe.push(((rMeas - rMod) / norm) * 100)
    resIm.push(((iMeas - iMod) / norm) * 100)
  }

  return { re: resRe, im: resIm }
}
