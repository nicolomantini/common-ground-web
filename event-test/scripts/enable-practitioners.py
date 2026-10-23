"""Provision the copied practitioners in the isolated test project, without email.

Credentials are saved outside the repository with owner-only permissions.
Existing accounts and their passwords are preserved on subsequent runs.
"""
import hashlib
import json
import os
import runpy
import secrets
from pathlib import Path

ctx = runpy.run_path(str(Path(__file__).with_name('prepare-website.py')))
request, BASE, AUTH, CONFIG = (ctx[k] for k in ('request', 'BASE', 'AUTH', 'CONFIG'))
import psycopg

members = {
    'Anneleen Rabijns': 'anneleen_rabijns@hotmail.com',
    'Carina Melcher': 'carinamelcher@bluewin.ch',
    'Domingos Frazão': 'domingos.frazao@gmail.com',
    'Irene Fraile-Fuente': 'ifrailef@posteo.net',
    'Luisa Amagliani': 'lu.amagliani@gmail.com',
    'Nicolò Mantini': 'nicolomantini@gmail.com',
    'Niels Neering': 'niels_neering@hotmail.com',
}
profiles = request(BASE + '/rest/v1/counselors?select=id,name,user_id&approved=eq.true', headers=AUTH)
assert {p['name'] for p in profiles} == set(members), 'Review the practitioner mapping first.'
users = request(BASE + '/auth/v1/admin/users?page=1&per_page=100', headers=AUTH)['users']
users = {u['email'].lower(): u for u in users}
vault = CONFIG / 'test-practitioner-passwords.json'
passwords = json.loads(vault.read_text()) if vault.exists() else {}
passwords.setdefault('nicolomantini@gmail.com', (CONFIG / 'test-admin-password').read_text().strip())

def private_write(path, text):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write(text)

db = json.loads((CONFIG / 'event-test-database.json').read_text())
assert db['project_ref'] == ctx['TEST'] and db['user'] == 'event_tool_app.' + ctx['TEST']
assert db['host'] == 'aws-0-eu-west-1.pooler.supabase.com'
with psycopg.connect(host=db['host'], port=6543, dbname='postgres', user=db['user'], password=db['password'],
                     sslmode='verify-full', sslrootcert=str(ctx['ROOT'] / 'event-test/certificates/supabase-root.crt')) as conn:
    for profile in profiles:
        email = members[profile['name']]
        if email not in users:
            passwords.setdefault(email, secrets.token_urlsafe(18))
            private_write(vault, json.dumps(passwords, indent=2) + '\n')
            users[email] = request(BASE + '/auth/v1/admin/users', 'POST',
                                   {'email': email, 'password': passwords[email], 'email_confirm': True}, AUTH)
        uid = users[email]['id']
        assert profile['user_id'] in (None, uid), 'Profile already belongs to another test account.'
        request(BASE + '/rest/v1/counselors?id=eq.' + profile['id'], 'PATCH', {'user_id': uid}, AUTH)
        existing = conn.execute('SELECT email FROM event_tool.host_accounts WHERE email=%s', (email,)).fetchone()
        if not existing:
            assert email in passwords, 'Existing practitioner needs a separate host password.'
            salt = secrets.token_hex(16)
            digest = hashlib.scrypt(passwords[email].encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
            conn.execute('INSERT INTO event_tool.host_accounts(email,practitioner_id,admin,password_hash,active) VALUES(%s,%s,0,%s,1)',
                         (email, profile['id'], salt + ':' + digest))

private_write(vault, json.dumps(passwords, indent=2) + '\n')
lines = ['COMMON GROUND — TEST LOGINS (PRIVATE)',
         'Share only each person’s own credentials with them.',
         'Profiles and blog: https://common-ground-test.netlify.app/auth.html',
         'Events: https://common-ground-test.netlify.app/event-tool/host.html',
         'These are separate test accounts. Production passwords are unchanged.',
         'The two dashboards currently have separate sign-ins. Changing a profile password does not change the event-host password.', '']
for name, email in members.items():
    lines.extend([name, email, 'Initial test password: ' + passwords.get(email, '(existing account; password unchanged)'), ''])
private_write(CONFIG / 'test-practitioner-logins.txt', '\n'.join(lines))
print(f'{len(profiles)} test practitioner profiles linked; event-host access enabled. No emails sent.')
