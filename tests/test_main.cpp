#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>
#include "lc3.hpp"
#include <cstdio>
#include <sstream>
#include <string>
#include <unistd.h>

struct StdinRedirect
{
    int saved_fd;
    int pipefd[2];

    StdinRedirect()
    {
        saved_fd = dup(STDIN_FILENO);
        REQUIRE(pipe(pipefd) == 0);
        dup2(pipefd[0], STDIN_FILENO);
    }

    void feed(const char *data, size_t n)
    {
        REQUIRE(write(pipefd[1], data, n) == static_cast<ssize_t>(n));
    }

    ~StdinRedirect()
    {
        dup2(saved_fd, STDIN_FILENO);
        close(saved_fd);
        close(pipefd[0]);
        close(pipefd[1]);
    }
};

TEST_CASE("LC3 Core Hardware Allocation Validation", "[core]")
{
    lc3 machine;

    REQUIRE(lc3::R_COUNT == 10);

    machine.memory[0] = 0x1234;
    machine.memory[65535] = 0xABCD;

    REQUIRE(machine.memory[0] == 0x1234);
    REQUIRE(machine.memory[65535] == 0xABCD);
}

TEST_CASE("ALU Bitwise Math Validation", "[alu]")
{
    lc3 machine;

    uint16_t x = 0x0A;
    REQUIRE(machine.sign_extend(x, 4) == 0xFFFA);
    REQUIRE(machine.sign_extend(0x00, 5) == 0x0000);
    REQUIRE(machine.sign_extend(0x0F, 5) == 0x000F);
    REQUIRE(machine.sign_extend(0x10, 5) == 0xFFF0);
    REQUIRE(machine.sign_extend(0x1F, 5) == 0xFFFF);
}

TEST_CASE("Flag updation", "[flag]")
{
    lc3 machine;

    machine.reg[lc3::R_R0] = 0x0000;
    machine.update_flags(lc3::R_R0);
    REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_zro);

    machine.reg[lc3::R_R0] = 0x8000;
    machine.update_flags(lc3::R_R0);
    REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_neg);

    machine.reg[lc3::R_R0] = 0x00001;
    machine.update_flags(lc3::R_R0);
    REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_pos);
}

TEST_CASE("Endian Byte Swap Validation", "[pipeline]")
{
    lc3 machine;

    REQUIRE(machine.swap(0x1234) == 0x3412);
    REQUIRE(machine.swap(0x00FF) == 0xFF00);
    REQUIRE(machine.swap(0xABCD) == 0xCDAB);
}

TEST_CASE("Image Reading and File Loading", "[io]")
{
    lc3 machine;

    const char *test_filename = "test_image.obj";
    FILE *f = fopen(test_filename, "wb");
    REQUIRE(f != nullptr);

    uint16_t origin = machine.swap(0x3000);
    fwrite(&origin, sizeof(origin), 1, f);

    uint16_t sample_data = machine.swap(0x1234);
    fwrite(&sample_data, sizeof(sample_data), 1, f);
    fclose(f);

    REQUIRE(machine.read_image(test_filename) == 1);
    REQUIRE(machine.memory[0x3000] == 0x1234);

    remove(test_filename);
}

TEST_CASE("ALU & Data Processing", "[alu][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("ADD/AND Register Mode")
    {
        machine.reg[lc3::R_R1] = 5;
        machine.reg[lc3::R_R2] = 3;
        machine.memory[0x3000] = 0x1042; // ADD R0, R1, R2

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 8);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_pos);
    }

    SECTION("ADD/AND Immediate Mode")
    {
        machine.reg[lc3::R_R1] = 10;
        machine.memory[0x3000] = 0x107D; // ADD R0, R1, #-3

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 7);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_pos);
    }

    SECTION("NOT Inversion")
    {
        machine.reg[lc3::R_R1] = 0x00FF;
        machine.memory[0x3000] = 0x907F; // NOT R0, R1

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0xFF00);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_neg);
    }
}

