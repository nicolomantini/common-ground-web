import {mkdir,rm,cp,writeFile,readFile,readdir} from 'node:fs/promises';
import {join,extname} from 'node:path';
const site='https://common-ground-test.netlify.app';
const config=JSON.parse(await readFile('site/test-config.json','utf8'));
if(config.url!=='https://eicpgkmajosuhrqtrgrf.supabase.co'||!config.anonKey)throw Error('Missing isolated test browser configuration.');
if(!config.anonKey.startsWith('sb_publishable_')){const claims=JSON.parse(Buffer.from(config.anonKey.split('.')[1]||'', 'base64url').toString());if(claims.role!=='anon'||claims.ref!=='eicpgkmajosuhrqtrgrf')throw Error('Only the test public anonymous key may be published.');}
await rm('public',{recursive:true,force:true});await mkdir('public/event-tool',{recursive:true});
// Deliberate static allowlist: never copy the repository root, secrets or server code.
for(const dir of ['css','js','images','vendor','posts'])await cp('../'+dir,'public/'+dir,{recursive:true});
for(const entry of await readdir('..',{withFileTypes:true}))if(entry.isFile()&&(entry.name.endsWith('.html')||['favicon.ico','favicon.svg','site.webmanifest'].includes(entry.name)))await cp('../'+entry.name,'public/'+entry.name);
async function walk(dir){let result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);result.push(...(e.isDirectory()?await walk(p):[p]));}return result;}
const legacy="<script>if(location.pathname==='/'||location.pathname==='/index.html'){if(['event','booking','discover'].some(k=>new URLSearchParams(location.search).has(k))||/^#(calendar|event)\\//.test(location.hash))location.replace('/event-tool/'+location.search+location.hash);}</script>";
const banner='<aside class="test-environment" aria-label="Test environment"><strong>TEST WEBSITE</strong><span>Separate test database · Stripe test mode</span><nav><a href="/">Website</a><a href="/auth.html">Practitioner sign in</a><a href="/dashboard.html">Practitioner dashboard</a><a href="/event-tool/#calendar/events">Event dashboard</a></nav></aside>';
for(const file of await walk('public'))if(['.html','.js','.css','.webmanifest'].includes(extname(file))){let s=await readFile(file,'utf8');s=s.replaceAll('https://common-ground.space',site).replaceAll('https://luma.com/common-ground-space','/event').replaceAll('/events/','/event').replaceAll('Events on Luma','Manage test events');if(file.endsWith('dashboard.html'))s=s.replace('href="/event"','href="/event-tool/#calendar/events"');if(file.endsWith('.html'))s=s.replace('</head>','<link rel="stylesheet" href="/css/test-environment.css"><meta name="robots" content="noindex,nofollow">'+legacy+'</head>').replace(/<body([^>]*)>/,'<body$1>'+banner);await writeFile(file,s);}
// Explain the separate credentials only on the test build.
const authPath='public/auth.html';
let authPage=await readFile(authPath,'utf8');
authPage=authPage.replace('Log in with your own email and password.','Log in with your email and the separate test password provided by Nico.');
authPage=authPage.replace('Joining the group? Use the personal invitation sent to your email to choose a password. If it has not arrived, ask Nico to check your invitation.','Need your test login? Ask Nico for your individual test credentials. Your live website password is unchanged. To manage events, use the <a href="/event-tool/host.html">event host sign-in</a>.');
await writeFile(authPath,authPage);
await writeFile('public/js/supabase-client.js',`// Generated test-only browser configuration. Public key only.\nconst SUPABASE_URL=${JSON.stringify(config.url)};\nconst SUPABASE_ANON_KEY=${JSON.stringify(config.anonKey)};\nconst supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);\n`);
await writeFile('public/js/analytics.js','// Analytics is disabled on the isolated test site.\n');
await cp('site/home-events.js','public/js/home-events.js');
await writeFile('public/css/test-environment.css','.test-environment{background:#feeadd;color:#623c35;padding:10px 20px;font:13px/1.5 sans-serif;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #9e5d54}.test-environment nav{display:flex;gap:14px;flex-wrap:wrap}.test-environment a{color:inherit;text-decoration:underline}.test-environment strong{letter-spacing:.08em}@media(max-width:600px){.test-environment{gap:5px;text-align:center}.test-environment nav{justify-content:center;width:100%}}');
await mkdir('public/events',{recursive:true});
await writeFile('public/events/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;url=/event"><title>Test events · Common Ground</title></head><body><a href="/event">Explore test events</a></body></html>');
const files=['index.html','app.js','advanced.js','event-settings.js','style.css','dashboard.js','dashboard.css','visitor.js','visitor.css','guest.html','guest.js','guest.css','host.html','host.js','hosts.html','hosts.js'];
for(const file of files){let content=await readFile('../local-events/'+file,'utf8');
content=content.replaceAll('Open the link on this laptop; it expires in 15 minutes.','The link expires in 15 minutes.').replaceAll('Local test:','Test environment:').replaceAll('local test booking','test booking').replaceAll('LOCAL PROTOTYPE','TEST WEBSITE').replaceAll('Open your emailed link on this laptop while the local server is running.','Open your emailed link on any device to sign in.').replaceAll('Saved locally.','Saved in the test environment.').replaceAll('Drafts stay local.','Drafts stay in the test environment.').replaceAll('The local server queues previews when the dashboard is opened after this time.','The server prepares previews within five minutes of this time.').replaceAll('Visits to local registration previews only.','Visits to test registration pages only.').replaceAll('Previews are queued when the local dashboard refreshes; nothing is sent automatically.','Previews are prepared automatically; these reminder and feedback previews are not sent to guests.');
 content=content.replaceAll('/?','/event-tool/?').replaceAll('/#','/event-tool/#').replaceAll('/guest.html','/event-tool/guest.html').replaceAll('/host.html','/event-tool/host.html').replaceAll('/hosts.html','/event-tool/hosts.html').replaceAll('^\\/\\?event','^\\/event-tool\\/\\?event');
 if(file.endsWith('.html'))content=content.replace('<header>','<header><a href="/">← Website</a>');
 content=content.replaceAll('/event-tool/?discover=1','/event');
 await writeFile('public/event-tool/'+file,content);
}
for(const [src,dst] of [['vendor/quill/quill.js','quill.js'],['vendor/quill/quill.snow.css','quill.snow.css'],['js/journal-common.js','journal-common.js']])await cp('../'+src,'public/event-tool/'+dst);
await writeFile('public/robots.txt','User-agent: *\nDisallow: /\n');
// Fail closed if any deployed JavaScript could connect to the production project.
for(const file of await walk('public'))if(['.js','.html','.json'].includes(extname(file))){const s=await readFile(file,'utf8');if(s.includes('plgilmcclpldcjzkepbp'))throw Error('Production database reference in '+file);}
console.log('Full website and event tool built with isolated test configuration.');

await mkdir('public/event',{recursive:true});
await writeFile('public/event/index.html',(await readFile('site/event.html','utf8')).replace('<!-- TEST_BANNER -->',banner));
for(const f of ['events.css','events.js'])await cp('site/'+f,'public/event/'+f);
