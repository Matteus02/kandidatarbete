/// <reference lib="webworker" />

import * as ort from 'onnxruntime-web'
import { MODEL_URL, MODEL_EXTERNAL_DATA, KNOWN_CIRCUITS, N_POINTS } from '@/ai/modelConfig'
import type { InferenceRequest, InferenceResponse, PredictionItem } from '@/ai/workerProtocol'

// Point to static copies in public/ort/ so Vite doesn't transform the .mjs files
ort.env.wasm.wasmPaths = '/ort/'

// ─── Signal processing helpers ────────────────────────────────────────────────

function linspace(start: number, stop: number, num: number): number[] {
  const arr = new Array<number>(num)
  const step = (stop - start) / (num - 1)
  for (let i = 0; i < num; i++) arr[i] = start + i * step
  return arr
}

// Mirrors np.unwrap: keeps successive phase differences within [-π, π]
function unwrapPhase(angles: number[]): number[] {
  const out = [...angles]
  for (let i = 1; i < out.length; i++) {
    const delta = out[i]! - out[i - 1]!
    out[i] = out[i - 1]! + (delta - 2 * Math.PI * Math.round(delta / (2 * Math.PI)))
  }
  return out
}

// Mirrors np.gradient with explicit x coordinates (central diffs, one-sided at edges)
function gradient(y: number[], x: number[]): number[] {
  const n = y.length
  const g = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      g[i] = (y[1]! - y[0]!) / (x[1]! - x[0]!)
    } else if (i === n - 1) {
      g[i] = (y[n - 1]! - y[n - 2]!) / (x[n - 1]! - x[n - 2]!)
    } else {
      g[i] = (y[i + 1]! - y[i - 1]!) / (x[i + 1]! - x[i - 1]!)
    }
  }
  return g
}

// Linear interpolation matching scipy interp1d(bounds_error=False, fill_value=0.0).
// xKnown may be in any monotonic order; xQuery values outside range return 0.
function interp1d(xKnown: number[], yKnown: number[], xQuery: number[]): number[] {
  const n = xKnown.length
  const ascending = xKnown[0]! < xKnown[n - 1]!
  return xQuery.map((xq) => {
    const xLo = ascending ? xKnown[0]! : xKnown[n - 1]!
    const xHi = ascending ? xKnown[n - 1]! : xKnown[0]!
    if (xq < xLo || xq > xHi) return 0.0

    for (let i = 0; i < n - 1; i++) {
      const x0 = xKnown[i]!
      const x1 = xKnown[i + 1]!
      const inSegment = ascending ? xq >= x0 && xq <= x1 : xq <= x0 && xq >= x1
      if (inSegment) {
        const t = (xq - x0) / (x1 - x0)
        return yKnown[i]! + t * (yKnown[i + 1]! - yKnown[i]!)
      }
    }
    return 0.0
  })
}

// ─── Tensor construction ──────────────────────────────────────────────────────

function buildTensor(data: InferenceRequest['data']): ort.Tensor {
  // Sort high → low frequency, matching training data layout
  const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])

  const rawLogFreq = sorted.map((d) => Math.log10(d['freq/Hz']))
  const rawReZ = sorted.map((d) => d['Re(Z)/Ohm'])
  // Training uses Z.imag (can be negative); file stores -Im(Z), so negate it
  const rawImZ = sorted.map((d) => -d['-Im(Z)/Ohm'])

  // Phase derivative: d(unwrapped_phase_deg) / d(log10(f))
  const angles = rawReZ.map((re, i) => Math.atan2(rawImZ[i]!, re))
  const phaseDeg = unwrapPhase(angles).map((a) => a * (180 / Math.PI))
  const rawPhaseDeriv = gradient(phaseDeg, rawLogFreq)

  // 60-point log-spaced grid spanning the actual measurement window
  const logFmax = rawLogFreq[0]!
  const logFmin = rawLogFreq[rawLogFreq.length - 1]!
  const logFixed = linspace(logFmax, logFmin, N_POINTS)

  // Interpolate channels 0, 1, 3; channel 2 is logFixed itself
  const channels = [
    interp1d(rawLogFreq, rawReZ, logFixed),
    interp1d(rawLogFreq, rawImZ, logFixed),
    logFixed,
    interp1d(rawLogFreq, rawPhaseDeriv, logFixed),
  ]

  const buffer = new Float32Array(4 * N_POINTS)

  for (let ch = 0; ch < 4; ch++) {
    const vals = channels[ch]!
    const offset = ch * N_POINTS

    for (let i = 0; i < N_POINTS; i++) buffer[offset + i] = vals[i]!

    // Per-sample, per-channel normalization: (x - mean) / (std + 1e-8)
    let sum = 0
    for (let i = 0; i < N_POINTS; i++) sum += buffer[offset + i]!
    const mean = sum / N_POINTS

    let sqSum = 0
    for (let i = 0; i < N_POINTS; i++) {
      const d = buffer[offset + i]! - mean
      sqSum += d * d
    }
    const std = Math.sqrt(sqSum / N_POINTS)

    for (let i = 0; i < N_POINTS; i++) {
      buffer[offset + i] = (buffer[offset + i]! - mean) / (std + 1e-8)
    }
  }

  return new ort.Tensor('float32', buffer, [1, 4, N_POINTS])
}

// ─── Softmax ──────────────────────────────────────────────────────────────────

function softmax(logits: Float32Array): number[] {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i]
    if (v !== undefined && v > max) max = v
  }
  const exps = Array.from(logits).map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((v) => v / sum)
}

// ─── Session management ───────────────────────────────────────────────────────

async function buildSessionOptions(): Promise<ort.InferenceSession.SessionOptions> {
  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] }
  if (MODEL_EXTERNAL_DATA) {
    const buf = await fetch(MODEL_EXTERNAL_DATA).then((r) => r.arrayBuffer())
    const filename = MODEL_EXTERNAL_DATA.split('/').pop()!
    opts.externalData = [{ path: filename, data: buf }]
  }
  return opts
}

let sessionPromise: Promise<ort.InferenceSession> | null = null

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = buildSessionOptions().then((opts) =>
      ort.InferenceSession.create(MODEL_URL, opts),
    )
  }
  return sessionPromise
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<InferenceRequest>) => {
  if (event.data.type !== 'run') return

  try {
    const session = await getSession()
    const tensor = buildTensor(event.data.data)

    const inputName = session.inputNames[0]!
    const feeds: Record<string, ort.Tensor> = { [inputName]: tensor }
    const results = await session.run(feeds)

    const outputName = session.outputNames[0]!
    const logits = results[outputName]!.data as Float32Array
    const probs = softmax(logits)

    const predictions: PredictionItem[] = probs
      .map((confidence, i) => ({
        circuit: (KNOWN_CIRCUITS[i] ?? '') as string,
        confidence,
      }))
      .sort((a, b) => b.confidence - a.confidence)

    const response: InferenceResponse = { type: 'result', predictions }
    self.postMessage(response)
  } catch (err) {
    const response: InferenceResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(response)
  }
}
