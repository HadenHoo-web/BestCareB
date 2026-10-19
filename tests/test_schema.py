"""Independent SQLite migration/constraint checks; no application sample data."""
import pathlib
import sqlite3
import tempfile
import unittest
SQL = (pathlib.Path(__file__).resolve().parents[1] / 'src-tauri/migrations/001_initial.sql').read_text()
class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(SQL)
    def tearDown(self):
        self.db.close()
    def test_tables_and_foreign_keys(self):
        tables = self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        self.assertEqual(len(tables), 10)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO account_groups VALUES ('missing', 'missing', 'joined')")
    def test_duplicate_group_url(self):
        self.db.execute("INSERT INTO groups(id,url,name) VALUES ('1','https://www.facebook.com/groups/test','Test')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO groups(id,url,name) VALUES ('2','https://www.facebook.com/groups/test','Duplicate')")
    def test_success_requires_confirmation(self):
        self.db.execute("INSERT INTO groups(id,url,name) VALUES ('g','https://www.facebook.com/groups/test','Test')")
        self.db.execute("INSERT INTO campaigns(id,name) VALUES ('c','Test')")
        self.db.execute("INSERT INTO campaign_groups VALUES ('c','g')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO campaign_posts(id,campaign_id,group_id,content,status) VALUES ('p','c','g','Content','COMPLETED')")
    def test_disk_persistence(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'data.sqlite'
            db = sqlite3.connect(path)
            db.executescript(SQL)
            db.execute("UPDATE app_settings SET value='dark' WHERE key='theme'")
            db.commit()
            db.close()
            db = sqlite3.connect(path)
            self.assertEqual(db.execute("SELECT value FROM app_settings WHERE key='theme'").fetchone()[0], 'dark')
            db.close()
if __name__ == '__main__':
    unittest.main()
