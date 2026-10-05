#!/usr/bin/env python3
"""Copy this preview's runtime URL to the user's macOS clipboard, never stdout."""

import getpass
from pathlib import Path
import subprocess
import sys
from urllib.parse import quote
import warnings

DIRECT_HOST = "ep-wild-king-b2iojvsf.c-6.eu-central-1.aws.neon.tech"
POOLED_HOST = DIRECT_HOST.replace(".", "-pooler.", 1)
ROLE = "lunia_runtime"
DATABASE = "lunia_preview"


def connection_url(password):
    if len(password) < 24 or any(char in password for char in "\r\n\0"):
        raise ValueError("Use the existing runtime password (24+ characters, no line breaks).")
    return ("postgresql://" + ROLE + ":" + quote(password, safe="") + "@" + POOLED_HOST
            + "/" + DATABASE + "?sslmode=require&channel_binding=require")


def copy_connection(password):
    buffer = bytearray(connection_url(password), "utf-8")
    try:
        result = subprocess.run(["/usr/bin/pbcopy"], input=buffer,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                env={"LANG": "en_US.UTF-8"}, timeout=15)
        if result.returncode:
            raise RuntimeError("Clipboard copy failed; no URL was printed. Retry in your own Mac terminal.")
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("Clipboard copy could not finish; no URL was printed. Retry in your own Mac terminal.") from None
    finally:
        # Best effort only: Python immutable string copies cannot be reliably zeroized.
        buffer[:] = b"\0" * len(buffer)


def main():
    if sys.platform != "darwin" or not sys.stdin.isatty() or not sys.stderr.isatty():
        raise RuntimeError("Run this command in your own interactive Mac terminal.")
    if len(sys.argv) != 1 or not Path("/usr/bin/pbcopy").is_file():
        raise RuntimeError("Run npm run preview:connection without arguments on macOS with pbcopy.")
    print("Copy the existing runtime connection to your Mac clipboard. No database changes.")
    print("Destination: " + POOLED_HOST + "/" + DATABASE + "; role: " + ROLE)
    password = None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            password = getpass.getpass("Existing runtime database password (hidden): ")
        copy_connection(password)
    finally:
        password = None
    print("Copied. Paste into studio-lunia > Preview > feature/hosted-cms-preview > DATABASE_URL.")
    print("Save the field, then replace your clipboard with non-sensitive text. Do not paste into chat.")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt):
        # Do not expose exceptions, input, subprocess state or the connection URL.
        print("Connection copy stopped. Use your own Mac terminal and the existing runtime password; no URL was printed.", file=sys.stderr)
        sys.exit(1)
