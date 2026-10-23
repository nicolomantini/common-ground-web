import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import database

class DatabaseTests(unittest.TestCase):
    def test_production_config_rejected_before_connection(self):
        with tempfile.TemporaryDirectory() as folder:
            config=Path(folder)/'database.json'
            config.write_text(json.dumps({'project_ref':'plgilmcclpldcjzkepbp'}))
            with patch.object(database,'CONFIG',config), patch('psycopg.connect') as connect:
                with self.assertRaises(ValueError): database.Postgres()
                connect.assert_not_called()

    def test_unknown_backend_does_not_fall_back(self):
        with patch.dict('os.environ',{'CG_EVENTS_BACKEND':'production'}):
            with self.assertRaises(ValueError):database.connect(':memory:')

    def test_rows_support_named_and_numeric_access(self):
        row=database.Row([('id','test'),('amount',1500)])
        self.assertEqual(row['amount'],row[1])
        self.assertEqual(dict(row),{'id':'test','amount':1500})

    def test_postgres_rolls_back_and_closes_on_failure(self):
        from unittest.mock import Mock
        db=object.__new__(database.Postgres)
        db.connection=Mock()
        with self.assertRaises(ValueError):
            with db:raise ValueError('Failed registration')
        db.connection.rollback.assert_called_once()
        db.connection.commit.assert_not_called()
        db.connection.close.assert_called_once()
