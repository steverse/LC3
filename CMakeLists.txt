cmake_minimum_required(VERSION 3.15...4.1)
project(x14_lc3 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
#Define the virtual target 
add_library(lc3_core STATIC src/lc3.cpp) #interphase vs dynamic vs static

#Map the virtual target to the 'src' directory (linking/shows the preprocessor where to look for  when it sees an unknown #include directory eg #include<lc3.hpp>)
target_include_directories(lc3_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)



#  Download Catch2 directly from GitHub
include(FetchContent)
FetchContent_Declare(
  Catch2
  GIT_REPOSITORY https://github.com/catchorg/Catch2.git
  GIT_TAG        v2.13.9
)
FetchContent_MakeAvailable(Catch2)

#  Assemble the test binary target and link it
add_executable(unit_tests tests/test_main.cpp)
target_link_libraries(unit_tests PRIVATE lc3_core Catch2)


# Add the main executable target (point src/main.cpp to your actual entry point)
add_executable(lc3 src/main.cpp)

# Link the core VM logic
target_link_libraries(lc3 PRIVATE lc3_core)
