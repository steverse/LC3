// active sillcion
#include "lc3.hpp"

lc3 *running_vm = nullptr;
// sign extend (2's complememt)
uint16_t lc3::sign_extend(uint16_t x, int bit_size)
{

    if (x >> (bit_size - 1) & 1)
    {

        x = (x | (0xFFFFU << bit_size));
    }

    else
    {
        x = 0xFFFFU & x;
    }
    return x;
}

void lc3::update_flags(uint16_t r)
{
    if (reg[r] == 0)
    {

        reg[R_COND] = flag_zro;
    }

    else if (reg[r] >> 15 & 1)
    {

        reg[R_COND] = flag_neg;
    }

    else
    {

        reg[R_COND] = flag_pos;
    }
}

template <unsigned op>
static void ins(lc3 *vm, uint16_t instr)
{
    uint16_t r0, r1, r2, imm5, imm5_flag;
    uint16_t pc_plus_off, base_plus_off;

    constexpr uint16_t opbit = 1 << op;

    if (0x4EEE & opbit)
    {
        r0 = (instr >> 9) & 0x7;
    }
    if (0x12F3 & opbit)
    {
        r1 = (instr >> 6) & 0x7;
    }
    if (0x0022 & opbit)
    {
        imm5_flag = (instr >> 5) & 0x1;

        if (imm5_flag)
        {
            imm5 = vm->sign_extend(instr & 0x1F, 5);
        }
        else
        {
            r2 = instr & 0x7;
        }
    }
    if (0x00C0 & opbit)
    {
        base_plus_off = vm->reg[r1] + vm->sign_extend(instr & 0x3F, 6);
    }
    if (0x4C0D & opbit)
    {
        pc_plus_off = vm->reg[lc3::R_PC] + vm->sign_extend(instr & 0x1FF, 9);
    }

    if (0x0001 & opbit) // BR
    {
        uint16_t cond = (instr >> 9) & 0x7;
        if (cond & vm->reg[lc3::R_COND])
        {
            vm->reg[lc3::R_PC] = pc_plus_off;
        }
    }

    if (0x0002 & opbit) // ADD
    {
        if (imm5_flag)
        {
            vm->reg[r0] = vm->reg[r1] + imm5;
        }
        else
        {
            vm->reg[r0] = vm->reg[r1] + vm->reg[r2];
        }
    }

    if (0x0020 & opbit) // AND
    {
        if (imm5_flag)
        {
            vm->reg[r0] = vm->reg[r1] & imm5;
        }
        else
        {
            vm->reg[r0] = vm->reg[r1] & vm->reg[r2];
        }
    }

    if (0x0200 & opbit) // Not
    {
        vm->reg[r0] = ~vm->reg[r1];
    }

    if (0x1000 & opbit) // JMP
    {
        vm->reg[lc3::R_PC] = vm->reg[r1];
    }

    if (0x0010 & opbit) // JSR
    {
        uint16_t long_flag = ((instr >> 11) & 1);
        vm->reg[lc3::R_R7] = vm->reg[lc3::R_PC];

        if (long_flag)
        {
            pc_plus_off = vm->reg[lc3::R_PC] + vm->sign_extend(instr & 0x7FF, 11);
            vm->reg[lc3::R_PC] = pc_plus_off;
        }

        else
        {
            vm->reg[lc3::R_PC] = vm->reg[r1];
        }
    }

    if (0x0004 & opbit)
    {
        vm->reg[r0] = vm->memory_read(pc_plus_off);
    } // Ld
    if (0x0400 & opbit)
    {
        vm->reg[r0] = vm->memory_read(vm->memory_read(pc_plus_off));
    } // ldi
    if (0x0040 & opbit)
    {
        vm->reg[r0] = vm->memory_read(base_plus_off);
    } // ldr
    if (0x4000 & opbit)
    {
        vm->reg[r0] = pc_plus_off;
    } // lea
    if (0x0008 & opbit)
    {
        vm->memory_write(pc_plus_off, vm->reg[r0]);
    } // st
    if (0x0800 & opbit)
    {
        vm->memory_write(vm->memory_read(pc_plus_off), vm->reg[r0]);
    } // sti
    if (0x0080 & opbit)
    {
        vm->memory_write(base_plus_off, vm->reg[r0]);
    } // str
    if (0x8000 & opbit) // trap
    {
        vm->reg[lc3::R_R7] = vm->reg[lc3::R_PC];

        switch (instr & 0xFF)
        {
        case lc3::TRAP_GETC:
        {
            char c = 0;
            read(STDIN_FILENO, &c, 1); // read directly from os kerenl's buffer replacment for cin(idk error)
            vm->reg[lc3::R_R0] = static_cast<uint16_t>(c);
            vm->update_flags(lc3::R_R0);
            break;
        }
        case lc3::TRAP_OUT:
        {
            std::cout << static_cast<char>(vm->reg[lc3::R_R0] & 0xFF) << std::flush;
            break;
        }
        case lc3::TRAP_PUTS:
        {
            uint16_t addr = vm->reg[lc3::R_R0];
            while (addr < MEMORY_SIZE && vm->memory[addr] != 0)
            {
                std::cout << static_cast<char>(vm->memory[addr]);
                addr++;
            }
            std::cout << std::flush;
            break;
        }

        case lc3::TRAP_IN:
        {
            std::cout << "Enter a character: " << std::flush;
            char c = 0;
            read(STDIN_FILENO, &c, 1);
            std::cout << c << std::flush;
            vm->reg[lc3::R_R0] = static_cast<uint16_t>(c);
            vm->update_flags(lc3::R_R0);
            break;
        }
        case lc3::TRAP_PUTSP:
        {
            uint16_t addr = vm->reg[lc3::R_R0];
            while (addr < MEMORY_SIZE && vm->memory[addr] != 0)
            {
                char c1 = (vm->memory[addr]) & 0xFF;
                std::cout << c1;
                char c2 = (vm->memory[addr]) >> 8;
                if (c2)
                    std::cout << c2;
                addr++;
            }
            std::cout << std::flush;
            break;
        }
        case lc3::TRAP_HALT:
        {
            std::cout << "\n-- HALT EXECUTED --\n"
                      << std::flush;
            vm->running = 0;
            break;
        }
        default:
            break;
        }
    }

    if (0x4666 & opbit)

    {
        vm->update_flags(r0);
    }
}

