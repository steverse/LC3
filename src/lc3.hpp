// zero ai used

//  blueprint

#pragma once

#include <cstdio>
#include <cstdint>
#include <csignal>
#include <cstdlib>
#include <unistd.h>
#include <fcntl.h>
#include <termios.h>
#include <iostream>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/mman.h>
#include <sys/select.h>

constexpr int MEMORY_SIZE = 1 << 16;

class lc3
{
    // have to impose boundary protection and intilize the registers
public:
    // STORAGE

    uint16_t memory[MEMORY_SIZE] = {0}; // memory array

    // registers
    enum
    {

        R_R0 = 0,
        R_R1,
        R_R2,
        R_R3,
        R_R4,
        R_R5,
        R_R6,
        R_R7,
        R_PC,   // program counter
        R_COND, // condition flags
        R_COUNT // automatically counts the number of registers
    };

    uint16_t reg[R_COUNT] = {0}; // register array

    // CPU

    // sign extend
    uint16_t sign_extend(uint16_t x, int bit_count);

    // falg update
    void update_flags(uint16_t r);

    // cpu  (execution loop)
    void cpu(int argc, const char *argv[]);

    //  swap to account for Endianness
    uint16_t swap(uint16_t x);

    // read the  image file (.obj)
    int read_image(char const *image_path);

    // reading image file into memory
    void read_image_file(FILE *file);

    void memory_write(uint16_t adress, uint16_t val);

    static void handle_interrupt(int signal);

    struct termios original_tio;
    uint16_t memory_read(uint16_t adress);
    void disable_input_buffering();
    void restore_input_buffering();
    uint16_t check_key();
    void step(); // webassm

    // Opcodes

    enum
    {
        OP_BR = 0, // branch
        OP_ADD,    // add
        OP_LD,     // load
        OP_ST,     // store
        OP_JSR,    // jump register
        OP_AND,    // bitwise and
        OP_LDR,    // load register
        OP_STR,    // store register
        OP_RTI,    // unused
        OP_NOT,    // bitwise not
        OP_LDI,    // load indirect
        OP_STI,    // store indirect
        OP_JMP,    // jump
        OP_RES,    // reserved (unused)
        OP_LEA,    // load effective address
        OP_TRAP    // execute trap
    };

    // conditional flags
    //  enum is a compile-time literal so no overhead
    enum
    {

        flag_pos = 1 << 0,
        flag_zro = 1 << 1,
        flag_neg = 1 << 2
    };

    enum
    {
        MR_KBSR = 0xFE00,
        MR_KBDR = 0xFE02
    };

    enum
    {
        TRAP_GETC = 0x20,
        TRAP_OUT = 0x21,
        TRAP_PUTS = 0x22,
        TRAP_IN = 0x23,
        TRAP_PUTSP = 0x24,
        TRAP_HALT = 0x25
    };

    int running = 1;
};