TEST_CASE("Memory & Addressing Modes", "[memory][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("LD Direct Addressing")
    {
        machine.memory[0x3000] = 0x2005; // LD R0, PC+5
        machine.memory[0x3006] = 0x9999;

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0x9999);
    }

    SECTION("LDR Base+Offset Addressing")
    {
        machine.reg[lc3::R_R1] = 0x4000;
        machine.memory[0x3000] = 0x6045; // LDR R0, R1, #5
        machine.memory[0x4005] = 0x8888;

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0x8888);
    }

    SECTION("LEA Effective Address Loading")
    {
        machine.memory[0x3000] = 0xE005; // LEA R0, PC+5

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0x3006);
    }
}

TEST_CASE("Control Flow & Branching", "[control][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("BR Condition Code permutations")
    {
        machine.reg[lc3::R_COND] = lc3::flag_zro;
        machine.memory[0x3000] = 0x0404; // BRz PC+4

        machine.step();

        REQUIRE(machine.reg[lc3::R_PC] == 0x3005);
    }

    SECTION("JMP Absolute Jumps")
    {
        machine.reg[lc3::R_R1] = 0x5000;
        machine.memory[0x3000] = 0xC040; // JMP R1

        machine.step();

        REQUIRE(machine.reg[lc3::R_PC] == 0x5000);
    }

    SECTION("JSR Link Register (R7) Saving")
    {
        machine.memory[0x3000] = 0x480A; // JSR PC+10

        machine.step();

        REQUIRE(machine.reg[lc3::R_R7] == 0x3001);
        REQUIRE(machine.reg[lc3::R_PC] == 0x300B);
    }
}

TEST_CASE("System Calls & Memory-Mapped I/O", "[io][trap]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("TRAP_HALT Execution Toggle")
    {
        machine.memory[0x3000] = 0xF025; // TRAP_HALT

        // Redirect stdout to prevent Catch2 console clutter during testing
        std::stringstream buffer;
        std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());

        machine.step();

        std::cout.rdbuf(old_cout);

        REQUIRE(machine.running == 0);
    }
}

TEST_CASE("CPU Initialization Exceptions", "[exceptions]")
{
    lc3 machine;

    SECTION("Missing image argument throws invalid_argument")
    {
        const char *args[] = {"lc3-vm"};
        REQUIRE_THROWS_AS(machine.cpu(1, args), std::invalid_argument);
    }

    SECTION("Invalid file path throws runtime_error")
    {
        const char *args[] = {"lc3-vm", "fake_corrupted_file.obj"};
        REQUIRE_THROWS_AS(machine.cpu(2, args), std::runtime_error);
    }
}

TEST_CASE("Clean Loop Termination and Console Output", "[execution][trap]")
{
    lc3 machine;

    const char *test_filename = "halt_test.obj";
    FILE *f = fopen(test_filename, "wb");
    REQUIRE(f != nullptr);

    uint16_t origin = machine.swap(0x3000);
    fwrite(&origin, sizeof(origin), 1, f);

    uint16_t halt_instr = machine.swap(0xF025); // TRAP_HALT instruction
    fwrite(&halt_instr, sizeof(halt_instr), 1, f);
    fclose(f);

    std::stringstream buffer;
    std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());

    const char *args[] = {"lc3-vm", test_filename};
    machine.cpu(2, args);

    std::cout.rdbuf(old_cout);

    REQUIRE(machine.running == 0);
    REQUIRE(buffer.str().find("-- HALT EXECUTED --") != std::string::npos);

    remove(test_filename);
}

TEST_CASE("Bitwise AND Operation", "[alu][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("Register Mode")
    {
        machine.reg[lc3::R_R1] = 0x000F;
        machine.reg[lc3::R_R2] = 0x0007;
        machine.memory[0x3000] = 0x5042; // AND R0, R1, R2

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0x0007);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_pos);
    }

    SECTION("Immediate Mode Producing a Negative Result")
    {
        machine.reg[lc3::R_R1] = 0xFFFF;
        machine.memory[0x3000] = 0x5070; // AND R0, R1, #-16

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0xFFF0);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_neg);
    }

    SECTION("Immediate Mode Producing a Zero Result")
    {
        machine.reg[lc3::R_R1] = 0xFFFF;
        machine.memory[0x3000] = 0x5060; // AND R0, R1, #0

        machine.step();

        REQUIRE(machine.reg[lc3::R_R0] == 0x0000);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_zro);
    }
}

TEST_CASE("NOT Operation Edge Case", "[alu][opcodes][edge]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    machine.reg[lc3::R_R1] = 0xFFFF;
    machine.memory[0x3000] = 0x907F; // NOT R0, R1

    machine.step();

    REQUIRE(machine.reg[lc3::R_R0] == 0x0000);
    REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_zro);
}

