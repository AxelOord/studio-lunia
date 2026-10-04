"""Pre-migration archive and disposable restore, using the operator's private environment."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

COUNTS = """SELECT format('SELECT %L, count(*) FROM %I.%I;',
  schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\\gexec
"""


def encrypted_directory(run, env, error):
    home = Path.home().resolve()
    # FileVault protects the Data volume at rest. Do not assume external/home mounts
    # share that encryption. Other destinations need the user's explicit confirmation.
    if sys.platform == "darwin":
        try:
            status = run("FileVault check", ["/usr/bin/fdesetup", "status"], env, timeout=15)
            if (status.strip() == "FileVault is On."
                    and home.stat().st_dev == Path("/System/Volumes/Data").stat().st_dev):
                return Path(tempfile.mkdtemp(prefix="StudioLuniaBackup-", dir=home))
        except (OSError, error):
            pass
    print("The archive is plaintext at file level: its destination must be encrypted storage.")
    directory = Path(input("Existing directory on encrypted storage (FileVault/encrypted volume): ").strip()).expanduser().resolve()
    if not directory.is_dir() or input("Type ENCRYPTED to confirm this storage is encrypted: ").strip() != "ENCRYPTED":
        raise error("Encrypted backup storage not confirmed; no migration started.")
    return Path(tempfile.mkdtemp(prefix="StudioLuniaBackup-", dir=directory))


def schema(run, env):
    sql = run("Schema verification", ["pg_dump", "--schema-only", "--no-owner", "--no-privileges"], env)
    # PG18 emits a random psql restriction key in each dump. Exclude only that and
    # comments/blank lines; preserve schema SQL for comparison.
    return "\n".join(line for line in sql.splitlines()
                     if line.strip() and not line.startswith(("--", "\\restrict ", "\\unrestrict ")))


def counts(run, env):
    return run("Row-count verification", ["psql", "-X", "-qAt", "--set", "ON_ERROR_STOP=1", "--file", "-"], env, COUNTS)


def verified_backup(env, run, psql, child_env, error):
    directory = encrypted_directory(run, child_env(""), error)
    os.chmod(directory, 0o700)
    archive = directory / "before-migration.dump"
    manifest = directory / "verified-backup.json"
    restore_name = "lunia_restore_check_" + uuid4().hex[:16]
    created = False
    try:
        # Source content must be quiescent: this helper is first-setup only and the
        # hosted CMS remains disabled. No pg_dump credential is supplied in argv.
        descriptor = os.open(archive, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            result = subprocess.run(["pg_dump", "--format=custom"], env=env,
                                    stdout=output, stderr=subprocess.PIPE,
                                    timeout=300, start_new_session=True)
            if result.returncode:
                raise error("Backup export failed; output withheld. No migration started.")
            output.flush()
            os.fsync(output.fileno())
        if stat.S_IMODE(archive.stat().st_mode) != 0o600 or archive.stat().st_size == 0:
            raise error("Backup file verification failed; no migration started.")
        run("Archive verification", ["pg_restore", "--list", str(archive)], env)
        source_schema = schema(run, env)
        source_counts = counts(run, env)
        # The name is generated here, never taken from user input or the source URL.
        psql("Create disposable restore database", f'CREATE DATABASE "{restore_name}" TEMPLATE template0;', env)
        created = True
        psql("Restrict restore database", f'REVOKE ALL ON DATABASE "{restore_name}" FROM PUBLIC;', env)
        source = urlsplit(env["DATABASE_URL"])
        destination = urlunsplit((source.scheme, source.netloc, "/" + restore_name, source.query, ""))
        restored_env = child_env(destination)
        run("Restore verification", ["pg_restore", "--exit-on-error", "--single-transaction",
                                     "--no-owner", "--no-privileges", "--dbname", restore_name,
                                     str(archive)], restored_env)
        if schema(run, restored_env) != source_schema or counts(run, restored_env) != source_counts:
            raise error("Restored schema or row counts differ; no migration started.")
        # Recheck observable consistency. This is not concurrency control: the
        # first-setup source must remain quiescent throughout backup verification.
        if schema(run, env) != source_schema or counts(run, env) != source_counts:
            raise error("Source changed during backup verification; no migration started.")
    except (OSError, subprocess.TimeoutExpired):
        raise error("Backup could not finish; no migration started. No child output was forwarded.") from None
    finally:
        if created:
            # Never DROP the source or a user-supplied identifier. No FORCE/connection termination.
            psql("Remove disposable restore database", f'DROP DATABASE "{restore_name}";', env)
    digest = hashlib.sha256()
    with archive.open("rb") as backup_file:
        for chunk in iter(lambda: backup_file.read(1024 * 1024), b""):
            digest.update(chunk)
    record = {
        "verifiedAt": datetime.now(timezone.utc).isoformat(),
        "source": source.hostname + source.path,
        "archive": archive.name,
        "sha256": digest.hexdigest(),
        "bytes": archive.stat().st_size,
        "restoreVerified": True,
        "verification": "PG18 restore completed; public schema and table counts matched; disposable database removed",
        "encryptionBoundary": "encrypted destination volume; archive is not individually encrypted",
    }
    with os.fdopen(os.open(manifest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as metadata:
        json.dump(record, metadata, indent=2)
        metadata.write("\n")
    print("Backup and disposable restore verified. Keep this directory on encrypted storage:")
    print(str(directory))
    return str(manifest)
