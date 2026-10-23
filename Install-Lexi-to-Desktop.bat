@echo off
rem Puts a "Lexi.bat" launcher on your Desktop. Run this file ONCE from the Lexi folder (double-click).
rem The launcher opens this folder's index.html in your default browser, so keep the Lexi folder where it is.
setlocal
set "SITE=%~dp0index.html"
if not exist "%SITE%" (
  echo index.html was not found next to this file. Run it from inside the Lexi folder.
  pause
  exit /b 1
)
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESK=%%D"
if not defined DESK set "DESK=%USERPROFILE%\Desktop"
> "%DESK%\Lexi.bat" echo @echo off
>> "%DESK%\Lexi.bat" echo start "" "%SITE%"
if exist "%DESK%\Lexi.bat" (
  echo Done! "Lexi.bat" is now on your Desktop: %DESK%\Lexi.bat
  echo Double-click it to open Lexi.
) else (
  echo Could not create the file on the Desktop.
)
pause
