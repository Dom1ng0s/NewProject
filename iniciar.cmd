@echo off
REM Abre o Claude Code nesta pasta com o canal do Telegram (se configurado)
REM e impede o Windows de hibernar enquanto a janela estiver aberta.
cd /d "%~dp0"
title Claude Code - %~n0
powershell -NoProfile -Command "$s = Add-Type -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f);' -Name P -Namespace W -PassThru; $null = $s::SetThreadExecutionState(0x80000001); if (Test-Path \"$env:USERPROFILE\.claude\channels\telegram\.env\") { claude --channels plugin:telegram@claude-plugins-official } else { claude }"
