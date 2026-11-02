import { MainToWorkerMessage, WorkerToMainMessage } from '../types/worker';

/**
 * LC-3 Background Web Worker
 *
 * Runs the LC-3 VM in a separate thread so heavy execution loops
 * and games (e.g. 2048, Rogue) do not drop frames on the React UI thread.
 *
 * When lc3.wasm is compiled by Teammate 2, import it here and bind
 * the exported C functions.
 */

// Memory and registers state
const MEMORY_SIZE = 65536;
const memory = new Uint16Array(MEMORY_SIZE);
const registers = new Uint16Array(8);
let pc = 0x3000;
let cond = 2; // ZRO
let running = false;
let stepCount = 0;
let runInterval: any = null;
const inputQueue: string[] = [];

function postSnapshot() {
  const msg: WorkerToMainMessage = {
    type: 'CPU_SNAPSHOT',
    registers: Array.from(registers),
    pc,
    cond,
    running,
    stepCount,
  };
  self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const data = event.data;

  switch (data.type) {
    case 'INIT': {
      // In the future: load WebAssembly binary here
      // const wasm = await WebAssembly.instantiateStreaming(fetch('/lc3.wasm'));
      self.postMessage({ type: 'TERMINAL_OUTPUT', text: '[Worker Engine Initialized]\n' });
      break;
    }

    case 'LOAD_PROGRAM': {
      memory.fill(0);
      data.words.forEach((word, idx) => {
        memory[(data.origin + idx) & 0xFFFF] = word & 0xFFFF;
      });
      registers.fill(0);
      pc = data.origin;
      cond = 2;
      running = true;
      stepCount = 0;
      postSnapshot();
      break;
    }

    case 'STEP': {
      if (!running) return;
      // Step single instruction
      stepCount++;
      postSnapshot();
      break;
    }

    case 'RUN': {
      if (runInterval) clearInterval(runInterval);
      running = true;
      const delay = Math.max(2, Math.floor(1000 / data.clockSpeedHz));
      runInterval = setInterval(() => {
        if (!running) {
          clearInterval(runInterval);
          return;
        }
        stepCount++;
        // Batch post message every few steps or on I/O
        postSnapshot();
      }, delay);
      break;
    }

    case 'PAUSE': {
      if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
      }
      postSnapshot();
      break;
    }

    case 'RESET': {
      if (runInterval) clearInterval(runInterval);
      registers.fill(0);
      pc = 0x3000;
      cond = 2;
      running = true;
      stepCount = 0;
      postSnapshot();
      break;
    }

    case 'SEND_KEY': {
      inputQueue.push(data.char);
      break;
    }
  }
};
