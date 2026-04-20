//helt ai genererad
// Komplex aritmetik och impedansformler för EIS-kretsmodeller

export type Complex = { re: number; im: number }

// --- Grundläggande komplex aritmetik ---

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}

export function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }
}

export function div(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  }
}

// Parallellkoppling: Z = (Z1 * Z2) / (Z1 + Z2)
export function parallel(a: Complex, b: Complex): Complex {
  return div(mul(a, b), add(a, b))
}

// --- Impedansformler för varje element ---

// Resistor: Z = R
export function zR(R: number): Complex {
  return { re: R, im: 0 }
}

// Kondensator: Z = 1 / (jωC)  →  re=0, im=-1/(ωC)
export function zC(C: number, omega: number): Complex {
  return { re: 0, im: -1 / (omega * C) }
}

// CPE (Constant Phase Element): Z = 1 / (Q * (jω)^n)
// (jω)^n = ω^n * (cos(nπ/2) + j·sin(nπ/2))
export function zCPE(Q: number, n: number, omega: number): Complex {
  const mag = Math.pow(omega, n)
  const angle = (n * Math.PI) / 2
  const denominator: Complex = {
    re: Q * mag * Math.cos(angle),
    im: Q * mag * Math.sin(angle),
  }
  return div({ re: 1, im: 0 }, denominator)
}

// Warburg (semi-infinite diffusion): Z = A / √(jω) = A*(1-j) / √(2ω)
export function zW(A: number, omega: number): Complex {
  const factor = A / Math.sqrt(2 * omega)
  return { re: factor, im: -factor }
}

// --- Parametrar för kretsmodellen ---

export type CircuitParams = {
  R0: number  // Serieresistans (Ω)
  R1: number  // Laddningsöverföringsresistans lager 1 (Ω)
  C0: number  // Kapacitans lager 1 (F)
  Q0: number  // CPE-koefficient lager 1
  n0: number  // CPE-exponent lager 1 (0–1)
  R2: number  // Laddningsöverföringsresistans lager 2 (Ω)
  C1: number  // Kapacitans lager 2 (F)
  Q1: number  // CPE-koefficient lager 2
  n1: number  // CPE-exponent lager 2
  A:  number  // Warburg-koefficient (Ω·s^-0.5)
}

// --- Estimera startvärden från mätdata ---
// Logiken bygger på att läsa av Nyquist-kurvans form:
//   R0      = minsta Re(Z)  → där kurvan skär x-axeln vid hög frekvens
//   R1      = diametern på första halvcirkeln ≈ max(Re(Z)) - R0
//   C0/Q0   = beräknas från toppfrekvensen: vid toppen gäller ω = 1/(R1·C)
//   A       = grov uppskattning från lågfrekvens-svansen

export type EisDataPoint = {
  'freq/Hz': number
  'Re(Z)/Ohm': number
  '-Im(Z)/Ohm': number
}

export function estimateParams(
  data: EisDataPoint[],
  layers: 1 | 2,
): CircuitParams {
  // Sortera på frekvens, högst först
  const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])

  const reZ = sorted.map(d => d['Re(Z)/Ohm'])
  const imZ = sorted.map(d => d['-Im(Z)/Ohm'])
  const freq = sorted.map(d => d['freq/Hz'])

  // R0 = minsta Re(Z) (hög-frekvens skärning)
  const R0 = Math.min(...reZ)

  // Index för max -Im(Z) = toppen av halvcirkeln
  const maxImIdx = imZ.indexOf(Math.max(...imZ))
  const peakFreq = freq[maxImIdx] ?? freq[0] ?? 1 // fallback om data saknas
  const omegaPeak = 2 * Math.PI * peakFreq

  // R1 = diameter på halvcirkeln
  const R1total = Math.max(...reZ) - R0
  const R1 = layers === 1 ? R1total : R1total * 0.6

  // C0 = 1 / (ω_peak · R1)
  const C0 = 1 / (omegaPeak * R1)

  return {
    R0,
    R1,
    C0,
    Q0: C0,       // CPE-koefficient ≈ C som startgissning
    n0: 0.8,      // typiskt värde för n
    R2: R1 * 0.5,
    C1: C0,
    Q1: C0,
    n1: 0.8,
    A: R1 * 0.3,  // grov uppskattning för Warburg
  }
}

// --- Beräkna Z(ω) direkt från CircuitNode-trädet ---
// Importeras av ECMmodule; CircuitNode importeras lazily for avoid circular dep.
// Caller passes the root node; function recurses through series chain + branches.

export function calcZNode(
  node: { type: string; value: number; upperBranch: unknown; lowerBranch: unknown },
  omega: number,
  CPE_N = 0.85,
): Complex {
  switch (node.type) {
    case 'R':  return zR(node.value)
    case 'C':  return zC(node.value, omega)
    case 'CPE': return zCPE(node.value, CPE_N, omega)
    case 'W':  return zW(node.value, omega)
    case 'parallel': {
      const u = node.upperBranch as { type: string; value: number; next: unknown; upperBranch: unknown; lowerBranch: unknown } | null
      const l = node.lowerBranch as { type: string; value: number; next: unknown; upperBranch: unknown; lowerBranch: unknown } | null
      const zu = u ? calcZChain(u, omega, CPE_N) : null
      const zl = l ? calcZChain(l, omega, CPE_N) : null
      if (zu && zl) return parallel(zu, zl)
      return zu ?? zl ?? { re: 0, im: 0 }
    }
    default: return { re: 0, im: 0 }
  }
}

export function calcZChain(
  node: { type: string; value: number; next: unknown; upperBranch: unknown; lowerBranch: unknown } | null,
  omega: number,
  CPE_N = 0.85,
): Complex {
  if (!node || node.type === 'end') return { re: 0, im: 0 }
  const z = calcZNode(node, omega, CPE_N)
  const rest = calcZChain(
    node.next as { type: string; value: number; next: unknown; upperBranch: unknown; lowerBranch: unknown } | null,
    omega,
    CPE_N,
  )
  return add(z, rest)
}

// --- Beräkna Z(ω) för vald kretsmodell ---

export function calcZ(
  omega: number,
  params: CircuitParams,
  layers: 1 | 2,
  elementType: 'C' | 'CPE',
  warburg: boolean,
): Complex {
  // R0 alltid i serie
  let z: Complex = zR(params.R0)

  // Parallellblock 1: R1 || C0 (eller CPE0)
  const zEl0 = elementType === 'C'
    ? zC(params.C0, omega)
    : zCPE(params.Q0, params.n0, omega)
  z = add(z, parallel(zR(params.R1), zEl0))

  // Parallellblock 2 (om 2 lager)
  if (layers === 2) {
    const zEl1 = elementType === 'C'
      ? zC(params.C1, omega)
      : zCPE(params.Q1, params.n1, omega)
    z = add(z, parallel(zR(params.R2), zEl1))
  }

  // Warburg i serie (om vald)
  if (warburg) {
    z = add(z, zW(params.A, omega))
  }

  return z
}
