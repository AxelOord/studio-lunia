import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, unquote, urlsplit

spec = importlib.util.spec_from_file_location("preview_connection", Path(__file__).resolve().parents[1] / "scripts/preview-connection.py")
connection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connection)


class PreviewConnectionTests(unittest.TestCase):
    def test_exact_runtime_target_tls_and_password_roundtrip(self):
        password = "synthetic-'\\:@$`; SELECT 1; --é-12345"
        url = urlsplit(connection.connection_url(password))
        self.assertEqual(url.username, "lunia_runtime")
        self.assertEqual(unquote(url.password), password)
        self.assertEqual(url.hostname, "ep-wild-king-b2iojvsf-pooler.c-6.eu-central-1.aws.neon.tech")
        self.assertEqual(url.path, "/lunia_preview")
        self.assertEqual(parse_qs(url.query), {"sslmode": ["require"], "channel_binding": ["require"]})

    def test_clipboard_stdin_only_and_best_effort_buffer_clear(self):
        password = "synthetic-secret-only-123456789"
        captured = []

        def copy(args, **kwargs):
            self.assertEqual(args, ["/usr/bin/pbcopy"])
            self.assertNotIn(password, str(kwargs["env"]))
            self.assertEqual(bytes(kwargs["input"]).decode(), connection.connection_url(password))
            self.assertEqual(kwargs["stdout"], subprocess.DEVNULL)
            self.assertEqual(kwargs["stderr"], subprocess.DEVNULL)
            captured.append(kwargs["input"])
            return subprocess.CompletedProcess(args, 0)

        with patch.object(connection.subprocess, "run", side_effect=copy), patch("builtins.print") as output:
            connection.copy_connection(password)
        output.assert_not_called()
        self.assertTrue(all(byte == 0 for byte in captured[0]))

    def test_clipboard_errors_never_print_secret_or_fallback(self):
        password = "synthetic-secret-only-123456789"
        for result in (subprocess.CompletedProcess([], 1), OSError(password), subprocess.TimeoutExpired([password], 15)):
            with self.subTest(result=type(result).__name__), patch.object(connection.subprocess, "run", **({"side_effect": result} if isinstance(result, Exception) else {"return_value": result})), patch("builtins.print") as output:
                with self.assertRaises(RuntimeError) as caught:
                    connection.copy_connection(password)
                self.assertNotIn(password, str(caught.exception))
                output.assert_not_called()

    def test_non_mac_or_noninteractive_stops_before_password(self):
        with patch.object(connection.sys, "platform", "linux"), patch.object(connection.getpass, "getpass") as hidden:
            with self.assertRaises(RuntimeError):
                connection.main()
            hidden.assert_not_called()

    def test_invalid_password_stops_before_clipboard(self):
        with patch.object(connection.subprocess, "run") as copy:
            for password in ("short", "x" * 24 + "\n", "x" * 24 + "\r", "x" * 24 + "\0"):
                with self.assertRaises(ValueError):
                    connection.copy_connection(password)
        copy.assert_not_called()


if __name__ == "__main__":
    unittest.main()
