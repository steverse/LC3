/** LC-3 Opcode enumeration */
export enum Opcode {
  BR   = 0,
  ADD  = 1,
  LD   = 2,
  ST   = 3,
  JSR  = 4,
  AND  = 5,
  LDR  = 6,
  STR  = 7,
  RTI  = 8,
  NOT  = 9,
  LDI  = 10,
  STI  = 11,
  JMP  = 12,
  RES  = 13,
  LEA  = 14,
  TRAP = 15,
}

export enum CondFlag {
  POS = 1,
  ZRO = 2,
  NEG = 4,
}

export enum TrapVector {
  GETC  = 0x20,
  OUT   = 0x21,
  PUTS  = 0x22,
  IN    = 0x23,
  PUTSP = 0x24,
  HALT  = 0x25,
}

export const MMIO = {
  KBSR: 0xFE00,
  KBDR: 0xFE02,
} as const;

export const DEFAULT_PC = 0x3000;
export const MEMORY_SIZE = 1 << 16; // 65536

export type NumberFormat = 'hex' | 'decimal' | 'unsigned' | 'binary';
export type ExecutionMode = 'paused' | 'stepping' | 'running';

export interface DecodedInstruction {
  raw: number;
  opcode: Opcode;
  mnemonic: string;
  explanation: string;
  address: number;
}

export interface Breakpoint {
  address: number;
  enabled: boolean;
}

export interface CpuSnapshot {
  registers: number[];
  previousRegisters: number[];
  pc: number;
  cond: CondFlag;
  memory: Uint16Array;
  running: boolean;
  terminalOutput: string;
  stepCount: number;
}

export interface Lc3State {
  // CPU state
  registers: number[];
  pc: number;
  cond: CondFlag;
  memory: Uint16Array;
  running: boolean;

  // History for Time-Travel Debugging (Step Backward)
  history: CpuSnapshot[];

  // Execution
  executionMode: ExecutionMode;
  clockSpeedHz: number;
  stepCount: number;

  // Breakpoints
  breakpoints: Map<number, Breakpoint>;

  // UI
  numberFormat: NumberFormat;
  currentInstruction: DecodedInstruction | null;
  previousRegisters: number[];

  // Terminal
  terminalOutput: string;
  inputQueue: string[];

  // Actions
  step: () => void;
  stepBack: () => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  loadProgram: (program: number[], origin?: number) => void;
  getMemory: (address: number) => number;
  setMemory: (address: number, value: number) => void;
  toggleBreakpoint: (address: number) => void;
  clearBreakpoints: () => void;
  setNumberFormat: (format: NumberFormat) => void;
  setClockSpeed: (hz: number) => void;
  sendKey: (char: string) => void;
  clearTerminal: () => void;
}
