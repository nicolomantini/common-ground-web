"""Server-only Resend delivery, restricted to one configured test inbox."""
import json, os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

def load_config():
    path=Path(__file__).with_name('.env')
    if path.exists():
        for line in path.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:continue
            key,value=line.split('=',1)
            os.environ.setdefault(key.strip(),value.strip().strip('\"').strip("'"))

def allowed_recipients():
    return {x.strip().lower() for x in os.environ.get("EMAIL_TEST_ALLOWLIST", "").split(",") if x.strip()}

def automatic_enabled():
    return os.environ.get("EMAIL_AUTOMATIC", "off") == "test"

def send_preview(message, *, transactional=False):
    if os.environ.get('EMAIL_DELIVERY','off')!='test':raise ValueError('Email delivery is off. Set EMAIL_DELIVERY=test in the local .env file and restart.')
    key=os.environ.get('RESEND_API_KEY','')
    target=os.environ.get('EMAIL_TEST_RECIPIENT','').strip()
    if transactional:
        target=message['recipient'].strip().lower()
        if not automatic_enabled() or target not in allowed_recipients():raise ValueError('Automatic delivery is restricted to approved test addresses.')
    if not key or '@' not in target:raise ValueError('Configure RESEND_API_KEY and EMAIL_TEST_RECIPIENT, then restart.')
    body='Common Ground — local event test\n\n'+message['body']+'\n\nThis is a test delivery. No real payment was processed.'
    body=body.replace('No email was sent.','').replace('This is a local email preview.','').replace('Local preview only.','')
    payload={'from':'Common Ground <hello@common-ground.space>','to':[target],'subject':'[TEST] '+message['subject'],'text':body}
    request=Request('https://api.resend.com/emails',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':('cg-transactional-' if transactional else 'cg-local-')+message['id'],'User-Agent':'CommonGroundLocal/1.0'})
    try:
        with urlopen(request,timeout=15) as response:result=json.load(response)
    except HTTPError as error:
        status=error.code
        try:kind=json.loads(error.read()).get('name','')
        except Exception:kind=''
        if status==401:detail='The API key is invalid or lacks sending permission.'
        elif status==403:detail='Check that common-ground.space is verified and the API key can send from this domain.'
        elif status==429:detail='Resend is rate-limiting requests. Wait briefly before retrying.'
        elif status==409:detail='This email has already been submitted with different details. Create a new preview.'
        else:detail='Check the sender domain and recipient in Resend logs.'
        raise ValueError(f'Resend rejected the request (HTTP {status}). {detail}') from None
    except (URLError,TimeoutError):raise ValueError('Could not reach Resend. Check your connection and try again.') from None
    if not result.get('id'):raise ValueError('Resend did not return a message ID.')
    return result['id']
