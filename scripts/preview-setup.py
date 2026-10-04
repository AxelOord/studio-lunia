#!/usr/bin/env python3
"""User-terminal-only setup; no secrets in argv, files or forwarded child output."""

import getpass
import json
import os
import re
import shutil
from pathlib import Path
import subprocess
import sys
import warnings
from urllib.parse import parse_qs, quote, unquote, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent.parent
ROLE = "lunia_runtime"
DATABASE = "lunia_preview"

GRANTS = """
BEGIN;
DO $$ BEGIN
  IF current_user <> 'neondb_owner' OR current_database() <> 'lunia_preview'
    THEN RAISE EXCEPTION 'Wrong operator target'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lunia_runtime'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls)
    OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
      WHERE r.rolname='lunia_runtime')
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE r.rolname='lunia_runtime')
    OR EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba
      WHERE r.rolname='lunia_runtime')
    THEN RAISE EXCEPTION 'Runtime role must exist without ownership or memberships'; END IF;
END $$;
REVOKE ALL ON DATABASE lunia_preview FROM PUBLIC;
GRANT CONNECT ON DATABASE lunia_preview TO lunia_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO lunia_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lunia_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO lunia_runtime;
REVOKE INSERT, UPDATE, DELETE ON public.payload_migrations FROM lunia_runtime;
REVOKE ALL ON SEQUENCE public.payload_migrations_id_seq FROM lunia_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lunia_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO lunia_runtime;
COMMIT;
"""

RUNTIME_CHECK = """
BEGIN;
DO $$ BEGIN
  IF current_user <> 'lunia_runtime' OR current_database() <> 'lunia_preview'
    OR has_schema_privilege(current_user, 'public', 'CREATE')
    OR has_database_privilege(current_user, current_database(), 'CREATE')
    OR has_database_privilege(current_user, current_database(), 'TEMP')
    OR has_table_privilege(current_user, 'public.payload_migrations', 'INSERT')
    OR has_table_privilege(current_user, 'public.payload_migrations', 'UPDATE')
    OR has_table_privilege(current_user, 'public.payload_migrations', 'DELETE')
    THEN RAISE EXCEPTION 'Runtime privileges not restricted'; END IF;
END $$;
INSERT INTO lunia_rate_limits (key, attempts, expires_at)
  VALUES ('operator-runtime-check', 1, now())
  ON CONFLICT (key) DO UPDATE SET attempts=lunia_rate_limits.attempts+1;
SELECT attempts FROM lunia_rate_limits WHERE key='operator-runtime-check';
DELETE FROM lunia_rate_limits WHERE key='operator-runtime-check';
ROLLBACK;
"""


class SetupError(Exception):
    pass


def owner_url(value):
    try:
        url = urlsplit(value)
        valid = (
            url.scheme in ("postgres", "postgresql")
            and url.hostname and url.hostname.endswith(".neon.tech")
            and "-pooler" not in url.hostname
            and unquote(url.username or "") == "neondb_owner"
            and url.password
            and url.path == "/" + DATABASE
            and not url.fragment
            and url.port in (None, 5432)
        )
        # Require TLS, reject alternate connection-routing/service settings.
        params = parse_qs(url.query, strict_parsing=True)
        valid = valid and params.get("sslmode") in (["require"], ["verify-full"])
        valid = valid and set(params).issubset({"sslmode", "channel_binding"})
        if not valid:
            raise ValueError()
        return url
    except (ValueError, TypeError):
        raise SetupError("Use the direct Neon owner URL for lunia_preview with TLS.") from None


def runtime_url(owner, password):
    url = urlsplit(owner)
    host = url.hostname + (":" + str(url.port) if url.port else "")
    return urlunsplit((url.scheme, ROLE + ":" + quote(password, safe="") + "@" + host,
                      url.path, url.query, ""))


def child_env(database, secret="", email="", target="", backup=""):
    # Exclude inherited Vercel settings, NODE_OPTIONS, PG options and service credentials.
    env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG")
           if k in os.environ}
    env.update({
        "DATABASE_URL": database, "PAYLOAD_SECRET": secret,
        "PGCONNECT_TIMEOUT": "15", "PGAPPNAME": "lunia-preview-operator",
        "PGSSLMODE": "require", "NODE_ENV": "production",
        "PREVIEW_EDITOR_EMAIL": email, "LUNIA_OPERATOR_TARGET": target,
        "LUNIA_BACKUP_REFERENCE": backup, "LUNIA_SHOWCASE": "false",
        "LUNIA_CMS_PREVIEW": "false", "LUNIA_STORAGE": "", "CMS_ORIGIN": "",
        "RESEND_API_KEY": "", "BLOB_READ_WRITE_TOKEN": "",
    })
    if database:
        url = urlsplit(database)
        params = parse_qs(url.query)
        env.update({
            "PGHOST": url.hostname, "PGPORT": str(url.port or 5432),
            "PGDATABASE": unquote(url.path[1:]), "PGUSER": unquote(url.username or ""),
            "PGPASSWORD": unquote(url.password or ""),
            "PGSSLMODE": params.get("sslmode", ["require"])[0],
            "PGCHANNELBINDING": params.get("channel_binding", ["prefer"])[0],
        })
    return env


def run(stage, args, env, data=None, timeout=300):
    try:
        result = subprocess.run(args, cwd=ROOT, env=env, input=data, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=timeout, start_new_session=True)
        if result.returncode:
            raise SetupError(stage + " failed; output withheld. Keep hosted CMS disabled.")
        return result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        raise SetupError(stage + " could not finish; keep hosted CMS disabled.") from None