TEST_CASE("Store Addressing Modes", "[memory][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("ST Direct Addressing")
    {
        machine.reg[lc3::R_R0] = 0xBEEF;
        machine.memory[0x3000] = 0x3005; // ST R0, PC+5

        machine.step();

        REQUIRE(machine.memory[0x3006] == 0xBEEF);
    }

    SECTION("STI Indirect Addressing")
    {
        machine.reg[lc3::R_R0] = 0xCAFE;
        machine.memory[0x3000] = 0xB005; // STI R0, PC+5
        machine.memory[0x3006] = 0x4000; // pointer stored at PC+5

        machine.step();

        REQUIRE(machine.memory[0x4000] == 0xCAFE);
    }

    SECTION("STR Base+Offset Addressing")
    {
        machine.reg[lc3::R_R1] = 0x4000;
        machine.reg[lc3::R_R0] = 0x1357;
        machine.memory[0x3000] = 0x7045; // STR R0, R1, #5

        machine.step();

        REQUIRE(machine.memory[0x4005] == 0x1357);
    }
}

TEST_CASE("LDI Indirect Addressing", "[memory][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    machine.memory[0x3000] = 0xA005; // LDI R0, PC+5
    machine.memory[0x3006] = 0x4000; // pointer
    machine.memory[0x4000] = 0x7777; // actual value

    machine.step();

    REQUIRE(machine.reg[lc3::R_R0] == 0x7777);
}

TEST_CASE("JSRR Register-Mode Subroutine Jump", "[control][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;
    machine.reg[lc3::R_R1] = 0x5000;
    machine.memory[0x3000] = 0x4040; // JSR R1 (long_flag == 0, i.e. JSRR)

    machine.step();

    REQUIRE(machine.reg[lc3::R_R7] == 0x3001);
    REQUIRE(machine.reg[lc3::R_PC] == 0x5000);
}

TEST_CASE("BR Condition Code Coverage", "[control][opcodes]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("BRn Taken When Negative Flag Set")
    {
        machine.reg[lc3::R_COND] = lc3::flag_neg;
        machine.memory[0x3000] = 0x0804; // BRn PC+4

        machine.step();

        REQUIRE(machine.reg[lc3::R_PC] == 0x3005);
    }

    SECTION("BRp Taken When Positive Flag Set")
    {
        machine.reg[lc3::R_COND] = lc3::flag_pos;
        machine.memory[0x3000] = 0x0204; // BRp PC+4

        machine.step();

        REQUIRE(machine.reg[lc3::R_PC] == 0x3005);
    }

    SECTION("Branch Not Taken When Condition Doesn't Match")
    {
        machine.reg[lc3::R_COND] = lc3::flag_pos;
        machine.memory[0x3000] = 0x0404; // BRz PC+4, but COND is pos

        machine.step();

        REQUIRE(machine.reg[lc3::R_PC] == 0x3001); // only the normal fetch increment
    }

    SECTION("BRnzp Unconditional Branch Always Taken")
    {
        machine.reg[lc3::R_COND] = lc3::flag_zro; // deliberately mismatched-looking flag
        machine.memory[0x3000] = 0x0E0A;          // BRnzp PC+10

        machine.step();

        REQUIRE(machine.reg[lc3::R_PC] == 0x300B);
    }
}

TEST_CASE("Unmapped Opcode Slots (RTI / RES)", "[control][opcodes][edge]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("RTI (opcode 8) Is Unimplemented and Halts Cleanly")
    {
        machine.memory[0x3000] = 0x8000;

        machine.step();

        REQUIRE(machine.running == 0);
    }

    SECTION("RES (opcode 13) Is Unimplemented and Halts Cleanly")
    {
        machine.memory[0x3000] = 0xD000;

        machine.step();

        REQUIRE(machine.running == 0);
    }
}

