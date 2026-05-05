export const MODEL_URL = '/models/eis_classifier_6ch.onnx'

// Lägg denna i samma mapp som .onnx-filen!
export const MODEL_EXTERNAL_DATA = '/models/eis_classifier_6ch.onnx.data';

export const KNOWN_CIRCUITS = [
  "L0-R0",
  "L0-R0-CPE0",
  "L0-R0-p(R1,CPE0)",
  "L0-R0-p(R1,CPE0)-CPE1",
  "L0-R0-p(R1,CPE0)-p(R2,CPE1)",
  "L0-R0-p(R1,CPE0)-p(R2,CPE1)-CPE2",
  "R0",
  "R0-CPE0",
  "R0-p(R1,CPE0)",
  "R0-p(R1,CPE0)-CPE1",
  "R0-p(R1,CPE0)-p(R2,CPE1)",
  "R0-p(R1,CPE0)-p(R2,CPE1)-CPE2",
  "R0-p(R1,CPE0)-p(R2,CPE1)-p(R3,CPE2)"
] as const

export type KnownCircuit = (typeof KNOWN_CIRCUITS)[number]

export const N_POINTS = 60

// UPPDATERAD: Nu med 6 kanaler som matchar din nya worker och PyTorch-modell
export const CHANNEL_DEFS = [
  'Re(Z)',           // ch0
  'Im(Z)',           // ch1
  'log10(freq)',     // ch2
  'dPhase/dlogF',    // ch3 (Fasderivata)
  'Phase (deg)',     // ch4 (Rå fasvinkel - NY!)
  'log10|Z|'         // ch5 (Rå magnitud - NY!)
] as const;
