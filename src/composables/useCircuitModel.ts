import { computed, type Ref } from 'vue'
import type { CircuitNode } from '@/utils/CircuitNode'
import { zOfChain } from '@/utils/circuitImpedance'

export interface ModelData {
  re: number[]
  im: number[]
  mag: number[]
  phase: number[]
  freq: number[]
}

export function useCircuitModel(rootNode: Ref<CircuitNode>, frequencies: Ref<number[]>, trigger?: Ref<number>) {
  const modelData = computed<ModelData | null>(() => {
    if (!rootNode.value || frequencies.value.length === 0) return null

    // We reference trigger.value if it exists to ensure the computed re-runs
    // when the trigger (renderVersion) is incremented.
    if (trigger) void trigger.value

    const re: number[] = []
    const im: number[] = []
    const mag: number[] = []
    const phase: number[] = []
    const freq: number[] = frequencies.value

    for (const f of freq) {
      const omega = 2 * Math.PI * f
      const z = zOfChain(rootNode.value, omega)
      
      re.push(z.re)
      im.push(-z.im) // In EIS we often plot -Im(Z)
      mag.push(Math.sqrt(z.re * z.re + z.im * z.im))
      phase.push((Math.atan2(-z.im, z.re) * 180) / Math.PI)
    }

    return { re, im, mag, phase, freq }
  })

  return {
    modelData
  }
}
