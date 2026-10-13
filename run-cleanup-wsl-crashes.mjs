import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const powershell=path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const script=fileURLToPath(new URL('./cleanup-wsl-crash-files.ps1',import.meta.url));
const child=spawn(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{
  cwd:new URL('./',import.meta.url),stdio:'inherit',windowsHide:true
});
child.on('error',()=>{console.error('Could not launch the approved cleanup script');process.exitCode=1;});
child.on('exit',code=>process.exitCode=code||0);
