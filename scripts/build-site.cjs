// Publish only website assets. Credentials, tooling and database files stay out.
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'site-build');
const folders=['css','js','images','vendor','posts','events','donate'];
const files=['favicon.ico','favicon.svg','site.webmanifest','robots.txt','sitemap.xml'];
async function copy(source,target){
 const stat=await fs.lstat(source);
 if(stat.isSymbolicLink())throw Error('Unexpected symlink in website assets');
 if(stat.isDirectory()){
  await fs.mkdir(target,{recursive:true});
  for(const name of await fs.readdir(source)){
   if(name.startsWith('.')||name==='node_modules')continue;
   await copy(path.join(source,name),path.join(target,name));
  }
 }else await fs.copyFile(source,target);
}
async function build(){
 await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output);
 for(const name of await fs.readdir(root))if(name.endsWith('.html'))await copy(path.join(root,name),path.join(output,name));
 for(const name of [...folders,...files])await copy(path.join(root,name),path.join(output,name));
 console.log('Website built without local credentials or backend source.');
}
build().catch(()=>{console.error('Website build failed. Check required assets.');process.exitCode=1;});
