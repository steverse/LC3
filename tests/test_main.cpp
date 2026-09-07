#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>
#include "lc3.hpp"
#include <cstdio>
#include <sstream>
#include <string>

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