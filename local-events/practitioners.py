"""Read only the public Common Ground practitioner directory."""
import json,re,time
from pathlib import Path
from urllib.request import Request,urlopen
_cache=None
_loaded=0

def get_practitioners():
    global _cache,_loaded
    if _cache is not None and time.monotonic()-_loaded<300:return _cache
    config=(Path(__file__).resolve().parent.parent/'js/supabase-client.js').read_text()
    url=re.search(r'const SUPABASE_URL = "([^"]+)"',config).group(1)
    key=re.search(r'const SUPABASE_ANON_KEY = "([^"]+)"',config).group(1)
    request=Request(url+'/rest/v1/counselors?select=id,name,photo&approved=eq.true&order=name.asc',headers={'apikey':key})
    try:
        with urlopen(request,timeout=10) as response:rows=json.load(response)
        if not isinstance(rows,list):raise ValueError()
        _cache=[{'id':r['id'],'name':r['name'],'photo':r.get('photo')} for r in rows]
        _loaded=time.monotonic();return _cache
    except Exception:raise ValueError('Could not load Common Ground practitioners. Check your connection and retry.') from None

def selected_hosts(ids):
    if not isinstance(ids,list) or not 1<=len(ids)<=8 or len(ids)!=len(set(ids)):raise ValueError('Select one to eight practitioners as hosts.')
    people={p['id']:p for p in get_practitioners()}
    if any(i not in people for i in ids):raise ValueError('Choose hosts from the current practitioner list.')
    return ', '.join(people[i]['name'] for i in ids)
