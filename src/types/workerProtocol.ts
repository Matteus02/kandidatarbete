export interface InferenceRequest {
  type: 'run'
  data: {
    'Re(Z)/Ohm': number
    '-Im(Z)/Ohm': number
    'freq/Hz': number
    'Phase(Z)/deg': number
  }[]
}

export interface PredictionItem {
  circuit: string
  confidence: number
}

export type InferenceResponse =
  | { type: 'result'; predictions: PredictionItem[] }
  | { type: 'error'; message: string }
