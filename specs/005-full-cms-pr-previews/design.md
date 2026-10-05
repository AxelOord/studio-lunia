# Design

Recommended design and evidence: docs/full-cms-preview-decision.md.

R-1: Reuse the existing Payload/private-Blob/email paths. Replace exact legacy branch
activation with verified per-PR deployment identity and fixed approved origin only after
full configuration is ready. Showcase is not an automatic failure fallback.
R-2: Reuse the approved existing Neon project with per-PR branches; separate private Blob stores.
Only runtime roles and PR-scoped media capabilities enter Vercel. Management workflow code
is trusted and separate from PR npm/build steps. No privileged pull_request_target checkout.
R-3: Per-PR serialization plus DB advisory locks and current-SHA checks. Idempotent editor
and synthetic baseline, additive migrations, manifest-based cleanup and explicit retention.
R-4: Current native integration supports branching, but restricted runtime/migration split
is not proven. Use a bounded provider spike; prefer one controlled workflow over speculative
integration changes or a new always-running service. All activation is approval-gated.
