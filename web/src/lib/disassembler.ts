import { Opcode, TrapVector } from '../types/lc3';

function signExtend(val: number, bitCount: number): number {
  if ((val >> (bitCount - 1)) & 1) {
    val |= (0xFFFF << bitCount) & 0xFFFF;
  }
  if (val & 0x8000) return val - 0x10000;
  return val;
}

function reg(r: number): string { return `R${r}`; }
function imm(val: number): string { return `#${val}`; }
function hex(val: number): string { return `x${(val & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`; }

export function disassemble(instr: number, pc: number): string {
  const opcode = (instr >> 12) & 0xF;

  switch (opcode) {
    case Opcode.ADD: {
      const dr = (instr >> 9) & 0x7;
      const sr1 = (instr >> 6) & 0x7;
      if ((instr >> 5) & 1) {
        const immVal = signExtend(instr & 0x1F, 5);
        return `ADD ${reg(dr)}, ${reg(sr1)}, ${imm(immVal)}`;
      }
      const sr2 = instr & 0x7;
      return `ADD ${reg(dr)}, ${reg(sr1)}, ${reg(sr2)}`;
    }

    case Opcode.AND: {
      const dr = (instr >> 9) & 0x7;
      const sr1 = (instr >> 6) & 0x7;
      if ((instr >> 5) & 1) {
        const immVal = signExtend(instr & 0x1F, 5);
        return `AND ${reg(dr)}, ${reg(sr1)}, ${imm(immVal)}`;
      }
      const sr2 = instr & 0x7;
      return `AND ${reg(dr)}, ${reg(sr1)}, ${reg(sr2)}`;
    }

    case Opcode.NOT: {
      const dr = (instr >> 9) & 0x7;
      const sr = (instr >> 6) & 0x7;
      return `NOT ${reg(dr)}, ${reg(sr)}`;
    }

    case Opcode.BR: {
      const n = (instr >> 11) & 1;
      const z = (instr >> 10) & 1;
      const p = (instr >> 9) & 1;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      let cond = '';
      if (n) cond += 'n';
      if (z) cond += 'z';
      if (p) cond += 'p';
      if (cond === '' || cond === 'nzp') return `BR ${hex(target)}`;
      return `BR${cond} ${hex(target)}`;
    }

    case Opcode.JMP: {
      const baseR = (instr >> 6) & 0x7;
      if (baseR === 7) return 'RET';
      return `JMP ${reg(baseR)}`;
    }

    case Opcode.JSR: {
      if ((instr >> 11) & 1) {
        const offset = signExtend(instr & 0x7FF, 11);
        const target = (pc + 1 + offset) & 0xFFFF;
        return `JSR ${hex(target)}`;
      }
      const baseR = (instr >> 6) & 0x7;
      return `JSRR ${reg(baseR)}`;
    }

    case Opcode.LD: {
      const dr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `LD ${reg(dr)}, ${hex(target)}`;
    }

    case Opcode.LDI: {
      const dr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `LDI ${reg(dr)}, ${hex(target)}`;
    }

    case Opcode.LDR: {
      const dr = (instr >> 9) & 0x7;
      const baseR = (instr >> 6) & 0x7;
      const offset = signExtend(instr & 0x3F, 6);
      return `LDR ${reg(dr)}, ${reg(baseR)}, ${imm(offset)}`;
    }

    case Opcode.LEA: {
      const dr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `LEA ${reg(dr)}, ${hex(target)}`;
    }

    case Opcode.ST: {
      const sr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `ST ${reg(sr)}, ${hex(target)}`;
    }

    case Opcode.STI: {
      const sr = (instr >> 9) & 0x7;
      const offset = signExtend(instr & 0x1FF, 9);
      const target = (pc + 1 + offset) & 0xFFFF;
      return `STI ${reg(sr)}, ${hex(target)}`;
    }

    case Opcode.STR: {
      const sr = (instr >> 9) & 0x7;
      const baseR = (instr >> 6) & 0x7;
      const offset = signExtend(instr & 0x3F, 6);
      return `STR ${reg(sr)}, ${reg(baseR)}, ${imm(offset)}`;
    }

    case Opcode.TRAP: {
      const trapvect = instr & 0xFF;
      switch (trapvect) {
        case TrapVector.GETC:  return 'TRAP GETC';
        case TrapVector.OUT:   return 'TRAP OUT';
        case TrapVector.PUTS:  return 'TRAP PUTS';
        case TrapVector.IN:    return 'TRAP IN';
        case TrapVector.PUTSP: return 'TRAP PUTSP';
        case TrapVector.HALT:  return 'HALT';
        default: return `TRAP ${hex(trapvect)}`;
      }
    }

    case Opcode.RTI: return 'RTI';
    case Opcode.RES: return 'RES';
    default: return `??? (${hex(instr)})`;
  }
}