static void (*op_table[16])(lc3 *, uint16_t) =
    {
        ins<0>, ins<1>, ins<2>, ins<3>,
        ins<4>, ins<5>, ins<6>, ins<7>,
        nullptr, ins<9>, ins<10>, ins<11>,
        ins<12>, nullptr, ins<14>, ins<15>}; // array that holds pointers to fncs

void lc3::cpu(int argc, const char *argv[])

{
    if (argc < 2)
    {

        throw std::invalid_argument("lc3 [image_file not found]"); // a vm should never forcefully terminate a host process
    }

    for (int j = 1; j < argc; j++)
    {
        if (!read_image(argv[j]))
        {
            throw std::runtime_error(std::string("Unable to load ") + argv[j]);
        }
    }

    reg[R_COND] = flag_neg;

    enum
    {
        PC_START = 0x3000
    };
    reg[R_PC] = PC_START;
    running_vm = this;
    std::signal(SIGINT, lc3::handle_interrupt);
    disable_input_buffering();

    while (running)
    {
        // fetch
        uint16_t instr = memory_read(reg[R_PC]++);
        uint16_t op = instr >> 12;

        if (op_table[op] != nullptr)
        {
            op_table[op](this, instr);
        }
        else
        {
            running = 0;
        }
    }
    restore_input_buffering();
}

uint16_t lc3::swap(uint16_t x)
{

    return (x << 8) | (x >> 8);
}

int lc3::read_image(char const *image_path)
{
    FILE *file = fopen(image_path, "rb");
    if (!file)
        return 0;
    else
        read_image_file(file);
    fclose(file);
    return 1;
}

void lc3::read_image_file(FILE *file)
{
    uint16_t orgin;
    if (fread(&orgin, sizeof(orgin), 1, file) != 1) // reads count of elements found
    {
        throw std::runtime_error("Corrupted or empty image file ");
    }
    orgin = swap(orgin);

    uint16_t max_cap = MEMORY_SIZE - orgin;
    uint16_t *p = memory + orgin; // advances the pointer by origin elements — not origin bytes  (also note pointer decay)

    size_t read = fread(p, sizeof(u_int16_t), max_cap, file);

    while (read-- > 0)
    {
        *p = swap(*p);
        ++p;
    }
}

void lc3::memory_write(uint16_t address, uint16_t val)
{
    memory[address] = val;
}

uint16_t lc3::memory_read(uint16_t address)
{
    if (address == MR_KBSR)
    {
        if (check_key())
        {
            memory[MR_KBSR] = 1 << 15; // Set ready bit, but DO NOT consume key yet
        }
        else
        {
            memory[MR_KBSR] = 0;
        }
    }
    else if (address == MR_KBDR)
    {
        if (check_key())
        {
            memory[MR_KBSR] = 0;
            char c = 0;
            read(STDIN_FILENO, &c, 1); // Reads directly from the POSIX file descriptor
            memory[MR_KBDR] = static_cast<uint16_t>(c);
        }
        else
        {
            memory[MR_KBDR] = 0;
        }
    }
    return memory[address];
}

void lc3::disable_input_buffering()
{
    tcgetattr(STDIN_FILENO, &original_tio);
    struct termios new_tio = original_tio;
    new_tio.c_lflag &= ~(ICANON | ECHO);
    new_tio.c_cc[VMIN] = 1;  // Guarantee blocking until 1 char is typed
    new_tio.c_cc[VTIME] = 0; // No timeout
    tcsetattr(STDIN_FILENO, TCSANOW, &new_tio);
}

void lc3::restore_input_buffering()
{
    tcsetattr(STDIN_FILENO, TCSANOW, &original_tio);
}

uint16_t lc3::check_key()
{
    fd_set readfds;
    FD_ZERO(&readfds);
    FD_SET(STDIN_FILENO, &readfds);

    struct timeval timeout;
    timeout.tv_sec = 0;
    timeout.tv_usec = 0;
    return select(STDIN_FILENO + 1, &readfds, nullptr, nullptr, &timeout) > 0;
}

void lc3::handle_interrupt(int signal)
{
    if (running_vm)
    {
        running_vm->restore_input_buffering();
        running_vm->running = 0;
    }
    std::printf("\n-- Execution Interrupted --\n");
}

void lc3::step()
{
    if (!running)
        return;

    uint16_t instr = memory_read(reg[R_PC]++);
    uint16_t op = instr >> 12;

    if (op_table[op] != nullptr)
    {
        op_table[op](this, instr);
    }
    else
    {
        running = 0;
    }
}