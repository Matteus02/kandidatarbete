// Impedance formulas for each circuit element type.
// Complex arithmetic is provided by complexMath.ts.

import { type Complex, add, mul, div, csqrt, ccosh, csinh } from '@/utils/complexMath'

// Re-export so callers only need to import from this one file
export type { Complex }
export { add, mul, div }

// ── Parallel combination ────────────────────────────────────────────────────

// Z_parallel = (Z1 · Z2) / (Z1 + Z2)
export function parallel(a: Complex, b: Complex): Complex {
  return div(mul(a, b), add(a, b))
}

// ── Element impedance formulas ──────────────────────────────────────────────

// Resistor: Z = R  (purely real, frequency-independent)
export function zR(R: number): Complex {
  return { re: R, im: 0 }
}

// Capacitor: Z = 1 / (jωC)  →  no real part, imaginary part = −1/(ωC)
export function zC(C: number, omega: number): Complex {
  return { re: 0, im: -1 / (omega * C) }
}

// Constant Phase Element: Z = 1 / (Q · (jω)^n)
// The CPE reduces to a capacitor when n = 1 and a resistor when n = 0.
// (jω)^n = ω^n · (cos(nπ/2) + j·sin(nπ/2))
export function zCPE(Q: number, n: number, omega: number): Complex {
  const mag   = Math.pow(omega, n)
  const angle = (n * Math.PI) / 2
  const denom: Complex = { re: Q * mag * Math.cos(angle), im: Q * mag * Math.sin(angle) }
  return div({ re: 1, im: 0 }, denom)
}

// Warburg (semi-infinite diffusion): Z = A · (1 − j) / √(2ω)
// Equal real and imaginary parts — the characteristic 45° line on the Nyquist plot.
export function zW(A: number, omega: number): Complex {
  const factor = A / Math.sqrt(2 * omega)
  return { re: factor, im: -factor }
}

// Inductor: Z = jωL  (purely imaginary, increases with frequency)
export function zL(L: number, omega: number): Complex {
  return { re: 0, im: omega * L }
}

// Warburg Open (finite-length, reflective boundary):
// Z = Rw · coth(√(jωτ)) / √(jωτ)
export function zWo(Rw: number, tau: number, omega: number): Complex {
  const jot: Complex = { re: 0, im: omega * tau }
  const sqrtJot = csqrt(jot)

  // Asymptotic approximation for large arguments to avoid Infinity/Infinity = NaN
  if (sqrtJot.re > 20) {
    return div({ re: Rw, im: 0 }, sqrtJot)
  }

  const coth = div(ccosh(sqrtJot), csinh(sqrtJot))
  return div(mul({ re: Rw, im: 0 }, coth), sqrtJot)
}

// Warburg Short (finite-length, transmissive boundary):
// Z = Rw · tanh(√(jωτ)) / √(jωτ)
export function zWs(Rw: number, tau: number, omega: number): Complex {
  const jot: Complex = { re: 0, im: omega * tau }
  const sqrtJot = csqrt(jot)

  // Asymptotic approximation for large arguments to avoid NaN
  if (sqrtJot.re > 20) {
    return div({ re: Rw, im: 0 }, sqrtJot)
  }

  const tanh = div(csinh(sqrtJot), ccosh(sqrtJot))
  return div(mul({ re: Rw, im: 0 }, tanh), sqrtJot)
}
