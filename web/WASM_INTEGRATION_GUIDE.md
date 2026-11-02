# LC-3 WebAssembly & Web Worker Integration Guide

This document defines the interface between the **C++ Systems Engine (`lc3.cpp`)** and the **React Frontend**.

---

## 1. C++ Refactoring Checklist (for Systems Lead)

In [`src/lc3.hpp`](file:///home/abel/LC3/src/lc3.hpp) and [`src/lc3.cpp`](file:///home/abel/LC3/src/lc3.cpp):

1. **Remove POSIX dependencies**:
   Remove `<termios.h>` and `select()` when compiling with Emscripten (`#ifndef __EMSCRIPTEN__`).
2. **Expose re-entrant API**:
   Instead of a blocking `while(running)` loop inside `cpu()`, expose discrete functions:
   ```cpp
   extern "C" {
       void wasm_init();
       void wasm_load_image(const uint16_t* buffer, int origin, int length);
       int  wasm_step();             // executes 1 instruction, returns running status (0 or 1)
       void wasm_reset();
       uint16_t wasm_get_reg(int r); // r: 0 to 7
       uint16_t wasm_get_pc();
       uint16_t wasm_get_cond();
       uint16_t wasm_read_mem(uint16_t addr);
       void wasm_write_mem(uint16_t addr, uint16_t val);
       void wasm_push_key(uint8_t ascii);
       // Optional: callback to JS for output characters:
       // void emscripten_out_char(uint8_t c);
   }
   ```

---

## 2. Compilation Command (Emscripten)

```bash
em++ -O3 -std=c++20 \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS="['_wasm_init','_wasm_load_image','_wasm_step','_wasm_reset','_wasm_get_reg','_wasm_get_pc','_wasm_get_cond','_wasm_read_mem','_wasm_write_mem','_wasm_push_key']" \
  -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue']" \
  src/lc3.cpp -o public/lc3.js
```

---

## 3. Web Worker Architecture

To keep the UI responsive at 60 FPS while the VM runs at hundreds of instructions per second, the compiled Wasm engine runs in a dedicated background worker (`src/worker/lc3.worker.ts`).

The worker receives:
- `STEP`: calls `wasm_step()`, posts snapshot back
- `RUN`: runs an execution loop throttled with `postMessage` batching
- `SEND_KEY`: queues key into C++ `wasm_push_key()`
- `LOAD_PROGRAM`: loads binary words into VM memory

The frontend Zustand store (`src/store/useLc3Store.ts`) is designed so that calling `worker.postMessage()` can immediately replace the mock execution functions without changing a single React UI component.
