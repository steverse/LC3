/**
 * Web Worker & WebAssembly Interface Contract
 *
 * This contract specifies the exact message schema between the React UI
 * and the background C++ WebAssembly execution thread (Emscripten).
 */

export type MainToWorkerMessage =
  | { type: 'INIT' }
  | { type: 'LOAD_PROGRAM'; origin: number; words: number[] }
  | { type: 'STEP' }
  | { type: 'RUN'; clockSpeedHz: number }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SET_MEMORY'; address: number; value: number }
  | { type: 'SEND_KEY'; char: string };

export type WorkerToMainMessage =
  | {
      type: 'CPU_SNAPSHOT';
      registers: number[];
      pc: number;
      cond: number;
      running: boolean;
      stepCount: number;
    }
  | { type: 'TERMINAL_OUTPUT'; text: string }
  | { type: 'HALTED' }
  | { type: 'BREAKPOINT_HIT'; address: number }
  | { type: 'ERROR'; message: string };
