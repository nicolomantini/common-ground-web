"""SQLite for offline tests; private PostgreSQL schema for the Supabase test project."""
import json
import os
import sqlite3
from pathlib import Path

TEST_PROJECT = 'eicpgkmajosuhrqtrgrf'
CONFIG = Path.home() / '.config/common-ground/event-test-database.json'

def columns(db, table):
    if isinstance(db, Postgres):
        return {r[0] for r in db.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=\'event_tool\' AND table_name=?', (table,))}
    return {r[1] for r in db.execute('PRAGMA table_info('+table+')')}

class Row(dict):
    def __getitem__(self, key):
        return tuple(self.values())[key] if isinstance(key, int) else super().__getitem__(key)

def row_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []
    return lambda values: Row(zip(names, values))

class Postgres:
    def __init__(self):
        import psycopg
        config = json.loads(CONFIG.read_text())
        if config.get('project_ref') != TEST_PROJECT or config.get('user') != 'event_tool_app.' + TEST_PROJECT or config.get('host') != 'aws-0-eu-west-1.pooler.supabase.com':
            raise ValueError('Only the isolated Common Ground test database is allowed.')
        self.connection = psycopg.connect(host=config['host'], port=6543, dbname='postgres', user=config['user'], password=config['password'], sslmode='require', connect_timeout=10, prepare_threshold=None, row_factory=row_factory)
        # One transaction per request. Serialize prototype writes across processes,
        # including capacity checks, one-use links and scheduled email previews.
        self.connection.execute("SET LOCAL search_path TO event_tool")
        self.connection.execute("SET LOCAL statement_timeout = '20s'")
        self.connection.execute('SELECT pg_advisory_xact_lock(80302026)')
    def execute(self, query, params=()):
        if query == 'BEGIN IMMEDIATE':
            return self.connection.execute('SELECT 1')
        return self.connection.execute(query.replace('?', '%s'), params or None)
    def executescript(self, script):
        for statement in script.split(';'):
            if statement.strip(): self.execute(statement)
    def __enter__(self): return self
    def __exit__(self, kind, value, traceback):
        try:
            if kind: self.connection.rollback()
            else: self.connection.commit()
        finally: self.connection.close()

def connect(path):
    backend = os.environ.get('CG_EVENTS_BACKEND', 'sqlite')
    if backend == 'supabase-test': return Postgres()
    if backend != 'sqlite': raise ValueError('Unknown event database backend.')
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    return db
