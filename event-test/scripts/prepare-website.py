"""Prepare only the isolated test project. Production is accessed with public GET requests.
Run from the repository root. Credentials stay outside Git and are never printed.
"""
import json,os,re,sys,urllib.request,urllib.parse,urllib.error,hashlib
import psycopg
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
TEST='eicpgkmajosuhrqtrgrf'
PROD='plgilmcclpldcjzkepbp'
BASE='https://'+TEST+'.supabase.co'
SITE='https://common-ground-test.netlify.app'
CONFIG=Path.home()/'.config/common-ground'
PAT=(CONFIG/'supabase-access-token').read_text().strip()
def request(url,method='GET',data=None,headers=None,raw=False):
 if PROD in url:assert method=='GET','Production writes are forbidden'
 body=data if isinstance(data,bytes) else json.dumps(data).encode() if data is not None else None
 h={'Content-Type':'application/json',**(headers or {})}
 req=urllib.request.Request(url,data=body,method=method,headers=h)
 try:
  with urllib.request.urlopen(req,timeout=60) as r:
   content=r.read()
   return (content,r.headers.get('Content-Type','application/octet-stream')) if raw else json.loads(content) if content else None
 except urllib.error.HTTPError as e:
  # Error bodies can contain sensitive values; do not print them.
  raise RuntimeError(f'{method} {urllib.parse.urlparse(url).path}: HTTP {e.code}') from None
def management(path,method='GET',data=None):
 assert path.startswith('projects/'+TEST+'/')
 return request('https://api.supabase.com/v1/'+path,method,data,{'Authorization':'Bearer '+PAT})
def sql(query):return management('projects/'+TEST+'/database/query','POST',{'query':query})
keys=management('projects/'+TEST+'/api-keys')
SERVICE=next(k['api_key'] for k in keys if k.get('name')=='service_role')
ANON=next(k['api_key'] for k in keys if k.get('name')=='anon')
AUTH={'apikey':SERVICE,'Authorization':'Bearer '+SERVICE}
# Public frontend configuration; deliberately contains no privileged key.
(ROOT/'event-test/site/test-config.json').write_text(json.dumps({'url':BASE,'anonKey':ANON},indent=2)+'\n')
if '--schema' in sys.argv:
 files=['schema.sql','reviews.sql','signup-requests.sql','feedback.sql','private-feedback.sql','journal.sql','events.sql','event-details.sql','event-host-editing.sql']
 chunks=[]
 for name in files:
  s=(ROOT/'supabase'/name).read_text()
  s=re.sub(r'^drop table if exists public.feedback cascade;\s*','',s,flags=re.M)
  s=s.replace('create table public.feedback (','create table if not exists public.feedback (')
  s=re.sub(r'^begin;\s*|^commit;\s*','',s,flags=re.M)
  s=re.sub(r'(create policy "([^"]+)"\s+on ([\w.]+))',lambda m:f'drop policy if exists "{m[2]}" on {m[3]};\n'+m[1],s,flags=re.I)
  chunks.append('-- Source: supabase/'+name+'\n'+s)
 grants='''grant select,insert,update,delete on public.counselors to authenticated;
grant select on public.counselors to anon;
grant select,insert on public.reviews to anon,authenticated;
grant insert on public.signup_requests to anon,authenticated;
grant select,insert,delete on public.feedback to authenticated;
grant insert on public.private_feedback to authenticated;
grant usage on schema public to event_tool_app;
grant select on public.counselors to event_tool_app;
notify pgrst, 'reload schema';'''
 migration='-- Test website bootstrap. Apply only to '+TEST+'.\nbegin;\n'+'\n'.join(chunks)+grants+'\ncommit;\n'
 (ROOT/'event-test/migrations/001-website.sql').write_text(migration)
 sql(migration)
 print('Test website schema and row-level access policies ready.',flush=True)
