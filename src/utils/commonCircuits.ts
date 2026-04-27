export interface CommonCircuit {
  name: string
  circuit: string
  description?: string
}

export const COMMON_CIRCUITS: CommonCircuit[] = [
  {
    name: 'Pure Resistor',
    circuit: 'R0',
    description: 'A single resistor'
  },
  {
    name: 'Pure Capacitor',
    circuit: 'C0',
    description: 'A single capacitor'
  },
  {
    name: 'Resistor in series with Capacitor',
    circuit: 'R0-C0',
    description: 'Series RC circuit'
  },
  {
    name: 'Resistor in parallel with Capacitor',
    circuit: 'p(R0,C0)',
    description: 'Parallel RC circuit'
  },
  {
    name: 'Randles',
    circuit: 'R0-p(R1,CPE0)',
    description: 'Basic Randles circuit'
  },
  {
    name: 'Randles with Warburg',
    circuit: 'R0-p(R1,CPE0)-W0',
    description: 'Randles circuit with semi-infinite Warburg diffusion'
  },
  {
    name: 'Randles with Finite Warburg',
    circuit: 'R0-p(R1,CPE0)-W_finite',
    description: 'Randles circuit with finite-length Warburg diffusion'
  },
  {
    name: 'Two Time Constants',
    circuit: 'R0-p(R1,CPE0)-p(R2,CPE1)',
    description: 'Circuit with two parallel RC/CPE elements in series'
  },
  {
    name: 'Two Time Constants with Warburg',
    circuit: 'R0-p(R1,CPE0)-p(R2,CPE1)-W0',
    description: 'Two time constants with semi-infinite Warburg diffusion'
  },
  {
    name: 'Two Time Constants with Inductor',
    circuit: 'R0-L0-p(R1,CPE0)-p(R2,CPE1)',
    description: 'Two time constants with an additional series inductor'
  }
]
