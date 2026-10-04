#!/usr/bin/env python3
"""User-terminal-only setup; no secrets in argv, files or forwarded child output."""

import getpass
import hashlib
import json
import os
import re
import shutil
import stat
from pathlib import Path
import subprocess
import sys
import warnings
from urllib.parse import parse_qs, quote, unquote, urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preview_backup import verified_backup

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
        "PGCONNECT_TIMEOUT": "15", "PGAPPNAME": "lunia-preview-operator", "LC_MESSAGES": "C",
        "PGSSLMODE": "require", "PGCLIENTENCODING": "UTF8", "NODE_ENV": "production",
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


def postgres_failure(stderr):
    """Return only fixed categories / known SQLSTATEs, never provider output."""
    codes = {"42501": "insufficient-privilege", "28P01": "authentication",
             "28000": "authorization", "08001": "connection", "08006": "connection",
             "42704": "missing-role", "22023": "invalid-parameter", "55000": "object-state",
             "0A000": "unsupported-feature", "XX000": "provider-internal-error",
             "42601": "sql-syntax"}
    for code, category in codes.items():
        if re.search(r"\b(?:ERROR|FATAL):\s+" + code + r"\b", stderr):
            return category + "; SQLSTATE=" + code
    for fragment, category in (("Passwords didn't match", "prompt-mismatch"),
                               ("password authentication failed", "authentication"),
                               ("no password supplied", "connection-password-missing"),
                               ("could not translate host name", "dns"),
                               ("Connection refused", "connection-refused"),
                               ("timeout expired", "connection-timeout"),
                               ("certificate verify failed", "tls-verification")):
        if fragment in stderr:
            return category
    return "unclassified"


def run(stage, args, env, data=None, timeout=300):
    try:
        result = subprocess.run(args, cwd=ROOT, env=env, input=data, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=timeout, start_new_session=True)
        if result.returncode:
            if Path(args[0]).name == "psql":
                category = postgres_failure(result.stderr)
                uncertainty = " Password state is unknown." if stage == "Runtime password" else ""
                raise SetupError(stage + " failed [" + category + "; exit=" + str(result.returncode)
                                 + "]; output withheld." + uncertainty + " Keep hosted CMS disabled.")
            raise SetupError(stage + " failed; output withheld. Keep hosted CMS disabled.")
        return result.stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        raise SetupError(stage + " could not finish; keep hosted CMS disabled.") from None


def psql(stage, sql, env, data=None):
    return run(stage, ["psql", "-X", "-w", "-qAt", "--set", "ON_ERROR_STOP=1",
                       "--set", "VERBOSITY=sqlstate", "--command", sql], env, data)


def set_runtime_password(env, password):
    # Neon rejects client-side password hashes (including psql's \password).
    # SQL PASSWORD does not accept a bind parameter. A fixed role plus an escaped
    # PostgreSQL E-string keeps arbitrary input inside a single string literal.
    if len(password) < 24 or any(c in password for c in "\r\n\0"):
        raise SetupError("Invalid runtime password input; no password command sent.")
    literal = password.replace("\\", "\\\\").replace("'", "''")
    statement = "ALTER ROLE lunia_runtime PASSWORD E'" + literal + "';\n"
    run("Runtime password", ["psql", "-X", "-w", "-qAt", "--set", "ON_ERROR_STOP=1",
                             "--set", "VERBOSITY=sqlstate", "--file=-"], env, statement)


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
    while True:
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            value = getpass.getpass(label)
        if len(value) >= minimum and not any(c in value for c in "\n\r\x00"):
            return value
        print(f"Use at least {minimum} characters, without newline, carriage return or NUL. Please try again (Ctrl-C cancels).")


def confirmed_password(label, minimum):
    while True:
        password = hidden(f"{label} (hidden, at least {minimum} characters; save in your password manager): ", minimum)
        if password == hidden("Repeat password (hidden): ", minimum):
            return password
        print("Passwords did not match. Please try again; nothing has been changed.")


def resume_reference(filename):
    """Only resume from this helper's actual retained and checksum-verified archive."""
    try:
        manifest = Path(filename).expanduser().resolve()
        record = json.loads(manifest.read_text())
        archive = manifest.parent / "before-migration.dump"
        for path in (manifest, archive):
            info = path.stat()
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600:
                raise ValueError()
        digest = hashlib.sha256()
        with archive.open("rb") as data:
            for chunk in iter(lambda: data.read(1024 * 1024), b""):
                digest.update(chunk)
        if (record.get("restoreVerified") is not True or record.get("archive") != archive.name
                or record.get("sha256") != digest.hexdigest()
                or record.get("bytes") != archive.stat().st_size
                or not isinstance(record.get("source"), str)):
            raise ValueError()
        return str(manifest), record["source"]
    except (OSError, ValueError, TypeError, KeyError):
        raise SetupError("Resume requires the original verified-backup.json and matching private archive. No changes made.") from None


