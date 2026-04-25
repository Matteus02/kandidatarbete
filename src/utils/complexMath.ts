// Pure complex-number arithmetic.
// A complex number is { re, im } where re is the real part and im is the imaginary part.
// All functions are pure (no side effects) and operate only on this type.

export type Complex = { re: number; im: number }

// Addition: (a + jb) + (c + jd) = (a+c) + j(b+d)
export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

// Multiplication: (a + jb)(c + jd) = (ac - bd) + j(ad + bc)
export function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }
}

// Division: a / b = a · conj(b) / |b|²
export function div(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  }
}

// Square root: √z using polar form √|z| · e^(j·arg(z)/2)
export function csqrt(z: Complex): Complex {
  const r     = Math.sqrt(z.re * z.re + z.im * z.im)
  const theta = Math.atan2(z.im, z.re)
  const sqrtR = Math.sqrt(r)
  return { re: sqrtR * Math.cos(theta / 2), im: sqrtR * Math.sin(theta / 2) }
}

// Complex exponential: e^(a + jb) = e^a · (cos b + j·sin b)
export function cexp(z: Complex): Complex {
  const e = Math.exp(z.re)
  return { re: e * Math.cos(z.im), im: e * Math.sin(z.im) }
}

// Hyperbolic cosine: cosh(z) = (e^z + e^-z) / 2
export function ccosh(z: Complex): Complex {
  const ep = cexp(z)
  const em = cexp({ re: -z.re, im: -z.im })
  return { re: (ep.re + em.re) / 2, im: (ep.im + em.im) / 2 }
}

// Hyperbolic sine: sinh(z) = (e^z - e^-z) / 2
export function csinh(z: Complex): Complex {
  const ep = cexp(z)
  const em = cexp({ re: -z.re, im: -z.im })
  return { re: (ep.re - em.re) / 2, im: (ep.im - em.im) / 2 }
}

// Magnitude: |z| = sqrt(re² + im²)
export function abs(z: Complex): number {
  return Math.sqrt(z.re * z.re + z.im * z.im)
}
