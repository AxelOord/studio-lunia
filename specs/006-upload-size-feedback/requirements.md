# Upload size feedback — bugfix

Workflow: bugfix
Status: ready

## Reproduction and actual behavior

On f6be0ba, an authenticated upload-instructions request with filesize=0 reports
"Upload exceeds the permitted size." This is misleading: the file is empty, not
oversized. Native QA reports that message for a file that is 1629 bytes on disk;
the actual browser request size is not yet confirmed. A local real file-picker
probe with private Blob enabled sends 911 bytes for a 240x160 PNG and receives 200.
Do not infer a valid-file limit failure from disk size alone.

### R-1: Accurate size errors

Reject empty, invalid and oversized upload sizes with distinct actionable errors.
Check: real Payload instruction pipeline returns an empty-file error for zero bytes.

### P-1: Preserve upload protection and valid small uploads

Keep the 20 MiB cap, authenticated access, signed bounded grants, private storage,
namespace checks and actual image validation. Never accept zero-byte data as a fix.
Check: real browser file selection requests the exact positive byte count and gets
instructions; empty and oversized inputs remain rejected.

## Scope and open questions

Narrow adapter feedback and regression coverage only. Native request metadata and
hosted real upload completion remain required; this change does not claim to fix
an unobserved browser/file-transfer problem. Preserve the existing hosted QA page.
