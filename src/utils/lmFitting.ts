// Levenberg-Marquardt parameter fitting engine for EIS equivalent circuit models.
//
// Sign convention: zImag is -Im(Z) (EIS convention, positive for capacitive circuits),
// matching what the Pinia store exposes. flattenComplex negates the imaginary half so
// the residual is simply y_measured - y_model with no extra sign manipulation in callers.
//
// All parameters are optimised in log-space so that values spanning many decades
// (e.g. R=100 Ω and C=1e-6 F) have equal influence on the optimizer step size.

import { levenbergMarquardt } from 'ml-levenberg-marquardt'
import { type Complex, abs } from './complexMath'

// A circuit model function: receives linear-space params and angular frequencies (rad/s),
// returns the complex impedance at each frequency.
export type CircuitModelFn = (params: number[], omegas: number[]) => Complex[]

export interface FitCircuitOptions {
  frequencies: number[]   // Hz — length n
  zReal: number[]         // Re(Z) — length n
  zImag: number[]         // -Im(Z), EIS convention (positive for capacitive) — length n
  modelFn: CircuitModelFn
  initialParams: number[] // linear-space starting guesses
  minValues?: number[]    // linear-space lower bounds (default 1e-20 per param)
  maxValues?: number[]    // linear-space upper bounds (default 1e20 per param)
}

export interface FitCircuitResult {
  params: number[]      // fitted values, linear space
  paramErrors: number[] // per-parameter standard errors, linear space
  fittedZ: Complex[]    // model Z at each frequency using fitted params
  chiSquared: number    // sum of weighted squared residuals
  iterations: number
}

// Flatten n complex impedances into [Re_1,...,Re_n, -Im_1,...,-Im_n].
// The imaginary half is negated to match EIS convention (-Im(Z) > 0 for capacitive circuits).
export function flattenComplex(zArray: Complex[]): number[] {
  const n = zArray.length
  const flat = Array.from<number>({ length: 2 * n })
  for (let i = 0; i < n; i++) {
    const z = zArray[i]!  // i < n, always defined
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
) {
  const n = omegas.length
  return (logParams: number[]) => {
    const params = logParams.map(lp => Math.min(Math.max(Math.exp(lp), 1e-20), 1e20))
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

  const wrappedFn = createFlatteningWrapper(modelFn, omegas, weights)

  const result = levenbergMarquardt({ x: xIndices, y: yData }, wrappedFn, {
    initialValues: logInitial,
    minValues: logMin,
    maxValues: logMax,
    damping: 1.5,
    dampingStepDown: 9,
    dampingStepUp: 11,
    maxIterations: 1000,
    errorTolerance: 1e-8,
    centralDifference: true,
  })

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
