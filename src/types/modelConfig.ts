export const MODEL_URL = '/models/eis_classifier_6ch.onnx'
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

export const N_POINTS = 60
