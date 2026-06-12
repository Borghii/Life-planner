Dim WshShell
Dim Fso
Dim BaseDir

Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")

BaseDir = Fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = BaseDir

' Inicia Life Planner en ventana propia sin consola
WshShell.Run "python """ & BaseDir & "\desktop_app.py""", 0, False

Set Fso = Nothing
Set WshShell = Nothing
