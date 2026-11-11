// Exemplos:
// node scripts/smoke-test.mjs https://SEU-BACKEND.herokuapp.com
// node scripts/smoke-test.mjs https://SEU-FRONTEND.vercel.app
const root=process.argv[2];
if(!root){console.error('Informe a URL HTTPS do backend Heroku ou frontend Vercel');process.exit(2);}
let url;
try{url=new URL(root);}catch{console.error('URL inválida');process.exit(2);}
if(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password){console.error('Use somente a origem HTTPS, sem caminho ou credenciais');process.exit(2);}
for(const path of ['/api/health','/api/ready']){
 const target=new URL(path,url);
 try{
  const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(9000),headers:{Accept:'application/json'}});
  const body=await response.json();
  const ok=response.ok&&body?.service==='motopro-api'&&
   (path==='/api/health'?body.status==='ok':body.status==='ready'&&body.databaseConnected===true);
  console.log(path,ok?'OK':'FALHA',response.status,{status:body.status,service:body.service,databaseConnected:body.databaseConnected??null});
  if(!ok)process.exitCode=1;
 }catch(e){console.error(path,'FALHA',e instanceof Error?e.message:String(e));process.exitCode=1;}
}
