import importlib.util
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("setup", Path(__file__).resolve().parents[1] / "scripts/preview-setup.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
import preview_backup as backup


class PreviewBackupTests(unittest.TestCase):
    def exercise(self, stage=None, mismatch=False):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)
            env = setup.child_env("postgresql://neondb_owner:synthetic-secret@ep-test.neon.tech/lunia_preview?sslmode=require")
            queries = []

            def command(name, args, env, data=None):
                if name == stage:
                    raise setup.SetupError(name + " failed; output withheld.")
                if name == "Schema verification":
                    return "-- generated comment\n\\restrict random\nCREATE TABLE example (id integer);\n\\unrestrict random"
                if name == "Row-count verification":
                    return "example|2" if mismatch and env["PGDATABASE"].startswith("lunia_restore_check_") else "example|1"
                return ""

            def sql(name, query, env):
                queries.append(query)
                if name == stage:
                    raise setup.SetupError(name + " failed; output withheld.")
                return ""

            def dump(*args, **kwargs):
                kwargs["stdout"].write(b"synthetic archive test boundary")
                return subprocess.CompletedProcess([], 0, None, b"")

            with patch.object(backup, "encrypted_directory", return_value=destination), patch.object(backup.subprocess, "run", side_effect=dump), patch("builtins.print"):
                if stage or mismatch:
                    with self.assertRaises(setup.SetupError):
                        backup.verified_backup(env, command, sql, setup.child_env, setup.SetupError)
                    self.assertFalse((destination / "verified-backup.json").exists())
                else:
                    reference = backup.verified_backup(env, command, sql, setup.child_env, setup.SetupError)
                    record = json.loads(Path(reference).read_text())
                    self.assertTrue(record["restoreVerified"])
                    self.assertNotIn("synthetic-secret", Path(reference).read_text())
                    for name in ("before-migration.dump", "verified-backup.json"):
                        self.assertEqual(stat.S_IMODE((destination / name).stat().st_mode), 0o600)
            return queries

    def test_verified_reference_requires_archive_restore_and_private_files(self):
        queries = self.exercise()
        creates = [q for q in queries if q.startswith("CREATE DATABASE")]
        drops = [q for q in queries if q.startswith("DROP DATABASE")]
        self.assertEqual(len(creates), 1)
        self.assertEqual(len(drops), 1)
        self.assertRegex(drops[0], r'^DROP DATABASE "lunia_restore_check_[a-f0-9]{16}";$')
        self.assertNotIn('"lunia_preview"', drops[0])

    def test_restore_failure_removes_only_its_temporary_database_and_no_verified_reference(self):
        self.assertTrue(any(q.startswith("DROP DATABASE") for q in self.exercise(stage="Restore verification")))

    def test_create_failure_does_not_drop_any_database(self):
        self.assertFalse(any(q.startswith("DROP DATABASE") for q in self.exercise(stage="Create disposable restore database")))

    def test_count_mismatch_does_not_produce_a_verified_reference(self):
        self.assertTrue(any(q.startswith("DROP DATABASE") for q in self.exercise(mismatch=True)))


if __name__ == "__main__":
    unittest.main()
