export const MODEL_URL = '/models/eis_classifier_cnn_lstm.onnx' // Uppdatera namnet vid behov

// Path to the external weights file produced by the ONNX exporter.
// Set to null if your model is a single self-contained .onnx file.
export const MODEL_EXTERNAL_DATA: string | null = null // Ofta null för modeller < 2GB, om du inte exporterat med external data

// VIKTIGT: Uppdaterad för att exakt matcha de 6 klasserna i PyTorch-modellen.
export const KNOWN_CIRCUITS = [
  'R0-p(R1,CPE0)',
  'R0-p(R1,CPE0)-W0',
  'R0-p(R1,CPE0)-W_finite',     // Detta ersätter tidigare separata Wo0 och Ws0
  'R0-p(R1,CPE0)-p(R2,CPE1)',
  'R0-p(R1,CPE0)-p(R2,CPE1)-W0',
  'R0-L0-p(R1,CPE0)-p(R2,CPE1)',
] as const

export type KnownCircuit = (typeof KNOWN_CIRCUITS)[number]

// Fixed sequence length the model was trained on.
// Training always interpolates to exactly this many log-spaced points.
export const N_POINTS = 60

// Channel layout (for documentation — preprocessing is in the worker):
//   ch0: Re(Z)/Ohm            — normalized per sample
//   ch1: Im(Z)                — normalized per sample
//   ch2: log10(freq)          — the logFixed grid, normalized per sample
//   ch3: d(phase_deg)/d(log10f) — phase derivative, normalized per sample
//   ch4: d(log10|Z|)/d(log10f)  — bode magnitude slope, normalized per sample
export const CHANNEL_DEFS = [
  'Re(Z)',
  'Im(Z)',
  'log10(freq)',
  'dPhase/dlogF',
  'dLog|Z|/dlogF' // <-- Den nya 5:e kanalen för Bode-lutningen (bode_slope)
] as const

// Circuits that CircuitPanel cannot represent with its current controls
export const UNSUPPORTED_CIRCUITS = new Set<KnownCircuit>([
  'R0-p(R1,CPE0)-W_finite',      // Uppdaterad referens
  'R0-L0-p(R1,CPE0)-p(R2,CPE1)',
])