def verify_resume(env):
    expected = "20261004_164202_initial\n20261004_175013_hosted_preview"
    if psql("Resume migration check", "SELECT name FROM public.payload_migrations ORDER BY name;", env) != expected:
        raise SetupError("Recorded migrations do not match this setup version; resume stopped without changes.")
    psql("Resume schema check", "SELECT prefix, _objectkey FROM public.media LIMIT 0; SELECT version_prefix, version__objectkey FROM public._media_v LIMIT 0; SELECT key, attempts, expires_at FROM public.lunia_rate_limits LIMIT 0;", env)
    # Read-only catalog checks: no grants, backup or migrations are repeated.
    state = psql("Resume runtime grants check", """
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lunia_runtime' AND rolcanlogin
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
AND NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='lunia_runtime')
AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname='lunia_runtime')
AND NOT EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE r.rolname='lunia_runtime')
AND has_database_privilege('lunia_runtime', current_database(), 'CONNECT')
AND has_schema_privilege('lunia_runtime', 'public', 'USAGE')
AND NOT has_schema_privilege('lunia_runtime', 'public', 'CREATE')
AND NOT has_database_privilege('lunia_runtime', current_database(), 'CREATE')
AND NOT has_database_privilege('lunia_runtime', current_database(), 'TEMP')
AND (SELECT bool_and(has_table_privilege('lunia_runtime', c.oid, p.priv))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(priv)
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname <> 'payload_migrations')
AND (SELECT bool_and(has_sequence_privilege('lunia_runtime', c.oid, 'USAGE'))
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='S' AND c.relname <> 'payload_migrations_id_seq')
AND has_table_privilege('lunia_runtime','public.payload_migrations','SELECT')
AND NOT has_table_privilege('lunia_runtime','public.payload_migrations','INSERT')
AND NOT has_table_privilege('lunia_runtime','public.payload_migrations','UPDATE')
AND NOT has_table_privilege('lunia_runtime','public.payload_migrations','DELETE')
AND NOT has_sequence_privilege('lunia_runtime','public.payload_migrations_id_seq','USAGE');
""", env)
    if state != "t":
        raise SetupError("Runtime grants differ from the completed setup stage; resume stopped without changes.")


def main():
    if os.name != "posix" or not sys.stdin.isatty() or not sys.stderr.isatty():
        raise SetupError("Run in your own Linux/macOS/WSL terminal, not chat, CI or a recorded agent terminal.")
    if not (ROOT / "node_modules/.bin/tsx").exists():
        raise SetupError("Install the pinned dependencies with Node 24 and npm ci first.")
    env = child_env("")
    check_tools(env)
    resume = None
    if len(sys.argv) == 3 and sys.argv[1] == "--resume":
        resume = resume_reference(sys.argv[2])
    elif len(sys.argv) != 1:
        raise SetupError("Use preview:setup or preview:setup -- --resume /path/to/verified-backup.json.")

    print("Private local setup for the approved hosted-cms-preview branch; no Vercel changes.")
    owner = hidden("Direct Neon owner URL (hidden): ")
    url = owner_url(owner)
    target = resume[1] if resume else input("Type the approved branch endpoint hostname/lunia_preview from Neon: ").strip()
    if target != url.hostname + url.path:
        raise SetupError("Target confirmation does not match.")
    secret = hidden("Existing PAYLOAD_SECRET used for this preview (hidden): ", 32)
    email = input("Approved editor/test email: ").strip()
    if "@" not in email or any(c in email for c in "\r\n"):
        raise SetupError("An approved editor email is required.")
    env = child_env(owner, secret, email, target)
    metadata = psql("Target check", "SELECT current_user || '|' || current_database() || '|' || current_setting('server_version_num');", env)
    values = metadata.split("|")
    if len(values) != 3 or values[:2] != ["neondb_owner", DATABASE] or not 180000 <= int(values[2]) < 190000:
        raise SetupError("Expected owner, lunia_preview and PostgreSQL 18.")
    if psql("Existing installation check", "SELECT to_regclass('public.users') IS NOT NULL;", env) == "t":
        if psql("Existing editor check", "SELECT count(*) FROM public.users;", env) != "0":
            raise SetupError("An editor already exists; this first-setup helper will not rotate passwords or repeat setup.")
    elif resume:
        raise SetupError("Editor table missing; resume stopped without changes.")

    if resume:
        verify_resume(env)
        print("Existing backup, migrations, zero editors and runtime grants verified. Resuming password/bootstrap only.")
    # Validate all new passwords before any database mutation or backup work.
    password = confirmed_password("New runtime database password", 24)
    editor_password = confirmed_password("First editor password", 16)
    backup = resume[0] if resume else verified_backup(env, run, psql, child_env, SetupError)
    env["LUNIA_BACKUP_REFERENCE"] = backup
    operator = ["node_modules/.bin/tsx", "scripts/preview-operator.ts"]
    if not resume:
        run("Migration", operator + ["migrate"], env)
        print("Migrations completed.")
        psql("Runtime grants", GRANTS, env)
    set_runtime_password(env, password)
    runtime = runtime_url(owner, password)
    runtime_env = child_env(runtime, secret, email, target, backup)
    psql("Restricted runtime access", RUNTIME_CHECK, runtime_env)
    print("Runtime password set; restricted connection and transactional read/write check passed.")
    run("Editor bootstrap", operator + ["bootstrap"], runtime_env,
        json.dumps({"email": email, "password": editor_password}))
    print("First editor created. No supplied connection URLs or passwords were printed or saved.")
    print("In Neon choose this branch/database, lunia_runtime and pooling. Enter that runtime URL directly into the branch-only Vercel secure field. Hosted acceptance is still required.")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        message = str(error) if isinstance(error, SetupError) else "Setup stopped; keep hosted CMS disabled."
        print(message, file=sys.stderr)
        sys.exit(1)
