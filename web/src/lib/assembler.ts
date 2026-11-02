/**
 * LC-3 In-Browser Two-Pass Assembler
 *
 * Translates standard LC-3 assembly code into 16-bit machine words.
 * Supports all 16 instructions, trap pseudonyms, labels, and standard directives
 * (.ORIG, .END, .FILL, .BLKW, .STRINGZ).
 */

export interface AssemblyError {
  line: number;
  message: string;
}

export interface AssemblyResult {
  success: boolean;
  origin: number;
  words: number[];
  errors: AssemblyError[];
  symbolTable: Record<string, number>;
}

// Helpers for number parsing
function parseNumber(token: string): number | null {
  const t = token.trim();
  if (/^#-?\d+$/.test(t)) {
    return parseInt(t.slice(1), 10);
  }
  if (/^-?\d+$/.test(t)) {
    return parseInt(t, 10);
  }
  if (/^[xX][0-9a-fA-F]+$/.test(t)) {
    return parseInt(t.slice(1), 16);
  }
  if (/^0[xX][0-9a-fA-F]+$/.test(t)) {
    return parseInt(t.slice(2), 16);
  }
  if (/^[bB][01]+$/.test(t)) {
    return parseInt(t.slice(1), 2);
  }
  return null;
}

function parseRegister(token: string): number | null {
  const match = token.trim().toUpperCase().match(/^R([0-7])$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function checkRange(val: number, bits: number, signed: boolean = true): boolean {
  if (signed) {
    const min = -(1 << (bits - 1));
    const max = (1 << (bits - 1)) - 1;
    return val >= min && val <= max;
  } else {
    return val >= 0 && val < (1 << bits);
  }
}

function mask(val: number, bits: number): number {
  return val & ((1 << bits) - 1);
}

export function assemble(source: string): AssemblyResult {
  const errors: AssemblyError[] = [];
  const lines = source.split(/\r?\n/);
  const symbolTable: Record<string, number> = {};

  let origin = 0x3000;
  let hasOrigin = false;
  let currentAddress = 0x3000;

  interface ParsedLine {
    lineNumber: number;
    address: number;
    label?: string;
    mnemonic?: string;
    operandsText: string;
  }

  const parsedLines: ParsedLine[] = [];

  // =========================================================
  // PASS 1: Build Symbol Table & Calculate Addresses
  // =========================================================
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Remove comments
    const commentIdx = rawLine.indexOf(';');
    const lineWithoutComment = commentIdx !== -1 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmed = lineWithoutComment.trim();

    if (!trimmed) continue;

    // Check for string literal inside .STRINGZ
    let tokenMatch: RegExpMatchArray | null;
    let label: string | undefined;
    let mnemonic: string | undefined;
    let operandsText = '';

    // Handle .STRINGZ with quotes specially
    const stringzMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*:?\s+)?(\.STRINGZ)\s+"(.*)"$/i);
    if (stringzMatch) {
      if (stringzMatch[1]) {
        label = stringzMatch[1].replace(':', '').trim();
      }
      mnemonic = '.STRINGZ';
      operandsText = stringzMatch[3];
    } else {
      // General token split by whitespace or comma
      const parts = trimmed.split(/[\s,]+/);
      let idx = 0;

      // Check if first token is label
      const firstUpper = parts[0].toUpperCase();
      const isKnownDirective = firstUpper.startsWith('.');
      const isKnownOp = [
        'ADD', 'AND', 'NOT', 'BR', 'BRN', 'BRZ', 'BRP', 'BRNZ', 'BRZP', 'BRNP', 'BRNZP',
        'JMP', 'RET', 'JSR', 'JSRR', 'LD', 'LDI', 'LDR', 'LEA', 'ST', 'STI', 'STR',
        'TRAP', 'GETC', 'OUT', 'PUTS', 'IN', 'PUTSP', 'HALT', 'RTI'
      ].includes(firstUpper.replace(':', ''));

      if (!isKnownDirective && !isKnownOp && !parts[0].startsWith(';')) {
        label = parts[idx].replace(':', '');
        idx++;
      }

      if (idx < parts.length) {
        mnemonic = parts[idx].toUpperCase();
        idx++;
        operandsText = parts.slice(idx).join(' ');
      }
    }

    if (!hasOrigin) {
      if (mnemonic === '.ORIG') {
        const orgVal = parseNumber(operandsText);
        if (orgVal === null || orgVal < 0 || orgVal > 0xFFFF) {
          errors.push({ line: i + 1, message: 'Invalid origin address in .ORIG' });
        } else {
          origin = orgVal;
          currentAddress = origin;
          hasOrigin = true;
        }
        continue;
      } else if (label || mnemonic) {
        errors.push({ line: i + 1, message: 'Missing .ORIG directive before code' });
        hasOrigin = true; // prevent cascade
      }
    }

    if (mnemonic === '.END') {
      break;
    }

    if (label) {
      const normalizedLabel = label.toUpperCase();
      if (symbolTable[normalizedLabel] !== undefined) {
        errors.push({ line: i + 1, message: `Duplicate label definition: ${label}` });
      } else {
        symbolTable[normalizedLabel] = currentAddress;
      }
    }

    if (!mnemonic) {
      // Just a standalone label line
      continue;
    }

    parsedLines.push({
      lineNumber: i + 1,
      address: currentAddress,
      label,
      mnemonic,
      operandsText,
    });

    // Advance address
    if (mnemonic === '.STRINGZ') {
      // characters + null terminator
      currentAddress += operandsText.length + 1;
    } else if (mnemonic === '.BLKW') {
      const count = parseNumber(operandsText);
      if (count === null || count < 0) {
        errors.push({ line: i + 1, message: 'Invalid block count in .BLKW' });
      } else {
        currentAddress += count;
      }
    } else {
      // All instructions and .FILL occupy 1 word
      currentAddress += 1;
    }
  }

  if (errors.length > 0) {
    return { success: false, origin, words: [], errors, symbolTable };
  }

  // =========================================================
  // PASS 2: Translate instructions to machine words
  // =========================================================
  const words: number[] = [];
  let expectedAddress = origin;

  for (const pl of parsedLines) {
    const { lineNumber, address, mnemonic, operandsText } = pl;

    // Fill gap if any
    while (expectedAddress < address) {
      words.push(0);
      expectedAddress++;
    }

    if (!mnemonic) continue;

    // Helper to get comma/space split tokens
    const tokens = operandsText.split(/[\s,]+/).filter(t => t.length > 0);

    const resolveLabelOrNumber = (token: string, bits: number, pcRelative: boolean): number | null => {
      const num = parseNumber(token);
      if (num !== null) {
        if (!checkRange(num, bits, true) && !checkRange(num, bits, false)) {
          errors.push({ line: lineNumber, message: `Value ${token} exceeds ${bits}-bit range` });
          return null;
        }
        return mask(num, bits);
      }

      // Check symbol table
      const targetAddr = symbolTable[token.toUpperCase()];
      if (targetAddr === undefined) {
        errors.push({ line: lineNumber, message: `Undefined symbol: ${token}` });
        return null;
      }

      if (pcRelative) {
        const offset = targetAddr - (address + 1);
        if (!checkRange(offset, bits, true)) {
          errors.push({ line: lineNumber, message: `Label ${token} is out of ${bits}-bit PC offset range (offset=${offset})` });
          return null;
        }
        return mask(offset, bits);
      } else {
        return targetAddr & 0xFFFF;
      }
    };

    switch (mnemonic) {
      case '.FILL': {
        const val = resolveLabelOrNumber(tokens[0] || '', 16, false);
        if (val !== null) {
          words.push(val);
          expectedAddress++;
        }
        break;
      }

      case '.BLKW': {
        const count = parseNumber(tokens[0]) || 0;
        for (let k = 0; k < count; k++) {
          words.push(0);
          expectedAddress++;
        }
        break;
      }

      case '.STRINGZ': {
        for (let k = 0; k < operandsText.length; k++) {
          words.push(operandsText.charCodeAt(k) & 0xFF);
          expectedAddress++;
        }
        words.push(0); // null terminator
        expectedAddress++;
        break;
      }

      case 'ADD':
      case 'AND': {
        const isAdd = mnemonic === 'ADD';
        const dr = parseRegister(tokens[0]);
        const sr1 = parseRegister(tokens[1]);
        if (dr === null || sr1 === null || tokens.length < 3) {
          errors.push({ line: lineNumber, message: `Syntax error in ${mnemonic}: expected DR, SR1, SR2/imm5` });
          break;
        }
        const opcode = isAdd ? 0x1000 : 0x5000;
        const sr2 = parseRegister(tokens[2]);
        if (sr2 !== null) {
          words.push(opcode | (dr << 9) | (sr1 << 6) | sr2);
        } else {
          const imm = parseNumber(tokens[2]);
          if (imm === null || !checkRange(imm, 5, true)) {
            errors.push({ line: lineNumber, message: `Invalid 5-bit immediate for ${mnemonic}: ${tokens[2]}` });
          } else {
            words.push(opcode | (dr << 9) | (sr1 << 6) | 0x20 | mask(imm, 5));
          }
        }
        expectedAddress++;
        break;
      }

      case 'NOT': {
        const dr = parseRegister(tokens[0]);
        const sr = parseRegister(tokens[1]);
        if (dr === null || sr === null) {
          errors.push({ line: lineNumber, message: 'Syntax error in NOT: expected DR, SR' });
        } else {
          words.push(0x9000 | (dr << 9) | (sr << 6) | 0x3F);
        }
        expectedAddress++;
        break;
      }

      case 'BR':
      case 'BRN':
      case 'BRZ':
      case 'BRP':
      case 'BRNZ':
      case 'BRZP':
      case 'BRNP':
      case 'BRNZP': {
        let n = 0, z = 0, p = 0;
        const condPart = mnemonic.slice(2);
        if (condPart.length === 0) {
          n = 1; z = 1; p = 1; // Unconditional
        } else {
          if (condPart.includes('N')) n = 1;
          if (condPart.includes('Z')) z = 1;
          if (condPart.includes('P')) p = 1;
        }
        const offset = resolveLabelOrNumber(tokens[0] || '', 9, true);
        if (offset !== null) {
          words.push(0x0000 | (n << 11) | (z << 10) | (p << 9) | offset);
        }
        expectedAddress++;
        break;
      }

      case 'JMP': {
        const baseR = parseRegister(tokens[0]);
        if (baseR === null) {
          errors.push({ line: lineNumber, message: 'Syntax error in JMP: expected BaseR' });
        } else {
          words.push(0xC000 | (baseR << 6));
        }
        expectedAddress++;
        break;
      }

      case 'RET': {
        words.push(0xC000 | (7 << 6)); // JMP R7
        expectedAddress++;
        break;
      }

      case 'JSR': {
        const offset = resolveLabelOrNumber(tokens[0] || '', 11, true);
        if (offset !== null) {
          words.push(0x4800 | offset);
        }
        expectedAddress++;
        break;
      }

      case 'JSRR': {
        const baseR = parseRegister(tokens[0]);
        if (baseR === null) {
          errors.push({ line: lineNumber, message: 'Syntax error in JSRR: expected BaseR' });
        } else {
          words.push(0x4000 | (baseR << 6));
        }
        expectedAddress++;
        break;
      }

      case 'LD':
      case 'LDI':
      case 'LEA':
      case 'ST':
      case 'STI': {
        const opcodes: Record<string, number> = {
          LD: 0x2000,
          LDI: 0xA000,
          LEA: 0xE000,
          ST: 0x3000,
          STI: 0xB000,
        };
        const r = parseRegister(tokens[0]);
        if (r === null || tokens.length < 2) {
          errors.push({ line: lineNumber, message: `Syntax error in ${mnemonic}: expected register, label/offset` });
          break;
        }
        const offset = resolveLabelOrNumber(tokens[1] || '', 9, true);
        if (offset !== null) {
          words.push(opcodes[mnemonic] | (r << 9) | offset);
        }
        expectedAddress++;
        break;
      }

      case 'LDR':
      case 'STR': {
        const isLdr = mnemonic === 'LDR';
        const r = parseRegister(tokens[0]);
        const baseR = parseRegister(tokens[1]);
        if (r === null || baseR === null || tokens.length < 3) {
          errors.push({ line: lineNumber, message: `Syntax error in ${mnemonic}: expected R, BaseR, offset6` });
          break;
        }
        const offset = parseNumber(tokens[2]);
        if (offset === null || !checkRange(offset, 6, true)) {
          errors.push({ line: lineNumber, message: `Invalid 6-bit offset for ${mnemonic}: ${tokens[2]}` });
        } else {
          const opcode = isLdr ? 0x6000 : 0x7000;
          words.push(opcode | (r << 9) | (baseR << 6) | mask(offset, 6));
        }
        expectedAddress++;
        break;
      }

      case 'TRAP': {
        const vec = parseNumber(tokens[0]);
        if (vec === null || vec < 0 || vec > 0xFF) {
          errors.push({ line: lineNumber, message: 'Invalid trap vector in TRAP' });
        } else {
          words.push(0xF000 | (vec & 0xFF));
        }
        expectedAddress++;
        break;
      }

      case 'GETC':  words.push(0xF020); expectedAddress++; break;
      case 'OUT':   words.push(0xF021); expectedAddress++; break;
      case 'PUTS':  words.push(0xF022); expectedAddress++; break;
      case 'IN':    words.push(0xF023); expectedAddress++; break;
      case 'PUTSP': words.push(0xF024); expectedAddress++; break;
      case 'HALT':  words.push(0xF025); expectedAddress++; break;

      default:
        errors.push({ line: lineNumber, message: `Unknown instruction or directive: ${mnemonic}` });
        break;
    }
  }

  return {
    success: errors.length === 0,
    origin,
    words,
    errors,
    symbolTable,
  };
}
