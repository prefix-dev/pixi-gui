; Pixi GUI NSIS Installer Hooks
; This file is used by Tauri's NSIS bundler to add custom behavior to the installer.
; See: https://v2.tauri.app/reference/config/#nsisconfig

; After the main Pixi GUI application has been installed,
; also install the Pixi CLI package manager.
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing Pixi package manager..."
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -NoProfile -NonInteractive -Command "irm -useb https://pixi.sh/install.ps1 | iex"'
  Pop $0
  ${If} $0 == 0
    DetailPrint "Pixi package manager installed successfully."
  ${Else}
    DetailPrint "Note: Pixi CLI installation exited with code $0. You can install it manually from https://pixi.sh"
  ${EndIf}
!macroend
