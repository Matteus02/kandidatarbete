/// <reference lib="webworker" />

import * as ort from 'onnxruntime-web'
import { MODEL_URL, MODEL_EXTERNAL_DATA, KNOWN_CIRCUITS, N_POINTS } from '@/types/modelConfig'
import type { InferenceRequest, InferenceResponse, PredictionItem } from '@/types/workerProtocol'

// Point to static copies in public/ort/ so Vite doesn't transform the .mjs files
ort.env.wasm.wasmPaths = '/ort/'

// ─── Signal processing helpers ────────────────────────────────────────────────

function linspace(start: number, stop: number, num: number): number[] {
  const arr = Array.from<number>({ length: num })
  const step = (stop - start) / (num - 1)
  for (let i = 0; i < num; i++) arr[i] = start + i * step
  return arr
}

function unwrapPhase(angles: number[]): number[] {
  const out = [...angles]
  for (let i = 1; i < out.length; i++) {
    const delta = out[i]! - out[i - 1]!
    out[i] = out[i - 1]! + (delta - 2 * Math.PI * Math.round(delta / (2 * Math.PI)))
  }
  return out
}

function gradient(y: number[], x: number[]): number[] {
  const n = y.length
  const g = Array.from<number>({ length: n })
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

function interp1d(xKnown: number[], yKnown: number[], xQuery: number[]): number[] {
  const n = xKnown.length;

  return xQuery.map((xq) => {
    // 1. Om vi är utanför gränserna, använd närmaste kantvärde istället för 0.0!
    const maxX = Math.max(...xKnown);
    const minX = Math.min(...xKnown);

    if (xq >= maxX) return yKnown[xKnown.indexOf(maxX)]!;
    if (xq <= minX) return yKnown[xKnown.indexOf(minX)]!;

    // 2. Leta efter rätt intervall
    let i = 0;
    while (i < n - 1) {
      const x0 = xKnown[i]!;
      const x1 = xKnown[i + 1]!;

      // Kollar om xq ligger mellan x0 och x1 (oavsett om x-axeln är stigande eller fallande)
      if ((x0 >= xq && x1 <= xq) || (x0 <= xq && x1 >= xq)) {
        if (x1 === x0) return yKnown[i]!; // Undvik division med noll
        const t = (xq - x0) / (x1 - x0);
        return yKnown[i]! + t * (yKnown[i + 1]! - yKnown[i]!);
      }
      i++;
    }

    // Fallback till sista värdet
    return yKnown[n - 1]!;
  });
}

// ─── Tensor construction ──────────────────────────────────────────────────────

function buildTensor(data: InferenceRequest['data']): ort.Tensor {
  // Sort high → low frequency, matching training data layout
  const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])

  const rawLogFreq = sorted.map((d) => Math.log10(d['freq/Hz']))
  const rawReZ = sorted.map((d) => d['Re(Z)/Ohm'])

  // [UPPDATERING] Gör Imaginärdelen negativ igen för att math-logiken ska bli rätt
  const rawImZ = sorted.map((d) => -d['-Im(Z)/Ohm'])

  // [UPPDATERING] Beräkna fasen och dess derivata
  const angles = rawReZ.map((re, i) => Math.atan2(rawImZ[i]!, re))
  const rawPhaseDeg = unwrapPhase(angles).map((a) => a * (180 / Math.PI))
  const rawPhaseDeriv = gradient(rawPhaseDeg, rawLogFreq)

  // [UPPDATERING] Beräkna Bode magnitud (absolutbeloppet) istället för Slope
  const rawLogMag = rawReZ.map((re, i) => {
    const im = rawImZ[i]!
    const mag = Math.sqrt(re * re + im * im)
    return Math.log10(mag + 1e-12)
  })

  // 60-point log-spaced grid spanning the actual measurement window
  const logFmax = rawLogFreq[0]!
  const logFmin = rawLogFreq[rawLogFreq.length - 1]!
  const logFixed = linspace(logFmax, logFmin, N_POINTS)

  // [UPPDATERING] Packa de 6 kanalerna exakt i den ordning modellen förväntar sig
  // Re, Im, f, Phase_d, Phase, Mag
  const channels = [
    interp1d(rawLogFreq, rawReZ, logFixed),
    interp1d(rawLogFreq, rawImZ, logFixed),
    logFixed, // Frekvens-axeln i sig självt interpoleras inte
    interp1d(rawLogFreq, rawPhaseDeriv, logFixed),
    interp1d(rawLogFreq, rawPhaseDeg, logFixed),
    interp1d(rawLogFreq, rawLogMag, logFixed)
  ]

  // [UPPDATERING] Buffer-storlek uppdaterad för 6 kanaler
  const buffer = new Float32Array(6 * N_POINTS)

  // [UPPDATERING] Loopa över de 6 kanalerna
  for (let ch = 0; ch < 6; ch++) {
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

  // [UPPDATERING] Dimensionerna uppdaterade till [1, 6, N_POINTS]
  return new ort.Tensor('float32', buffer, [1, 6, N_POINTS])
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
