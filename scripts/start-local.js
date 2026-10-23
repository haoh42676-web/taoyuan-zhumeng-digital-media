import { spawn } from 'node:child_process';
const port=Number(process.env.PORT||8787),base=`http://localhost:${port}`;
const healthy=async()=>{try{return(await(await fetch(base+'/health',{signal:AbortSignal.timeout(1500)})).json()).app==='shushang-taoxiang';}catch{return false;}};
function open(){spawn('cmd.exe',['/c','start','',base+'/admin/'],{windowsHide:true,stdio:'ignore'}).unref();}
if(await healthy()){console.log('后台已经在运行。正在打开管理页面。');open();}
else{const child=spawn(process.execPath,['--env-file-if-exists=.env','server/index.js'],{stdio:'inherit',env:process.env,windowsHide:true});let exit=false;child.on('exit',code=>{exit=true;process.exitCode=code||0;});for(let i=0;i<40&&!exit;i++){if(await healthy()){open();break;}await new Promise(r=>setTimeout(r,750));}process.on('SIGINT',()=>child.kill('SIGINT'));}
