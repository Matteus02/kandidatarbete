import * as Papa from 'papaparse'
import type { EisDataPoint } from '@/types/eis'

export function parseEisCsv(csvText: string): EisDataPoint[] {
  // 1. Normalize line endings and clean up
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return []

  // 2. Detect delimiter (comma, semicolon, tab or space)
  const sample = lines.slice(0, 20).join('\n')
  let delimiter = ','
  if (sample.includes(';')) delimiter = ';'
  else if (sample.includes('\t')) delimiter = '\t'
  else if (sample.includes(' ') && !sample.includes(',')) delimiter = ' '

  // 3. Find the header row
  let headerIndex = -1
  const possibleHeaders = ['freq', 'z\'', 're(z)', 'z"', 'im(z)', 'real', 'imag', 'ohm', 'hz']

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i]
    if (!line) continue
    const lowerLine = line.toLowerCase()
    const matchCount = possibleHeaders.filter(h => lowerLine.includes(h)).length
    // If we find at least 2 common headers, it's likely the header row
    if (matchCount >= 2) {
      headerIndex = i
      break
    }
  }

  // Helper to parse numbers robustly
  const parseNum = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return NaN
    if (typeof val === 'number') return val
    // Remove spaces (common in thousands separators) and replace comma with dot
    const clean = String(val).replace(/\s/g, '').replace(',', '.')
    const parsed = parseFloat(clean)
    return isNaN(parsed) ? NaN : parsed
  }

  let results: Papa.ParseResult<Record<string, string | number>>
  // Tracks whether the imaginary column already represents -Im(Z) (positive for capacitive).
  // Set inside transformHeader based on the original column name, then used in the row mapper.
  let imaginaryAlreadyNegated = true
  let phaseIsNegated = false

  if (headerIndex !== -1) {
    const cleanCsvText = lines.slice(headerIndex).join('\n')
    results = Papa.parse<Record<string, string | number>>(cleanCsvText, {
      header: true,
      delimiter: delimiter,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => {
        const h = header.toLowerCase().trim()
        if (h.includes('freq') || h === 'f' || h.includes('(hz)')) return 'freq/Hz'
        // Headers that already represent -Im(Z) (z'', z", -im...): sign is correct as-is
        if (h.includes("z''") || h.includes('z"') || h.startsWith('-im') || h.includes('-im(z)')) {
          imaginaryAlreadyNegated = true
          return '-Im(Z)/Ohm'
        }
        // Headers that represent Im(Z) without negation: values will be negative for capacitive → flip
        if (h.includes('im(z)') || h.includes('z2') || h.includes('imag')) {
          imaginaryAlreadyNegated = false
          return '-Im(Z)/Ohm'
        }
        if (h.includes('z\'') || h.includes('re(z)') || h.includes('z1') || h.includes('real')) return 'Re(Z)/Ohm'
        if (h.includes('|z|') || h.includes('mag')) return '|Z|/Ohm'
        if (h.includes('phase')) {
          if (h.includes('neg')) phaseIsNegated = true
          return 'Phase(Z)/deg'
        }
        return header
      }
    })
  } else {
    // FALLBACK: If no header found, parse as raw data and try to guess columns
    const rawResults = Papa.parse<string[]>(lines.join('\n'), {
      header: false,
      delimiter: delimiter,
      skipEmptyLines: 'greedy'
    })

    // Try to find the first row that looks like data
    const dataRows = rawResults.data
    const firstDataRowIdx = dataRows.findIndex(row =>
      row && row.filter(cell => !isNaN(parseNum(cell))).length >= 3
    )

    if (firstDataRowIdx === -1) return []

    // Guess column indices (Frekvens är oftast kolumn 0, Re kolumn 1, Im kolumn 2)
    const processed: EisDataPoint[] = []
    for (let i = firstDataRowIdx; i < dataRows.length; i++) {
      const row = dataRows[i]
      if (!row) continue
      const nums = row.map(parseNum).filter(n => !isNaN(n))
      if (nums.length < 3) continue

      const freq = parseNum(row[0])
      const re = parseNum(row[1])
      let im = parseNum(row[2])

      if (isNaN(freq) || isNaN(re) || isNaN(im)) continue

      if (im < 0) im = -im

      processed.push({
        'freq/Hz': freq,
        'Re(Z)/Ohm': re,
        '-Im(Z)/Ohm': im,
        '|Z|/Ohm': Math.sqrt(re*re + im*im),
        'Phase(Z)/deg': Math.atan2(im, re) * (180 / Math.PI)
      })
    }
    return processed
  }

  const rawData = results.data
  const processedData: EisDataPoint[] = rawData
    .map((row) => {
      if (!row) return null
      const freq = parseNum(row['freq/Hz'])
      const re = parseNum(row['Re(Z)/Ohm'])
      let im = parseNum(row['-Im(Z)/Ohm'])
      let mag = parseNum(row['|Z|/Ohm'])
      let phase = parseNum(row['Phase(Z)/deg'])

      if (isNaN(freq) || isNaN(re) || isNaN(im)) return null

      if (im < 0 && !imaginaryAlreadyNegated) {
        im = -im
      }

      if (!isNaN(phase) && phaseIsNegated) phase = -phase
      if (isNaN(mag)) mag = Math.sqrt(re * re + im * im)
      if (isNaN(phase)) phase = Math.atan2(im, re) * (180 / Math.PI)

      return {
        'freq/Hz': freq,
        'Re(Z)/Ohm': re,
        '-Im(Z)/Ohm': im,
        '|Z|/Ohm': mag,
        'Phase(Z)/deg': phase
      } as EisDataPoint
    })
    .filter((p): p is EisDataPoint => p !== null)

  return processedData
}
