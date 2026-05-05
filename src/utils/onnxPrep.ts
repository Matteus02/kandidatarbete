import type { EisDataPoint } from '@/types/eis';

// ==========================================
// 1. MATEMATISKA HJÄLPFUNKTIONER (Type-Safe)
// ==========================================

// Linjär interpolering
function interp1d(xTarget: number[], x: number[], y: number[]): number[] {
  return xTarget.map(xt => {
    const maxX = Math.max(...x);
    const minX = Math.min(...x);

    if (xt >= maxX) {
      const idx = x.indexOf(maxX);
      return y[idx] ?? 0; // Fallback till 0 om undefined
    }
    if (xt <= minX) {
      const idx = x.indexOf(minX);
      return y[idx] ?? 0;
    }

    let i = 0;
    while (i < x.length - 1) {
      const curX = x[i] ?? 0;
      const nextX = x[i + 1] ?? 0;
      if ((curX >= xt && nextX <= xt) || (curX <= xt && nextX >= xt)) {
        break;
      }
      i++;
    }

    const x0 = x[i] ?? 0;
    const x1 = x[i + 1] ?? 0;
    const y0 = y[i] ?? 0;
    const y1 = y[i + 1] ?? 0;

    // Förhindra division med noll
    if (x1 - x0 === 0) return y0;

    return y0 + ((xt - x0) * (y1 - y0)) / (x1 - x0);
  });
}

// Fas-upprullning
function unwrap(phaseArray: number[]): number[] {
  const unwrapped = [...phaseArray];
  for (let i = 1; i < unwrapped.length; i++) {
    const current = unwrapped[i] ?? 0;
    const prev = unwrapped[i - 1] ?? 0;
    let diff = current - prev;
    let newCurrent = current;

    while (diff > 180) { newCurrent -= 360; diff -= 360; }
    while (diff < -180) { newCurrent += 360; diff += 360; }

    unwrapped[i] = newCurrent;
  }
  return unwrapped;
}

// Central differens
function gradient(y: number[], x: number[]): number[] {
  const dy = Array.from({ length: y.length }, () => 0);
  for (let i = 0; i < y.length; i++) {
    if (i === 0) {
      const y1 = y[1] ?? 0, y0 = y[0] ?? 0;
      const x1 = x[1] ?? 0, x0 = x[0] ?? 1;
      dy[i] = (x1 - x0) !== 0 ? (y1 - y0) / (x1 - x0) : 0;
    } else if (i === y.length - 1) {
      const yi = y[i] ?? 0, yPrev = y[i - 1] ?? 0;
      const xi = x[i] ?? 0, xPrev = x[i - 1] ?? 1;
      dy[i] = (xi - xPrev) !== 0 ? (yi - yPrev) / (xi - xPrev) : 0;
    } else {
      const yNext = y[i + 1] ?? 0, yPrev = y[i - 1] ?? 0;
      const xNext = x[i + 1] ?? 0, xPrev = x[i - 1] ?? 1;
      dy[i] = (xNext - xPrev) !== 0 ? (yNext - yPrev) / (xNext - xPrev) : 0;
    }
  }
  return dy;
}

// ==========================================
// 2. HUVUDFUNKTIONEN
// ==========================================

export function prepareEisForOnnx(data: EisDataPoint[]): Float32Array | null {
  if (data.length < 5) return null;

  const freqs = data.map(d => d['freq/Hz']);
  const z_re = data.map(d => d['Re(Z)/Ohm']);
  const z_im = data.map(d => -d['-Im(Z)/Ohm']);

  const log_freq = freqs.map(f => Math.log10(f));

  // Safe map calls
  let phase = z_im.map((im, i) => {
    const re = z_re[i] ?? 1; // Undvik odefinierad x-koordinat
    return Math.atan2(im, re) * (180 / Math.PI);
  });

  phase = unwrap(phase);
  const phase_deriv = gradient(phase, log_freq);

  const log_mag = z_re.map((re, i) => {
    const im = z_im[i] ?? 0;
    return Math.log10(Math.sqrt(re * re + im * im) + 1e-12);
  });

  const max_log_f = Math.max(...log_freq);
  const min_log_f = Math.min(...log_freq);
  const log_fixed = Array.from({ length: 60 }, (_, i) => max_log_f - (i * (max_log_f - min_log_f)) / 59);

  const z_re_60 = interp1d(log_fixed, log_freq, z_re);
  const z_im_60 = interp1d(log_fixed, log_freq, z_im);
  const phase_60 = interp1d(log_fixed, log_freq, phase);
  const phase_deriv_60 = interp1d(log_fixed, log_freq, phase_deriv);
  const log_mag_60 = interp1d(log_fixed, log_freq, log_mag);

  const channels = [
    z_re_60,
    z_im_60,
    log_fixed,
    phase_deriv_60,
    phase_60,
    log_mag_60
  ];

  const normalizedChannels = channels.map(channel => {
    const mean = channel.reduce((sum, val) => sum + val, 0) / channel.length;
    const variance = channel.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / channel.length;
    const std = Math.sqrt(variance) + 1e-8;
    return channel.map(val => (val - mean) / std);
  });

  // Flat out into Float32Array securely
  const tensorArray = new Float32Array(6 * 60);
  let index = 0;
  for (let c = 0; c < 6; c++) {
    const channelArr = normalizedChannels[c];
    for (let p = 0; p < 60; p++) {
      // Dubbelkolla så vi har rätt channel och punkt
      const val = channelArr ? (channelArr[p] ?? 0) : 0;
      tensorArray[index++] = val;
    }
  }

  return tensorArray;
}
