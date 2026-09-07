#include "lc3.hpp"
#include <iostream>
#include <exception>

int main(int argc, const char *argv[])
{
    try
    {
        lc3 vm;
        vm.cpu(argc, argv);
    }
    catch (const std::exception &e)
    {
        std::cerr << "VM Error: " << e.what() << '\n';
        return 1;
    }

    return 0;
}