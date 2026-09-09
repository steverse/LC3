# LC-3 Virtual Machine

A bare-metal, high-performance LC-3 architecture emulator engineered in C++20. The engine is designed with deterministic state management, O(1) instruction dispatch, and strict test-driven development to guarantee cycle-accurate execution. 






## What This Engine Does & How It Works

The engine is a fully self-contained virtual microcomputer(theoritically this can do everything a normal computer can do). It runs raw binary instructions without relying on an operating system, bridging the gap between high-level code and physical silicon. 

If you are new to low-level engineering, here is a quick breakdown of what this engine actually does and how it mimics physical hardware:

**Core Capabilities**
* **Executes Raw Machine Code:** It loads and runs compiled `.obj` binary files directly, similar to flashing firmware onto a microcontroller.
* **Full Instruction Set:** It processes the complete LC-3 architecture instructions, including bitwise math (ADD, AND, NOT), memory handling (LD, ST), and control flow (JMP, BR).
* **Real-Time I/O:** It handles live keyboard input and terminal output dynamically, bypassing standard C++ stream buffering for a more authentic hardware feel.
* **Cycle-by-Cycle Stepping:** You can pause the execution loop to inspect exactly what the CPU is doing after every single instruction cycle.

**How It Acts Like "Bare-Metal" Hardware**
* **Strict CPU Simulation:** Instead of using standard variables for math, it strictly uses 8 hardware registers (`R0-R7`), a Program Counter (`PC`), and condition flags (`N, Z, P`). Every operation physically mutates these states, just like a real Arithmetic Logic Unit (ALU).
* **Flat 64KB Memory:** There is no dynamic memory allocation (no `malloc` or `new`). Code and data share a rigid, pre-allocated array of 65,536 memory slots. 
* **Memory-Mapped Peripherals:** The keyboard doesn't use `std::cin`. Instead, it acts like physical hardware on a motherboard. It flips a "Ready Bit" at a specific memory address (`KBSR`) and drops the raw keystroke data into another (`KBDR`).
* **Low-Level Silicon Realities:** It manually handles the physical quirks of computer engineering, like two's complement sign-extension for negative binary numbers and endianness byte-swapping.



**A Quick Developer's Note** 

* This is my first decently large project, and honestly, I had to learn a *lot* of new and exciting things! But the part I'm most proud of? I built this on my own using online resources, only leaning on AI to clear my conceptual doubts. 
* Don't get me wrong AI is an amazing coding tool. But getting a bug fixed or a mechanism implemented with a single prompt just takes the joy out of the journey. It might be hyper-efficient, but I really think it does more harm than good in the long run if you're still learning.
* I'm not foolish enough to say *never* use AI for coding, but to me, as an S3 CSE student, diy seems to give a sense of pride and satisfaction. 


## Architectural Highlights
* **O(1) Instruction Dispatch:** Bypasses standard `switch` statement bottlenecks utilizing a static function-pointer array (`op_table`) combined with template metaprogramming (`template <unsigned op>`) for rapid opcode resolution.
* **POSIX Asynchronous I/O:** Employs raw UNIX file descriptors (`STDIN_FILENO`), `select()` multiplexing, and `termios` mutations to achieve true unbuffered, non-blocking hardware interfacing.
* **Deterministic Fault Handling:** Replaces volatile `std::exit()` hard crashes with strict `<stdexcept>` stack unwinding, guaranteeing memory safety and host environment stability upon fatal execution faults.
* **Mathematical TDD Verification:** Core ALU logic, register mutations, and memory state transitions are proven via Catch2 using direct in-memory hexadecimal injection—fully decoupled from disk I/O latency.
* **Cache-Aligned Memory:** Engineered with rigid bounds checking and zero-initialized arrays (`{0}`) to prevent undefined behavior and ensure predictable CPU booting.

## Build & Test Pipeline

This repository uses CMake to manage compilation and the Catch2 framework for unit testing. 

**1. Clone and Configure**
```bash
git clone [https://github.com/steverse/x14-engine.git](https://github.com/steverse/LC3.git)
cd LC3
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
```

**2. Execute the Test Suite**
Run the Catch2 assertions to mathematically verify the ALU, addressing modes, and control flow logic before execution.
```bash
cmake --build . --target unit_tests
./unit_tests
```

**3. Compile and Run the VM**
```bash
cmake --build . --target lc3
./lc3 path/to/payload.obj
```

## Internal Hardware Specifications

* **Memory Space:** 65,536 locations (16-bit addressability)
* **Registers:** 8 general-purpose registers (R0-R7), Program Counter (PC), Condition Codes (N, Z, P)
* **Supported Opcodes:** Complete LC-3 ISA (ADD, AND, NOT, BR, JMP, JSR, JSRR, LD, LDI, LDR, LEA, ST, STI, STR, TRAP)
* **Memory-Mapped I/O:** Keyboard Status Register (KBSR), Keyboard Data Register (KBDR)
