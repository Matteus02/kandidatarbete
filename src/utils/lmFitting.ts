
import { levenbergMarquardt } from 'ml-levenberg-marquardt'
import { type Complex, abs } from './complexMath'


export type CircuitModelFn = (params: number[], omegas: number[]) => Complex[]

export interface FitCircuitOptions {
  frequencies: number[]
  zReal: number[]
  zImag: number[]
  modelFn: CircuitModelFn
  initialParams: number[]
  minValues?: number[]
  maxValues?: number[]
}

export interface FitCircuitResult {
  params: number[]
  paramErrors: number[] 
  fittedZ: Complex[]
  chiSquared: number
  iterations: number
}


export function flattenComplex(zArray: Complex[]): number[] {
  const n = zArray.length
  const flat = Array.from<number>({ length: 2 * n })
  for (let i = 0; i < n; i++) {
    const z = zArray[i]!
    flat[i] = z.re
    flat[i + n] = -z.im
  }
  return flat
}

// Inverse of flattenComplex: re-applies the sign convention on the imaginary half.
export function unflattenComplex(flat: number[]): Complex[] {
  const n = Math.floor(flat.length / 2)
  return Array.from({ length: n }, (_, i) => ({
    re: flat[i] ?? 0,
    im: -(flat[i + n] ?? 0),
  }))
}

// Factory that wraps a CircuitModelFn for use with the LM optimizer.
//
// Returns a ParameterizedFunction (the curried form required by ml-levenberg-marquardt):
//   (logParams) => (xIndex) => weightedPrediction
//
// The model is computed once per (logParams) call. The returned closure serves
// individual data-point predictions without recomputing the model, giving O(1)
// lookups after the single O(n) model evaluation per LM step.
//
// weights[i] = |Z_measured_i| for modulus weighting: dividing both data and model
// by |Z| means the optimizer minimises relative errors, balancing contributions
// from low- and high-impedance frequency ranges.
export function createFlatteningWrapper(
  modelFn: CircuitModelFn,
  omegas: number[],
  weights: number[],
  minValues: number[],
  maxValues: number[],
) {
  const n = omegas.length
  return (logParams: number[]) => {
    const params = logParams.map((lp, i) => {
      const p = Math.exp(lp)
      const min = minValues[i] ?? 1e-20
      const max = maxValues[i] ?? 1e20
      return Math.min(Math.max(p, min), max)
    })
    const complexZ = modelFn(params, omegas)
    const flat = flattenComplex(complexZ)
    return (xIndex: number): number => {
      const v = flat[xIndex] ?? 0
      const w = weights[xIndex % n] ?? 1e-10
      if (!isFinite(v)) return 0
      return v / w
    }
  }
}

// Per-parameter standard errors via diagonal covariance approximation.
// Computes the Jacobian numerically using central differences in log-parameter space,
// then estimates σ²_i ≈ chiSquared / (n_data - n_params) / J[:,i]·J[:,i].
// Converts from log-space to linear-space: σ_linear ≈ param * σ_log.
function computeParamErrors(
  logParams: number[],
  wrappedFn: ReturnType<typeof createFlatteningWrapper>,
  nData: number,
  chiSquared: number,
  linearParams: number[],
): number[] {
  const p = logParams.length
  const h = 1e-4
  const sigma2 = chiSquared / Math.max(nData - p, 1)

  return logParams.map((lp, j) => {
    const fwd = [...logParams]
    const bwd = [...logParams]
    fwd[j] = lp + h
    bwd[j] = lp - h
    const evalFwd = wrappedFn(fwd)
    const evalBwd = wrappedFn(bwd)
    let jtj_jj = 0
    for (let i = 0; i < nData; i++) {
      const dj = (evalFwd(i) - evalBwd(i)) / (2 * h)
      jtj_jj += dj * dj
    }
    const sigmaLog = Math.sqrt(sigma2 / Math.max(jtj_jj, 1e-30))
    return (linearParams[j] ?? 0) * sigmaLog
  })
}

// Fit circuit model parameters to experimental EIS data using Levenberg-Marquardt.
export function fitCircuit(options: FitCircuitOptions): FitCircuitResult {
  const { frequencies, zReal, zImag, modelFn, initialParams } = options
  const n = frequencies.length

  const omegas = frequencies.map(f => 2 * Math.PI * f)

  const weights = Array.from({ length: n }, (_, i) =>
    Math.max(abs({ re: zReal[i] ?? 0, im: zImag[i] ?? 0 }), 1e-10),
  )

  const yFlat = [...zReal, ...zImag]
  const yData = yFlat.map((v, i) => v / (weights[i % n] ?? 1e-10))
  const xIndices = Array.from({ length: 2 * n }, (_, i) => i)

  const logInitial = initialParams.map(p => Math.log(Math.max(p, 1e-20)))
  const logMin = (options.minValues ?? initialParams.map(() => 1e-20)).map(v =>
    Math.log(Math.max(v, 1e-20)),
  )
  const logMax = (options.maxValues ?? initialParams.map(() => 1e20)).map(v =>
    Math.log(Math.max(v, 1e-20)),
  )

  const wrappedFn = createFlatteningWrapper(
    modelFn,
    omegas,
    weights,
    options.minValues ?? initialParams.map(() => 1e-20),
    options.maxValues ?? initialParams.map(() => 1e20),
  )

  let result
  let attempts = 0
  let currentLogInitial = [...logInitial]

  while (attempts < 3) {
    try {
      result = levenbergMarquardt({ x: xIndices, y: yData }, wrappedFn, {
        initialValues: currentLogInitial,
        minValues: logMin,
        maxValues: logMax,
        damping: 10.0 * Math.pow(10, attempts),
        dampingStepDown: 9,
        dampingStepUp: 11,
        maxIterations: 1000,
        errorTolerance: 1e-8,
        centralDifference: true,
      })
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('LU matrix is singular')) {
        if (attempts < 2) {
          attempts++
          // Add small random noise (jitter) to escape the flat/singular region
          currentLogInitial = currentLogInitial.map((v) => v + (Math.random() - 0.5) * 0.1)
          continue
        } else {
          throw new Error(
            'Fitting failed after multiple attempts: The parameter space is too flat or parameters are linearly dependent. Try locking some parameters or providing better initial guesses.',
          )
        }
      }
      throw err
    }
  }

  if (!result) {
    throw new Error('Fitting failed: The optimizer could not find a valid solution.')
  }

  const fittedLogParams = result.parameterValues
  const fittedParams = fittedLogParams.map(Math.exp)

  const paramErrors = computeParamErrors(
    fittedLogParams,
    wrappedFn,
    2 * n,
    result.parameterError,
    fittedParams,
  )

  const fittedZ = modelFn(fittedParams, omegas)

  return {
    params: fittedParams,
    paramErrors,
    fittedZ,
    chiSquared: result.parameterError,
    iterations: result.iterations,
  }
}
