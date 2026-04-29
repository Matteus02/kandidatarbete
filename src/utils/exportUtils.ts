/**
 * Modular utilities for exporting EIS data, parameters, and visualizations.
 */

import type { CircuitNode } from '@/components/circuit/CircuitNode'
import type { ModelData } from '@/composables/useCircuitModel'

/**
 * Triggers a browser download of a text file (CSV, TXT, etc.).
 */
export function downloadFile(filename: string, content: string, mimeType: string = 'text/csv') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Formats circuit parameters into a CSV string.
 */
export function exportParametersToCSV(nodes: CircuitNode[], circuitString: string): string {
  const headers = ['Element ID', 'Type', 'Value', 'Unit', 'Locked', 'Min', 'Max']
  const rows = nodes.map(n => {
    // Basic units mapping
    const units: Record<string, string> = { R:'Ohm', C:'F', L:'H', CPE:'Q', W:'W', Wo:'Rw', Ws:'Rw' }
    const mainRow = [
      n.id,
      n.type,
      n.value,
      units[n.type] || '',
      n.locked ? 'Yes' : 'No',
      n.min ?? '',
      n.max ?? ''
    ].join(',')

    // For 2-param elements, add a second row
    if (n.type === 'CPE' || n.type === 'Wo' || n.type === 'Ws') {
      const units2: Record<string, string> = { CPE:'n', Wo:'tau', Ws:'tau' }
      const secRow = [
        n.id,
        `${n.type}_p2`,
        n.value2,
        units2[n.type] || '',
        n.locked2 ? 'Yes' : 'No',
        n.min2 ?? '',
        n.max2 ?? ''
      ].join(',')
      return `${mainRow}\n${secRow}`
    }
    return mainRow
  })

  return `# Circuit Model: ${circuitString}\n${headers.join(',')}\n${rows.join('\n')}`
}

/**
 * Formats model trace (Nyquist/Bode data) into a CSV string.
 */
export function exportModelTraceToCSV(modelData: ModelData, circuitString: string): string {
  const headers = ['Frequency (Hz)', 'Re(Z) (Ohm)', '-Im(Z) (Ohm)', '|Z| (Ohm)', 'Phase (deg)']
  const rows = modelData.freq.map((f, i) => {
    return [
      f,
      modelData.re[i],
      modelData.im[i], // our store already holds -Im(Z) for plotting
      modelData.mag[i],
      modelData.phase[i]
    ].join(',')
  })

  return `# Circuit Model: ${circuitString}\n${headers.join(',')}\n${rows.join('\n')}`
}

/**
 * Captures an SVG element and downloads it as a PNG image.
 */
export async function exportSvgAsPng(svgElement: SVGGraphicsElement, filename: string) {
  // Use viewBox or attributes if getBBox() returns zero (common for hidden elements)
  const bbox = svgElement.getBBox()
  let width = bbox.width
  let height = bbox.height

  if (width === 0 || height === 0) {
    // Fallback to attributes or viewBox
    const attrWidth = parseFloat(svgElement.getAttribute('width') || '0')
    const attrHeight = parseFloat(svgElement.getAttribute('height') || '0')
    if (attrWidth > 0 && attrHeight > 0) {
      width = attrWidth
      height = attrHeight
    } else if (svgElement instanceof SVGSVGElement && svgElement.viewBox.baseVal.width > 0) {
      width = svgElement.viewBox.baseVal.width
      height = svgElement.viewBox.baseVal.height
    } else {
      // Last resort fallback
      width = 800
      height = 400
    }
  }

  // Add padding
  const padding = 40
  const totalWidth = width + padding
  const totalHeight = height + padding

  // Clone SVG to modify it for serialization without affecting UI
  const clonedSvg = svgElement.cloneNode(true) as SVGGraphicsElement
  clonedSvg.setAttribute('width', totalWidth.toString())
  clonedSvg.setAttribute('height', totalHeight.toString())
  
  // Recursively inline computed styles from the original to the clone
  const inlineStyles = (source: Element, target: Element) => {
    const computed = window.getComputedStyle(source)
    const style = (target as HTMLElement | SVGElement).style
    
    // Key properties for circuit diagrams
    const props = [
      'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
      'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'text-anchor'
    ]
    
    for (const prop of props) {
      const val = computed.getPropertyValue(prop)
      if (val) style.setProperty(prop, val)
    }

    // Process children
    for (let i = 0; i < source.children.length; i++) {
      const sourceChild = source.children[i]
      const targetChild = target.children[i]
      if (sourceChild && targetChild) {
        inlineStyles(sourceChild, targetChild)
      }
    }
  }
  
  // Only inline styles if the source is visible (getComputedStyle works best then)
  // If hidden (v-show), computed styles might still work but could be 'none' for some properties.
  inlineStyles(svgElement, clonedSvg)

  // Ensure styles are inline for the serializer
  const svgData = new XMLSerializer().serializeToString(clonedSvg)
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = totalWidth * 2 // High DPI
  canvas.height = totalHeight * 2
  ctx.scale(2, 2)
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  const img = new Image()
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  img.onload = () => {
    // Draw with slight offset for padding
    ctx.drawImage(img, padding / 2, padding / 2)
    URL.revokeObjectURL(url)
    
    const pngUrl = canvas.toDataURL('image/png')
    const downloadLink = document.createElement('a')
    downloadLink.href = pngUrl
    downloadLink.download = `${filename}.png`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }
  img.src = url
}
