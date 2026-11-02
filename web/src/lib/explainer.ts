import { Opcode, TrapVector } from '../types/lc3';

function signExtend(val: number, bitCount: number): number {
  if ((val >> (bitCount - 1)) & 1) {
    val |= (0xFFFF << bitCount) & 0xFFFF;
  }
  if (val & 0x8000) return val - 0x10000;
  return val;
}

function condName(result: number): string {
  if (result === 0) return 'ZERO (Z)';
  if (result & 0x8000) return 'NEGATIVE (N)';
  return 'POSITIVE (P)';
}

function hexStr(val: number): string {
  return 'x' + (val & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function signed(val: number): number {
  val = val & 0xFFFF;
  if (val & 0x8000) return val - 0x10000;
  return val;
}

export function explain(instr: number, pc: number, regs: number[]): string {
  const opcode = (instr >> 12) & 0xF;

  switch (opcode) {
    case Opcode.ADD: {
      const dr = (instr >> 9) & 0x7;
      const sr1 = (instr >> 6) & 0x7;
      const sr1Val = signed(regs[sr1] ?? 0);
      if ((instr >> 5) & 1) {
        const immVal = signExtend(instr & 0x1F, 5);
        const result = ((regs[sr1] ?? 0) + immVal) & 0xFFFF;
        return `Read R${sr1} (value: ${sr1Val}), add the constant ${immVal}, store the result (${signed(result)}) into R${dr}. Condition flag → ${condName(result)}.`;
      }
      const sr2 = instr & 0x7;
      const sr2Val = signed(regs[sr2] ?? 0);
      const result = ((regs[sr1] ?? 0) + (regs[sr2] ?? 0)) & 0xFFFF;
      return `Add R${sr1} (${sr1Val}) + R${sr2} (${sr2Val}) = ${signed(result)}, store into R${dr}. Condition flag → ${condName(result)}.`;
    }

    case Opcode.AND: {
      const dr = (instr >> 9) & 0x7;
      const sr1 = (instr >> 6) & 0x7;
      if ((instr >> 5) & 1) {
        const immVal = signExtend(instr & 0x1F, 5);
        return `Bitwise AND of R${sr1} (${signed(regs[sr1] ?? 0)}) with constant ${immVal}, store result in R${dr}.`;
      }
      const sr2 = instr & 0x7;
      return `Bitwise AND of R${sr1} (${signed(regs[sr1] ?? 0)}) with R${sr2} (${signed(regs[sr2] ?? 0)}), store result in R${dr}.`;
    }

    case Opcode.NOT: {
      const dr = (instr >> 9) & 0x7;
      const sr = (instr >> 6) & 0x7;
      return `Bitwise NOT of R${sr} (${signed(regs[sr] ?? 0)}), store the inverted bits into R${dr}.`;
    }

    case Opcode.BR: {
      const n = (instr >> 11) & 1;
      const z = (instr >> 10) & 1;
      const p = (instr >> 9) & 1;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      const conditions: string[] = [];
      if (n) conditions.push('Negative');
      if (z) conditions.push('Zero');
      if (p) conditions.push('Positive');
      const condStr = conditions.length === 3 ? 'unconditionally' : `if flag is ${conditions.join(' or ')}`;
      return `Branch ${condStr} to address ${hexStr(target)}.`;
    }

    case Opcode.JMP: {
      const baseR = (instr >> 6) & 0x7;
      if (baseR === 7) return `Return from subroutine — jump to address in R7 (${hexStr(regs[7] ?? 0)}).`;
      return `Unconditional jump to address in R${baseR} (${hexStr(regs[baseR] ?? 0)}).`;
    }

    case Opcode.JSR: {
      if ((instr >> 11) & 1) {
        const offset = signExtend(instr & 0x7FF, 11);
        const target = (pc + 1 + offset) & 0xFFFF;
        return `Save return address in R7, then jump to subroutine at ${hexStr(target)}.`;
      }
      const baseR = (instr >> 6) & 0x7;
      return `Save return address in R7, then jump to subroutine at address in R${baseR} (${hexStr(regs[baseR] ?? 0)}).`;
    }

    case Opcode.LD: {
      const dr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `Load the value from memory address ${hexStr(target)} into R${dr}.`;
    }

    case Opcode.LDI: {
      const dr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `Load indirect: read address stored at ${hexStr(target)}, then load value at that address into R${dr}.`;
    }

    case Opcode.LDR: {
      const dr = (instr >> 9) & 0x7;
      const baseR = (instr >> 6) & 0x7;
      const offset = signExtend(instr & 0x3F, 6);
      return `Load from memory at R${baseR} (${hexStr(regs[baseR] ?? 0)}) + offset ${offset} into R${dr}.`;
    }

    case Opcode.LEA: {
      const dr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `Load the address ${hexStr(target)} itself (not its value) into R${dr}.`;
    }

    case Opcode.ST: {
      const sr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `Store R${sr} (${signed(regs[sr] ?? 0)}) into memory address ${hexStr(target)}.`;
    }

    case Opcode.STI: {
      const sr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `Store indirect: read target address from ${hexStr(target)}, then write R${sr} (${signed(regs[sr] ?? 0)}) there.`;
    }

    case Opcode.STR: {
      const sr = (instr >> 9) & 0x7;
      const baseR = (instr >> 6) & 0x7;
      const offset = signExtend(instr & 0x3F, 6);
      return `Store R${sr} (${signed(regs[sr] ?? 0)}) to memory at R${baseR} + offset ${offset}.`;
    }

    case Opcode.TRAP: {
      const trapvect = instr & 0xFF;
      switch (trapvect) {
        case TrapVector.GETC: return 'Read a single character from the keyboard into R0 (no echo).';
        case TrapVector.OUT: return `Output the character in R0 (ASCII ${(regs[0] ?? 0) & 0x7F}, "${String.fromCharCode((regs[0] ?? 0) & 0x7F)}") to the console.`;
        case TrapVector.PUTS: return `Print a null-terminated string starting at address in R0 (${hexStr(regs[0] ?? 0)}).`;
        case TrapVector.IN: return 'Prompt for input, read a character, echo it, and store in R0.';
        case TrapVector.PUTSP: return 'Print a packed string (two chars per word) from address in R0.';
        case TrapVector.HALT: return 'Halt the machine — stop the fetch-decode-execute cycle.';
        default: return `Execute trap routine at vector ${hexStr(trapvect)}.`;
      }
    }

    case Opcode.RTI: return 'Return from interrupt (privileged, not used in user programs).';
    case Opcode.RES: return 'Reserved opcode — not a valid instruction.';
    default: return 'Unknown instruction.';
  }
}