TEST_CASE("TRAP Output Routines", "[io][trap]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("TRAP_OUT Writes a Single Character")
    {
        machine.reg[lc3::R_R0] = 'A';
        machine.memory[0x3000] = 0xF021;

        std::stringstream buffer;
        std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());
        machine.step();
        std::cout.rdbuf(old_cout);

        REQUIRE(buffer.str() == "A");
    }

    SECTION("TRAP_PUTS Writes a Null-Terminated String")
    {
        machine.reg[lc3::R_R0] = 0x4000;
        machine.memory[0x4000] = 'H';
        machine.memory[0x4001] = 'i';
        machine.memory[0x4002] = 0;
        machine.memory[0x3000] = 0xF022;

        std::stringstream buffer;
        std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());
        machine.step();
        std::cout.rdbuf(old_cout);

        REQUIRE(buffer.str() == "Hi");
    }

    SECTION("TRAP_PUTSP Writes a Packed (Two-Chars-Per-Word) String")
    {
        machine.reg[lc3::R_R0] = 0x4000;
        machine.memory[0x4000] = static_cast<uint16_t>(('i' << 8) | 'H'); // low byte first
        machine.memory[0x4001] = 0;
        machine.memory[0x3000] = 0xF024;

        std::stringstream buffer;
        std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());
        machine.step();
        std::cout.rdbuf(old_cout);

        REQUIRE(buffer.str() == "Hi");
    }
}

TEST_CASE("TRAP Input Routines", "[io][trap]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;

    SECTION("TRAP_GETC Reads a Character Without Echoing")
    {
        machine.memory[0x3000] = 0xF020;

        StdinRedirect redirect;
        redirect.feed("Q", 1);

        std::stringstream buffer;
        std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());
        machine.step();
        std::cout.rdbuf(old_cout);

        REQUIRE(machine.reg[lc3::R_R0] == 'Q');
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_pos);
        REQUIRE(buffer.str().empty()); // GETC must not echo to stdout
    }

    SECTION("TRAP_IN Prompts, Echoes, and Reads a Character")
    {
        machine.memory[0x3000] = 0xF023;

        StdinRedirect redirect;
        redirect.feed("Z", 1);

        std::stringstream buffer;
        std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());
        machine.step();
        std::cout.rdbuf(old_cout);

        REQUIRE(machine.reg[lc3::R_R0] == 'Z');
        REQUIRE(buffer.str().find("Enter a character:") != std::string::npos);
        REQUIRE(buffer.str().find('Z') != std::string::npos);
    }
}

TEST_CASE("Unknown Trap Vector Falls Through Safely", "[io][trap][edge]")
{
    lc3 machine;
    machine.reg[lc3::R_PC] = 0x3000;
    machine.memory[0x3000] = 0xF0FF; // trap vector 0xFF matches no TRAP_* case

    machine.step();

    REQUIRE(machine.reg[lc3::R_R7] == 0x3001); // R7 is saved before the switch either way
    REQUIRE(machine.running == 1);             // default: case is a no-op, VM keeps running
}

TEST_CASE("Memory-Mapped I/O: KBSR / KBDR", "[io][mmio]")
{
    lc3 machine;
    StdinRedirect redirect;

    SECTION("KBSR Reports Not Ready With No Pending Input")
    {
        uint16_t status = machine.memory_read(lc3::MR_KBSR);
        REQUIRE((status & 0x8000) == 0);
    }

    SECTION("KBSR Reports Ready Without Consuming the Key")
    {
        redirect.feed("X", 1);

        uint16_t status = machine.memory_read(lc3::MR_KBSR);
        REQUIRE((status & 0x8000) != 0);

        // Reading KBSR again must not have consumed the pending byte.
        status = machine.memory_read(lc3::MR_KBSR);
        REQUIRE((status & 0x8000) != 0);
    }

    SECTION("KBDR Consumes the Key and Clears the Ready Bit")
    {
        redirect.feed("X", 1);

        uint16_t data = machine.memory_read(lc3::MR_KBDR);
        REQUIRE(data == 'X');

        uint16_t status = machine.memory_read(lc3::MR_KBSR);
        REQUIRE((status & 0x8000) == 0);
    }
}

TEST_CASE("sign_extend Boundary Coverage", "[alu][edge]")
{
    lc3 machine;

    // 9-bit immediates (BR/LD/ST/LDI/STI/LEA offsets)
    REQUIRE(machine.sign_extend(0x100, 9) == 0xFF00); // smallest 9-bit negative magnitude
    REQUIRE(machine.sign_extend(0x1FF, 9) == 0xFFFF); // all 9 bits set == -1
    REQUIRE(machine.sign_extend(0x0FF, 9) == 0x00FF); // largest 9-bit positive value

    // 11-bit immediate (JSR offset)
    REQUIRE(machine.sign_extend(0x400, 11) == 0xFC00);

    REQUIRE(machine.sign_extend(0x8000, 16) == 0x8000);
}