def psql(stage, sql, env, data=None):
    return run(stage, ["psql", "-X", "-qAt", "--set", "ON_ERROR_STOP=1", "--command", sql], env, data)


def check_tool(binary, major, env):
    """Diagnose local prerequisites before any credentials are collected."""
    requirement = ("Node 24" if binary == "node" else "PostgreSQL 18 client tools")
    next_step = ("Select Node 24 and run node --version."
                 if binary == "node" else
                 "Install PostgreSQL 18 client tools or add their bin directory to PATH, "
                 "then run " + binary + " --version. See the runbook's macOS instructions.")
    executable = shutil.which(binary, path=env.get("PATH", ""))
    if not executable:
        raise SetupError("No executable " + binary + " found on PATH. " + next_step)
    try:
        result = subprocess.run([executable, "--version"], cwd=ROOT, env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                timeout=15, start_new_session=True)
    except subprocess.TimeoutExpired:
        raise SetupError(binary + " --version timed out after 15 seconds. " + next_step) from None
    except OSError:
        raise SetupError(binary + " was found but could not be started. " + next_step) from None
    if result.returncode:
        raise SetupError(binary + " --version exited unsuccessfully; output withheld. " + next_step)
    pattern = r"^v(\d{1,3})\." if binary == "node" else re.escape(binary) + r" \(PostgreSQL\) (\d{1,3})\."
    match = re.match(pattern, result.stdout.strip())
    if not match:
        raise SetupError(binary + " returned an unrecognized version; output withheld. " + next_step)
    if int(match.group(1)) != major:
        raise SetupError(binary + " reports major " + match.group(1) + "; " + requirement + " required. " + next_step)


def check_tools(env):
    check_tool("node", 24, env)
    for binary in ("psql", "pg_dump", "pg_restore"):
        check_tool(binary, 18, env)


def hidden(label, minimum=1):
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        value = getpass.getpass(label)
    if len(value) < minimum or any(c in value for c in "\n\r\x00"):
        raise SetupError("Input is missing, too short or contains a forbidden control character.")
    return value


def main():
    if os.name != "posix" or not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SetupError("Run in your own Linux/macOS/WSL terminal, not chat, CI or a recorded agent terminal.")
    if not (ROOT / "node_modules/.bin/tsx").exists():
        raise SetupError("Install the pinned dependencies with Node 24 and npm ci first.")
    env = child_env("")
    check_tools(env)

    print("Private local setup for the approved hosted-cms-preview branch; no Vercel changes.")
    owner = hidden("Direct Neon owner URL (hidden): ")
    url = owner_url(owner)
    target = input("Type the approved branch endpoint hostname/lunia_preview from Neon: ").strip()
    if target != url.hostname + url.path:
        raise SetupError("Target confirmation does not match.")
    backup = input("Verified pre-migration backup reference (not a secret URL): ").strip()
    if not backup or "://" in backup:
        raise SetupError("A verified backup reference is required.")
    secret = hidden("Existing PAYLOAD_SECRET used for this preview (hidden): ", 32)
    email = input("Approved editor/test email: ").strip()
    if "@" not in email or any(c in email for c in "\r\n"):
        raise SetupError("An approved editor email is required.")
    env = child_env(owner, secret, email, target, backup)
    metadata = psql("Target check", "SELECT current_user || '|' || current_database() || '|' || current_setting('server_version_num');", env)
    values = metadata.split("|")
    if len(values) != 3 or values[:2] != ["neondb_owner", DATABASE] or not 180000 <= int(values[2]) < 190000:
        raise SetupError("Expected owner, lunia_preview and PostgreSQL 18.")
    if psql("Existing installation check", "SELECT to_regclass('public.users') IS NOT NULL;", env) == "t":
        if psql("Existing editor check", "SELECT count(*) FROM public.users;", env) != "0":
            raise SetupError("An editor already exists; this first-setup helper will not rotate passwords or repeat setup.")

    operator = ["node_modules/.bin/tsx", "scripts/preview-operator.ts"]
    run("Migration", operator + ["migrate"], env)
    print("Migrations completed.")
    psql("Runtime grants", GRANTS, env)
    password = hidden("New runtime database password (hidden; save in your password manager): ", 24)
    if password != hidden("Repeat runtime password (hidden): ", 24):
        raise SetupError("Passwords did not match; runtime password was not changed.")
    # A new session has no controlling tty: psql reads both hidden prompt answers from
    # the pipe and uses libpq password encryption. No plaintext password in SQL/argv.
    psql("Runtime password", "\\password lunia_runtime", env, password + "\n" + password + "\n")
    runtime = runtime_url(owner, password)
    runtime_env = child_env(runtime, secret, email, target, backup)
    psql("Restricted runtime access", RUNTIME_CHECK, runtime_env)
    print("Runtime password set; restricted connection and transactional read/write check passed.")
    editor_password = hidden("First editor password (hidden; save in your password manager): ", 16)
    if editor_password != hidden("Repeat editor password (hidden): ", 16):
        raise SetupError("Editor passwords did not match; no editor was created.")
    run("Editor bootstrap", operator + ["bootstrap"], runtime_env,
        json.dumps({"email": email, "password": editor_password}))
    print("First editor created. No credentials or connection URLs were printed or saved.")
    print("In Neon choose this branch/database, lunia_runtime and pooling. Enter that runtime URL directly into the branch-only Vercel secure field. Hosted acceptance is still required.")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        message = str(error) if isinstance(error, SetupError) else "Setup stopped; keep hosted CMS disabled."
        print(message, file=sys.stderr)
        sys.exit(1)
