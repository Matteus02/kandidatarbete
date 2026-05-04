export interface CommonCircuit {
  name: string
  circuit: string
  description?: string
}

export const COMMON_CIRCUITS: CommonCircuit[] = [
  {
    name: 'R1+Q2/R2',
    circuit: 'R0-p(CPE0,R1)',
    description: 'R in series with (Q parallel R)'
  },
  {
    name: 'R1+Q2/R2+Q3',
    circuit: 'R0-p(CPE0,R1)-CPE1',
    description: 'R in series with (Q parallel R) in series with Q'
  },
  {
    name: 'R1+Q2/R2+Q3/R3+Q4',
    circuit: 'R0-p(CPE0,R1)-p(CPE1,R2)-CPE2',
    description: 'R in series with two (Q parallel R) elements in series with Q'
  },
  {
    name: 'R1+Q2/R2+W3',
    circuit: 'R0-p(CPE0,R1)-W0',
    description: 'R in series with (Q parallel R) in series with Warburg'
  },
  {
    name: 'R1+C2/R2+C3/R3',
    circuit: 'R0-p(C0,R1)-p(C1,R2)',
    description: 'R in series with two (C parallel R) elements'
  },
  {
    name: 'R1+C2/R2+C3/R3+W4',
    circuit: 'R0-p(C0,R1)-p(C1,R2)-W0',
    description: 'R in series with two (C parallel R) elements in series with Warburg'
  },
  {
    name: 'R1+C2/R2+Q3/R3',
    circuit: 'R0-p(C0,R1)-p(CPE0,R2)',
    description: 'R in series with (C parallel R) in series with (Q parallel R)'
  },
  {
    name: 'R1+Q2/(R2+Q2)',
    circuit: 'R0-p(CPE0,R1-CPE1)',
    description: 'R in series with Q parallel (R in series with Q)'
  },
  {
    name: 'R1+Q2/(R2+Q2)+Q3',
    circuit: 'R0-p(CPE0,R1-CPE1)-CPE2',
    description: 'R in series with Q parallel (R in series with Q) in series with Q'
  },
  {
    name: 'R1+C2/(R2+W2)',
    circuit: 'R0-p(C0,R1-W0)',
    description: 'R in series with C parallel (R in series with Warburg)'
  },
  {
    name: 'R1+C2/R2+C3/(R3+W3)',
    circuit: 'R0-p(C0,R1)-p(C1,R2-W0)',
    description: 'R in series with (C parallel R) in series with C parallel (R in series with Warburg)'
  },
  {
    name: 'R1+Q1/(R2+W2)+Q3/R3',
    circuit: 'R0-p(CPE0,R1-W0)-p(CPE1,R2)',
    description: 'R in series with Q parallel (R in series with Warburg) in series with (Q parallel R)'
  }
]
