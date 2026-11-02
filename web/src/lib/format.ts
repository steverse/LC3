import type { NumberFormat } from '../types/lc3';

export function formatValue(value: number, format: NumberFormat): string {
  const unsigned = value & 0xFFFF;
  switch (format) {
    case 'hex':
      return 'x' + unsigned.toString(16).toUpperCase().padStart(4, '0');
    case 'decimal': {
      const s = unsigned & 0x8000 ? unsigned - 0x10000 : unsigned;
      return s.toString();
    }
    case 'unsigned':
      return unsigned.toString();
    case 'binary':
      return '0b' + unsigned.toString(2).padStart(16, '0');
    default:
      return 'x' + unsigned.toString(16).toUpperCase().padStart(4, '0');
  }
}

export function formatAddress(address: number): string {
  return 'x' + (address & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export function formatCondFlag(cond: number): { n: boolean; z: boolean; p: boolean } {
  return {
    n: (cond & 4) !== 0,
    z: (cond & 2) !== 0,
    p: (cond & 1) !== 0,
  };
}
