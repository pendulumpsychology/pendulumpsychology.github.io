@echo off
echo Enter the input file name (including the extension):
set /p input_file=

echo Enter the output file name (without the extension):
set /p output_file=

cwebp -quiet -q 80 "%input_file%" -o "%output_file%.webp"

echo Conversion completed.
pause
