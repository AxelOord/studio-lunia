import importlib.util
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "preview_setup", Path(__file__).resolve().parents[1] / "scripts/preview-setup.py"
)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

OWNER = "postgresql://neondb_owner:hidden-test-only@ep-synthetic.eu-central-1.aws.neon.tech/lunia_preview?sslmode=require"


class PreviewSetupTests(unittest.TestCase):
    def test_preflight_names_missing_executable_before_running_it(self):
        with patch.object(setup.shutil, "which", return_value=None), patch.object(setup.subprocess, "run") as run:
            with self.assertRaisesRegex(setup.SetupError, "No executable psql found on PATH"):
                setup.check_tool("psql", 18, {})
            run.assert_not_called()

    def test_preflight_distinguishes_wrong_major_without_dumping_output(self):
        with patch.object(setup.shutil, "which", return_value="/tools/psql"), patch.object(setup.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "psql (PostgreSQL) 17.11 hidden-test-only", "")):
            with self.assertRaisesRegex(setup.SetupError, "psql reports major 17") as caught:
                setup.check_tool("psql", 18, {})
            self.assertNotIn("hidden-test-only", str(caught.exception))

    def test_preflight_distinguishes_timeout_start_and_process_errors(self):
        with patch.object(setup.shutil, "which", return_value="/tools/psql"):
            for error, expected in ((subprocess.TimeoutExpired([], 15, output="hidden-test-only"), "timed out"), (OSError("hidden-test-only"), "could not be started")):
                with self.subTest(expected=expected), patch.object(setup.subprocess, "run", side_effect=error):
                    with self.assertRaisesRegex(setup.SetupError, expected) as caught:
                        setup.check_tool("psql", 18, {})
                    self.assertNotIn("hidden-test-only", str(caught.exception))
            with patch.object(setup.subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "hidden-test-only", "hidden-test-only")):
                with self.assertRaisesRegex(setup.SetupError, "exited unsuccessfully") as caught:
                    setup.check_tool("psql", 18, {})
                self.assertNotIn("hidden-test-only", str(caught.exception))

    def test_preflight_checks_node_and_all_three_postgres_clients(self):
        def version(args, **kwargs):
            binary = Path(args[0]).name
            output = "v24.19.0" if binary == "node" else binary + " (PostgreSQL) 18.6 (Homebrew)"
            return subprocess.CompletedProcess(args, 0, output, "")
        with patch.object(setup.shutil, "which", side_effect=lambda binary, **kwargs: "/tools/" + binary), patch.object(setup.subprocess, "run", side_effect=version) as run:
            setup.check_tools({})
        self.assertEqual([Path(call.args[0][0]).name for call in run.call_args_list], ["node", "psql", "pg_dump", "pg_restore"])

    def test_only_direct_approved_database_owner_and_tls(self):
        self.assertEqual(setup.owner_url(OWNER).path, "/lunia_preview")
        for url in (
            OWNER.replace("sslmode=require", "sslmode=disable"),
            OWNER.replace("ep-synthetic.", "ep-synthetic-pooler."),
            OWNER.replace("/lunia_preview", "/production"),
            OWNER.replace("neondb_owner:", "lunia_runtime:"),
            OWNER.replace(".neon.tech", ".evil.test"),
            OWNER + "&host=elsewhere.test",
            OWNER + "&sslmode=disable",
            OWNER + "#hidden-test-only",
        ):
            with self.assertRaises(setup.SetupError) as caught:
                setup.owner_url(url)
            self.assertNotIn("hidden-test-only", str(caught.exception))

    def test_runtime_password_is_encoded_without_changing_target(self):
        password = "synthetic @:/?&#% password"
        url = setup.urlsplit(setup.runtime_url(OWNER, password))
        self.assertEqual(url.username, "lunia_runtime")
        self.assertEqual(setup.unquote(url.password), password)
        self.assertEqual(url.hostname, setup.urlsplit(OWNER).hostname)
        self.assertEqual(url.query, "sslmode=require")

    def test_child_environment_excludes_inherited_cloud_secrets_and_debuggers(self):
        with patch.dict(os.environ, {"VERCEL": "1", "NODE_OPTIONS": "--inspect",
                                    "PGPASSWORD": "inherited-unsafe-secret", "RESEND_API_KEY": "hidden-test-only"}):
            env = setup.child_env(OWNER)
        for key in ("VERCEL", "NODE_OPTIONS"):
            self.assertNotIn(key, env)
        self.assertEqual(env["PGPASSWORD"], "hidden-test-only")
        self.assertEqual(env["RESEND_API_KEY"], "")
        self.assertEqual(env["LUNIA_STORAGE"], "")

    def test_child_errors_are_redacted_and_password_goes_only_to_stdin(self):
        secret = "synthetic hidden-test-only"
        result = subprocess.CompletedProcess([], 1, secret, secret)
        with patch.object(setup.subprocess, "run", return_value=result) as run:
            with self.assertRaises(setup.SetupError) as caught:
                setup.psql("Password", "\\password lunia_runtime", {}, secret + "\n" + secret + "\n")
        self.assertNotIn(secret, str(caught.exception))
        args, kwargs = run.call_args
        self.assertNotIn(secret, " ".join(args[0]))
        self.assertTrue(kwargs["start_new_session"])
        self.assertEqual(kwargs["input"], secret + "\n" + secret + "\n")
        self.assertEqual(kwargs["stderr"], subprocess.PIPE)

    def test_refuses_noninteractive_execution(self):
        with patch.object(setup.sys.stdin, "isatty", return_value=False):
            with self.assertRaises(setup.SetupError):
                setup.main()


if __name__ == "__main__":
    unittest.main()