TEST_CASE("update_flags Boundary Values", "[flag][edge]")
{
    lc3 machine;

    SECTION("All Bits Set (-1) Is Negative")
    {
        machine.reg[lc3::R_R0] = 0xFFFF;
        machine.update_flags(lc3::R_R0);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_neg);
    }

    SECTION("Largest Positive Value (0x7FFF) Is Positive")
    {
        machine.reg[lc3::R_R0] = 0x7FFF;
        machine.update_flags(lc3::R_R0);
        REQUIRE(machine.reg[lc3::R_COND] == lc3::flag_pos);
    }
}

TEST_CASE("Image Loading Edge Cases", "[io][edge]")
{
    lc3 machine;

    SECTION("Missing File Returns 0 Without Throwing")
    {
        REQUIRE(machine.read_image("this_file_should_not_exist.obj") == 0);
    }

    SECTION("Empty File Throws runtime_error")
    {
        const char *filename = "empty_scratch.obj";
        FILE *f = fopen(filename, "wb");
        REQUIRE(f != nullptr);
        fclose(f);

        REQUIRE_THROWS_AS(machine.read_image(filename), std::runtime_error);

        remove(filename);
    }

    SECTION("Origin-Only File (No Program Data) Loads Successfully")
    {
        const char *filename = "origin_only.obj";
        FILE *f = fopen(filename, "wb");
        REQUIRE(f != nullptr);

        uint16_t origin = machine.swap(0x3000);
        fwrite(&origin, sizeof(origin), 1, f);
        fclose(f);

        REQUIRE(machine.read_image(filename) == 1);
        REQUIRE(machine.memory[0x3000] == 0); // nothing written beyond the header

        remove(filename);
    }

    SECTION("Origin at Top Memory Boundary (0xFFFF) Loads Without Overrun")
    {
        const char *filename = "top_boundary.obj";
        FILE *f = fopen(filename, "wb");
        REQUIRE(f != nullptr);

        uint16_t origin = machine.swap(0xFFFF);
        fwrite(&origin, sizeof(origin), 1, f);
        uint16_t data = machine.swap(0xBEEF);
        fwrite(&data, sizeof(data), 1, f);
        fclose(f);

        REQUIRE(machine.read_image(filename) == 1);
        REQUIRE(machine.memory[0xFFFF] == 0xBEEF);

        remove(filename);
    }

    SECTION("KNOWN ISSUE: Origin 0x0000 Silently Loads No Data")
    {
        const char *filename = "origin_zero.obj";
        FILE *f = fopen(filename, "wb");
        REQUIRE(f != nullptr);

        uint16_t origin = machine.swap(0x0000);
        fwrite(&origin, sizeof(origin), 1, f);
        uint16_t data = machine.swap(0x1234);
        fwrite(&data, sizeof(data), 1, f);
        fclose(f);

        REQUIRE(machine.read_image(filename) == 1);
        REQUIRE(machine.memory[0x0000] == 0); // documents the bug: should be 0x1234

        remove(filename);
    }
}

TEST_CASE("Integration: Multi-Instruction Program via cpu() Fetch-Execute Loop", "[execution][integration]")
{
    lc3 machine;

    machine.memory[0x3000] = 0x5040;
    machine.memory[0x3001] = 0x1025;
    machine.memory[0x3002] = 0x122A;
    machine.memory[0x3003] = 0x3202;
    machine.memory[0x3004] = 0xF025;
    machine.reg[lc3::R_PC] = 0x3000;

    std::stringstream buffer;
    std::streambuf *old_cout = std::cout.rdbuf(buffer.rdbuf());

    while (machine.running)
        machine.step();

    std::cout.rdbuf(old_cout);

    REQUIRE(machine.reg[lc3::R_R0] == 5);
    REQUIRE(machine.reg[lc3::R_R1] == 15);
    REQUIRE(machine.memory[0x3006] == 15);
    REQUIRE(machine.running == 0);
    REQUIRE(buffer.str().find("-- HALT EXECUTED --") != std::string::npos);
}
