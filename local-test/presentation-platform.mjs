import path from 'node:path';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./PowerPoint-Windows.ps1',import.meta.url));
export function windowsPresentationCommand(mode,input,output,env=process.env){
 const exe=env.POWERSHELL_PATH||path.win32.join(env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 return{command:exe,args:['-STA','-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Mode',mode,'-InputPath',input,...(output?['-OutputDirectory',output]:[])]};
}
export async function runWindowsPresentation(mode,input,output,exec,env=process.env){const task=windowsPresentationCommand(mode,input,output,env);return exec(task.command,task.args,{timeout:mode==='Validate'?15000:180000,maxBuffer:1024*1024,windowsHide:true});}
