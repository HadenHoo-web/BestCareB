"""Independent SQLite migration/constraint checks; no application sample data."""
import pathlib
import sqlite3
import tempfile
import unittest
SQL_V1 = (pathlib.Path(__file__).resolve().parents[1] / 'src-tauri/migrations/001_initial.sql').read_text()
SQL_V2 = (pathlib.Path(__file__).resolve().parents[1] / 'src-tauri/migrations/002_v2.sql').read_text()
class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(SQL_V1)
        self.db.executescript(SQL_V2)
    def tearDown(self):
        self.db.close()
    def test_tables_and_foreign_keys(self):
        tables = self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
        self.assertEqual(len(tables), 12)
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
    def test_v2_account_category_and_group_blacklist(self):
        self.db.execute("INSERT INTO accounts(id,name,category) VALUES ('a1','Test','personal')")
        self.db.execute("INSERT INTO groups(id,url,name,blacklisted) VALUES ('g1','https://www.facebook.com/groups/bl','Blacklisted',1)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO accounts(id,name,category) VALUES ('a2','Test2','invalid_category')")
    def test_v2_campaign_job_unique_per_group(self):
        self.db.execute("INSERT INTO groups(id,url,name) VALUES ('g2','https://www.facebook.com/groups/job','Test')")
        self.db.execute("INSERT INTO campaigns(id,name) VALUES ('c2','Test')")
        self.db.execute("INSERT INTO campaign_jobs(id,campaign_id,group_id,status) VALUES ('j1','c2','g2','PENDING')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO campaign_jobs(id,campaign_id,group_id,status) VALUES ('j2','c2','g2','PENDING')")
    def test_disk_persistence(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'data.sqlite'
            db = sqlite3.connect(path)
            db.executescript(SQL_V1)
            db.executescript(SQL_V2)
            db.execute("UPDATE app_settings SET value='dark' WHERE key='theme'")
            db.commit()
            db.close()
            db = sqlite3.connect(path)
            self.assertEqual(db.execute("SELECT value FROM app_settings WHERE key='theme'").fetchone()[0], 'dark')
            db.close()

if __name__ == '__main__':
    unittest.main()
