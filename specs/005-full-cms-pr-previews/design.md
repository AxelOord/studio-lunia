# Design

Detailed recommendation: docs/full-cms-preview-decision.md.

R-1: Reuse Payload, private Blob and restricted preview email. Configure trusted branch
origin consistently and preserve editor credentials through idempotent setup.
R-2: Native Preview-only Neon branching; shared private preview Blob store with branch
namespace checks. Owner-capable runtime and shared preview tokens are disclosed tradeoffs,
not production access. Enforce trusted-code and fork restrictions.
R-3: Standard Vercel Git builds run committed migrations under a DB lock before building.
Use additive changes, preserve branch data, verify superseded builds and fail honestly.
Keep current provider retention and handle branch-cap exhaustion explicitly.
R-4: Native setup operator handles secrets privately. No provisioning controller unless
actual native limitations require one; no purchases or changes to the old site.
