import { create } from 'zustand';
import {
  Opcode,
  CondFlag,
  TrapVector,
  DEFAULT_PC,
  MEMORY_SIZE,
  MMIO,
  type Lc3State,
  type NumberFormat,
  type ExecutionMode,
  type Breakpoint,
  type DecodedInstruction,
} from '../types/lc3';
import { disassemble } from '../lib/disassembler';
import { explain } from '../lib/explainer';
import { HELLO_WORLD } from '../lib/mock-programs';

function signExtend(val: number, bitCount: number): number {
  if ((val >> (bitCount - 1)) & 1) {
    val |= (0xFFFF << bitCount) & 0xFFFF;
  }
  if (val & 0x8000) return val - 0x10000;
  return val;
}

function updateFlags(val: number): CondFlag {
  const v = val & 0xFFFF;
  if (v === 0) return CondFlag.ZRO;
  if (v & 0x8000) return CondFlag.NEG;
  return CondFlag.POS;
}

let runningTimer: number | null = null;

export const useLc3Store = create<Lc3State>((set, get) => {
  // Initialize initial memory with default program
  const initialMemory = new Uint16Array(MEMORY_SIZE);
  HELLO_WORLD.code.forEach((word, idx) => {
    initialMemory[HELLO_WORLD.origin + idx] = word;
  });

  const getDecoded = (mem: Uint16Array, pc: number, regs: number[]): DecodedInstruction => {
    const raw = mem[pc] ?? 0;
    const opcode = ((raw >> 12) & 0xF) as Opcode;
    return {
      raw,
      opcode,
      mnemonic: disassemble(raw, pc),
      explanation: explain(raw, pc, regs),
      address: pc,
    };
  };

  const initialRegs = [0, 0, 0, 0, 0, 0, 0, 0];
  const initialPc = HELLO_WORLD.origin;

  return {
    // CPU State
    registers: [...initialRegs],
    previousRegisters: [...initialRegs],
    pc: initialPc,
    cond: CondFlag.ZRO,
    memory: initialMemory,
    running: true,
    history: [],

    // Execution
    executionMode: 'paused',
    clockSpeedHz: 10,
    stepCount: 0,
    breakpoints: new Map<number, Breakpoint>(),

    // UI
    numberFormat: 'hex',
    currentInstruction: getDecoded(initialMemory, initialPc, initialRegs),

    // Terminal
    terminalOutput: '=== LC-3 Virtual Machine Booted ===\nReady to execute.\n\n',
    inputQueue: [],

    // Methods
    setNumberFormat: (format: NumberFormat) => set({ numberFormat: format }),

    setClockSpeed: (hz: number) => {
      set({ clockSpeedHz: hz });
      if (get().executionMode === 'running') {
        get().pause();
        get().run();
      }
    },

    toggleBreakpoint: (address: number) => {
      const bps = new Map(get().breakpoints);
      const existing = bps.get(address);
      if (existing) {
        bps.delete(address);
      } else {
        bps.set(address, { address, enabled: true });
      }
      set({ breakpoints: bps });
    },

    clearBreakpoints: () => set({ breakpoints: new Map() }),

    getMemory: (address: number) => {
      return get().memory[address & 0xFFFF] ?? 0;
    },

    setMemory: (address: number, value: number) => {
      const mem = new Uint16Array(get().memory);
      mem[address & 0xFFFF] = value & 0xFFFF;
      set({ memory: mem });
    },

    loadProgram: (program: number[], origin: number = DEFAULT_PC) => {
      const mem = new Uint16Array(MEMORY_SIZE);
      program.forEach((word, idx) => {
        mem[(origin + idx) & 0xFFFF] = word & 0xFFFF;
      });

      const resetRegs = [0, 0, 0, 0, 0, 0, 0, 0];
      set({
        memory: mem,
        registers: [...resetRegs],
        previousRegisters: [...resetRegs],
        pc: origin,
        cond: CondFlag.ZRO,
        running: true,
        executionMode: 'paused',
        stepCount: 0,
        history: [],
        currentInstruction: getDecoded(mem, origin, resetRegs),
        terminalOutput: get().terminalOutput + `\n[Loaded program at x${origin.toString(16).toUpperCase()}]\n`,
      });
    },

    reset: () => {
      get().pause();
      const origin = HELLO_WORLD.origin;
      const mem = new Uint16Array(MEMORY_SIZE);
      HELLO_WORLD.code.forEach((word, idx) => {
        mem[origin + idx] = word;
      });
      const resetRegs = [0, 0, 0, 0, 0, 0, 0, 0];
      set({
        memory: mem,
        registers: [...resetRegs],
        previousRegisters: [...resetRegs],
        pc: origin,
        cond: CondFlag.ZRO,
        running: true,
        executionMode: 'paused',
        stepCount: 0,
        history: [],
        currentInstruction: getDecoded(mem, origin, resetRegs),
        terminalOutput: '=== Machine Reset ===\n\n',
      });
    },

    pause: () => {
      if (runningTimer !== null) {
        clearInterval(runningTimer);
        runningTimer = null;
      }
      set({ executionMode: 'paused' });
    },

    run: () => {
      const state = get();
      if (!state.running) return;

      if (runningTimer !== null) {
        clearInterval(runningTimer);
      }

      set({ executionMode: 'running' });

      const intervalMs = Math.max(10, Math.floor(1000 / get().clockSpeedHz));
      runningTimer = window.setInterval(() => {
        const s = get();
        if (!s.running || s.executionMode !== 'running') {
          s.pause();
          return;
        }

        // Check if next PC hits a breakpoint
        if (s.stepCount > 0 && s.breakpoints.has(s.pc) && s.breakpoints.get(s.pc)?.enabled) {
          s.pause();
          set({
            terminalOutput: s.terminalOutput + `[Breakpoint hit at x${s.pc.toString(16).toUpperCase()}]\n`,
          });
          return;
        }

        s.step();
      }, intervalMs);
    },

    step: () => {
      const state = get();
      if (!state.running) return;

      // Save snapshot for Time-Travel Debugging (Step Backward)
      const snapshot = {
        registers: [...state.registers],
        previousRegisters: [...state.previousRegisters],
        pc: state.pc,
        cond: state.cond,
        memory: new Uint16Array(state.memory),
        running: state.running,
        terminalOutput: state.terminalOutput,
        stepCount: state.stepCount,
      };
      const history = [...state.history.slice(-49), snapshot];

      const mem = state.memory;
      const regs = [...state.registers];
      let pc = state.pc;
      let cond = state.cond;
      let running: boolean = state.running;
      let termOut = state.terminalOutput;
      const inputQueue = [...state.inputQueue];

      const readMem = (addr: number): number => {
        const a = addr & 0xFFFF;
        if (a === MMIO.KBSR) {
          return inputQueue.length > 0 ? 0x8000 : 0x0000;
        }
        if (a === MMIO.KBDR) {
          if (inputQueue.length > 0) {
            const ch = inputQueue.shift()!;
            return ch.charCodeAt(0) & 0xFF;
          }
          return 0;
        }
        return mem[a];
      };

      const writeMem = (addr: number, val: number) => {
        const a = addr & 0xFFFF;
        if (a === 0xFE06) {
          // Display status (always ready)
          return;
        }
        if (a === 0xFE04 || a === 0xFE08) {
          // Display data register
          termOut += String.fromCharCode(val & 0xFF);
          return;
        }
        mem[a] = val & 0xFFFF;
      };

      const instr = mem[pc];
      const nextPc = (pc + 1) & 0xFFFF;
      pc = nextPc;

      const op = (instr >> 12) & 0xF;

      switch (op) {
        case Opcode.ADD: {
          const dr = (instr >> 9) & 0x7;
          const sr1 = (instr >> 6) & 0x7;
          if ((instr >> 5) & 1) {
            const immVal = signExtend(instr & 0x1F, 5);
            regs[dr] = (regs[sr1] + immVal) & 0xFFFF;
          } else {
            const sr2 = instr & 0x7;
            regs[dr] = (regs[sr1] + regs[sr2]) & 0xFFFF;
          }
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.AND: {
          const dr = (instr >> 9) & 0x7;
          const sr1 = (instr >> 6) & 0x7;
          if ((instr >> 5) & 1) {
            const immVal = signExtend(instr & 0x1F, 5);
            regs[dr] = (regs[sr1] & immVal) & 0xFFFF;
          } else {
            const sr2 = instr & 0x7;
            regs[dr] = (regs[sr1] & regs[sr2]) & 0xFFFF;
          }
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.NOT: {
          const dr = (instr >> 9) & 0x7;
          const sr = (instr >> 6) & 0x7;
          regs[dr] = (~regs[sr]) & 0xFFFF;
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.BR: {
          const n = (instr >> 11) & 1;
          const z = (instr >> 10) & 1;
          const p = (instr >> 9) & 1;
          const condMatch =
            (n && (cond & CondFlag.NEG)) ||
            (z && (cond & CondFlag.ZRO)) ||
            (p && (cond & CondFlag.POS));
          if (condMatch) {
            const offset = signExtend(instr & 0x1FF, 9);
            pc = (pc + offset) & 0xFFFF;
          }
          break;
        }

        case Opcode.JMP: {
          const baseR = (instr >> 6) & 0x7;
          pc = regs[baseR];
          break;
        }

        case Opcode.JSR: {
          regs[7] = pc;
          if ((instr >> 11) & 1) {
            const offset = signExtend(instr & 0x7FF, 11);
            pc = (pc + offset) & 0xFFFF;
          } else {
            const baseR = (instr >> 6) & 0x7;
            pc = regs[baseR];
          }
          break;
        }

        case Opcode.LD: {
          const dr = (instr >> 9) & 0x7;
          const offset = signExtend(instr & 0x1FF, 9);
          regs[dr] = readMem((pc + offset) & 0xFFFF);
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.LDI: {
          const dr = (instr >> 9) & 0x7;
          const offset = signExtend(instr & 0x1FF, 9);
          const indirect = readMem((pc + offset) & 0xFFFF);
          regs[dr] = readMem(indirect);
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.LDR: {
          const dr = (instr >> 9) & 0x7;
          const baseR = (instr >> 6) & 0x7;
          const offset = signExtend(instr & 0x3F, 6);
          regs[dr] = readMem((regs[baseR] + offset) & 0xFFFF);
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.LEA: {
          const dr = (instr >> 9) & 0x7;
          const offset = signExtend(instr & 0x1FF, 9);
          regs[dr] = (pc + offset) & 0xFFFF;
          cond = updateFlags(regs[dr]);
          break;
        }

        case Opcode.ST: {
          const sr = (instr >> 9) & 0x7;
          const offset = signExtend(instr & 0x1FF, 9);
          writeMem((pc + offset) & 0xFFFF, regs[sr]);
          break;
        }

        case Opcode.STI: {
          const sr = (instr >> 9) & 0x7;
          const offset = signExtend(instr & 0x1FF, 9);
          const indirect = readMem((pc + offset) & 0xFFFF);
          writeMem(indirect, regs[sr]);
          break;
        }

        case Opcode.STR: {
          const sr = (instr >> 9) & 0x7;
          const baseR = (instr >> 6) & 0x7;
          const offset = signExtend(instr & 0x3F, 6);
          writeMem((regs[baseR] + offset) & 0xFFFF, regs[sr]);
          break;
        }

        case Opcode.TRAP: {
          const trapvect = instr & 0xFF;
          switch (trapvect) {
            case TrapVector.GETC: {
              if (inputQueue.length > 0) {
                const ch = inputQueue.shift()!;
                regs[0] = ch.charCodeAt(0) & 0xFF;
                cond = updateFlags(regs[0]);
              } else {
                // Polling wait: keep PC at this instruction until key is pressed
                pc = (pc - 1) & 0xFFFF;
              }
              break;
            }
            case TrapVector.OUT: {
              const char = String.fromCharCode(regs[0] & 0x7F);
              termOut += char;
              break;
            }
            case TrapVector.PUTS: {
              let ptr = regs[0];
              let str = '';
              while (ptr < MEMORY_SIZE && readMem(ptr) !== 0) {
                str += String.fromCharCode(readMem(ptr) & 0x7F);
                ptr++;
              }
              termOut += str;
              break;
            }
            case TrapVector.IN: {
              if (inputQueue.length > 0) {
                const ch = inputQueue.shift()!;
                regs[0] = ch.charCodeAt(0) & 0xFF;
                cond = updateFlags(regs[0]);
                termOut += ch;
              } else {
                // Polling wait
                pc = (pc - 1) & 0xFFFF;
              }
              break;
            }
            case TrapVector.PUTSP: {
              let ptr = regs[0];
              while (ptr < MEMORY_SIZE && readMem(ptr) !== 0) {
                const w = readMem(ptr);
                const c1 = w & 0xFF;
                if (c1) termOut += String.fromCharCode(c1);
                const c2 = (w >> 8) & 0xFF;
                if (c2) termOut += String.fromCharCode(c2);
                ptr++;
              }
              break;
            }
            case TrapVector.HALT: {
              running = false;
              termOut += '\n-- Machine Halted (TRAP x25) --\n';
              if (runningTimer !== null) {
                clearInterval(runningTimer);
                runningTimer = null;
              }
              break;
            }
          }
          break;
        }
      }

      const decoded = getDecoded(mem, pc, regs);

      set({
        previousRegisters: [...state.registers],
        registers: regs,
        pc,
        cond,
        running,
        executionMode: running ? state.executionMode : 'paused',
        stepCount: state.stepCount + 1,
        terminalOutput: termOut,
        inputQueue,
        currentInstruction: decoded,
        history,
      });
    },

    stepBack: () => {
      const state = get();
      if (state.executionMode === 'running' || state.history.length === 0) return;

      const history = [...state.history];
      const prev = history.pop()!;

      const decoded = getDecoded(prev.memory, prev.pc, prev.registers);

      set({
        registers: prev.registers,
        previousRegisters: prev.previousRegisters,
        pc: prev.pc,
        cond: prev.cond,
        memory: prev.memory,
        running: prev.running,
        terminalOutput: prev.terminalOutput,
        stepCount: prev.stepCount,
        history,
        currentInstruction: decoded,
        executionMode: 'paused',
      });
    },

    sendKey: (char: string) => {
      set({
        inputQueue: [...get().inputQueue, char],
      });
    },

    clearTerminal: () => set({ terminalOutput: '' }),
  };
});