if '--content' in sys.argv:
 prodconfig=(ROOT/'js/supabase-client.js').read_text()
 prodkey=re.search(r'const SUPABASE_ANON_KEY = "([^"]+)"',prodconfig)[1]
 def public(table,filter):return request('https://'+PROD+'.supabase.co/rest/v1/'+table+'?select=*&'+filter,headers={'apikey':prodkey})
 profiles=public('counselors','approved=eq.true')
 posts=public('journal_posts','status=eq.published')
 existing_posts={p['id'] for p in request(BASE+'/rest/v1/journal_posts?select=id',headers=AUTH)}
 reviews=public('reviews','approved=eq.true')
 events=public('event_links','published=eq.true')
 print('Public content:',{k:len(v) for k,v in [('profiles',profiles),('posts',posts),('reviews',reviews),('event_links',events)]},flush=True)
 users=request(BASE+'/auth/v1/admin/users?page=1&per_page=100',headers=AUTH)['users']
 admin=next((u for u in users if u.get('email','').lower()=='nicolomantini@gmail.com'),None)
 if not admin:
  admin=request(BASE+'/auth/v1/admin/users','POST',{'email':'nicolomantini@gmail.com','password':(CONFIG/'test-admin-password').read_text().strip(),'email_confirm':True},AUTH)
 uid=admin['id']
 nico=next((p for p in profiles if p['name'].strip().lower() in ['nico mantini','nicolo mantini','nicolò mantini']),None)
 if not nico:
  candidates=[p for p in profiles if 'mantini' in p['name'].lower()]
  assert len(candidates)==1,'Identify the test administrator profile before copying ownership.'
  nico=candidates[0]
 copied={}
 def media(url):
  if not url or PROD+'.supabase.co/storage/v1/object/public/' not in url:return url
  if url in copied:return copied[url]
  path=urllib.parse.urlparse(url).path.split('/storage/v1/object/public/',1)[1]
  bucket,old=path.split('/',1)
  assert bucket in ['photos','journal-covers','event-covers']
  data,ctype=request(url,raw=True)
  assert len(data)<=10485760
  newpath='copied-public/'+hashlib.sha256(old.encode()).hexdigest()[:24]+Path(old).suffix
  request(BASE+'/storage/v1/object/'+bucket+'/'+newpath,'POST',data,{**AUTH,'Content-Type':ctype,'x-upsert':'true'})
  copied[url]=BASE+'/storage/v1/object/public/'+bucket+'/'+newpath
  return copied[url]
 for p in profiles:
  p['user_id']=uid if p['id']==nico['id'] else None
  p['photo']=media(p.get('photo'))
 for p in posts:p['cover_url']=media(p.get('cover_url'))
 for e in events:
  e['user_id']=uid
  e['cover_url']=media(e.get('cover_url'))
 for table,rows in [('counselors',profiles),('journal_posts',posts),('reviews',reviews),('event_links',events)]:
  if rows:request(BASE+'/rest/v1/'+table+'?on_conflict=id','POST',rows,{**AUTH,'Prefer':'resolution=ignore-duplicates'})
 request(BASE+'/rest/v1/journal_editors?on_conflict=user_id','POST',{'user_id':uid},{**AUTH,'Prefer':'resolution=ignore-duplicates'})
 # The publication trigger stamps new posts; restore source dates only for new snapshot rows.
 dates=[{k:p[k] for k in ['id','published_at','created_at','updated_at']} for p in posts if p['id'] not in existing_posts]
 if dates:
  encoded=json.dumps(dates).replace("'","''")
  sql("begin; alter table public.journal_posts disable trigger prepare_journal_post; update public.journal_posts p set published_at=s.published_at,created_at=s.created_at,updated_at=s.updated_at from jsonb_to_recordset('"+encoded+"'::jsonb) as s(id uuid,published_at timestamptz,created_at timestamptz,updated_at timestamptz) where p.id=s.id; alter table public.journal_posts enable trigger prepare_journal_post; commit;")
 # Preserve the existing event tool's IDs, bookings and host assignments.
 db=json.loads((CONFIG/'event-test-database.json').read_text())
 assert db['project_ref']==TEST and db['user']=='event_tool_app.'+TEST
 with psycopg.connect(host=db['host'],port=6543,user=db['user'],password=db['password'],dbname='postgres',sslmode='verify-full',sslrootcert=str(ROOT/'event-test/certificates/supabase-root.crt')) as conn:
  conn.execute("update event_tool.practitioners p set name=c.name,photo=c.photo from public.counselors c where p.id=c.id::text")
 print('Copied',len(copied),'uploaded images. Separate test practitioner account linked; other production accounts were not copied.',flush=True)
if '--auth' in sys.argv:
 management('projects/'+TEST+'/config/auth','PATCH',{'site_url':SITE,'uri_allow_list':SITE+'/auth.html,http://127.0.0.1:8012/auth.html','disable_signup':True})
 print('Test authentication redirects configured; public sign-up remains disabled.',flush=True)
