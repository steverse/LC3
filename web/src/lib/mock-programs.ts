export interface DemoProgram {
  name: string;
  description: string;
  origin: number;
  code: number[];
}

export const HELLO_WORLD: DemoProgram = {
  name: 'Hello World',
  description: 'Prints "Hello, World!" using LEA + PUTS + HALT.',
  origin: 0x3000,
  code: [
    0xE004, // LEA R0, x3005
    0xF022, // TRAP PUTS
    0xF025, // HALT
    0x0000, // (padding)
    0x0000, // (padding)
    0x0048, // 'H'
    0x0065, // 'e'
    0x006C, // 'l'
    0x006C, // 'l'
    0x006F, // 'o'
    0x002C, // ','
    0x0020, // ' '
    0x0057, // 'W'
    0x006F, // 'o'
    0x0072, // 'r'
    0x006C, // 'l'
    0x0064, // 'd'
    0x0021, // '!'
    0x000A, // '\n'
    0x0000, // null terminator
  ],
};

export const COUNTER: DemoProgram = {
  name: 'Counter (0 to 10)',
  description: 'Counts R1 from 0 to 10 using a loop with ADD and BR.',
  origin: 0x3000,
  code: [
    0x5260, // AND R1, R1, #0
    0x54A0, // AND R2, R2, #0
    0x14AA, // ADD R2, R2, #10
    0x1261, // ADD R1, R1, #1
    0x96FF, // NOT R3, R1
    0x16E1, // ADD R3, R3, #1
    0x16C2, // ADD R3, R3, R2
    0x03FB, // BRp x3003
    0xF025, // HALT
  ],
};

export const ADD_DEMO: DemoProgram = {
  name: 'ADD / AND / NOT Demo',
  description: 'Demonstrates arithmetic and logic instructions with visible register changes.',
  origin: 0x3000,
  code: [
    0x5020, // AND R0, R0, #0
    0x1027, // ADD R0, R0, #7
    0x1248, // ADD R1, R0, #8
    0x1401, // ADD R2, R0, R1
    0x9680, // NOT R3, R2
    0x590F, // AND R4, R2, #15
    0xF025, // HALT
  ],
};

export const ALL_PROGRAMS: DemoProgram[] = [HELLO_WORLD, COUNTER, ADD_DEMO];
