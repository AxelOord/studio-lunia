# Tasks

- [x] T-1: Inspect guidance, history, runtime and merge settings
      Refs: R-1, R-2, R-3, R-4
      Depends: none
      Verify: Read AGENTS, scripts, issue20, history and repository merge settings.
      Evidence: develop168fc9b includes user-merged PR19; history mixes conventional and plain subjects. Merge/squash/rebase enabled, default master; Node24.19.0/npm11.9.0 verified.
- [ ] T-2: Implement and verify hooks and read-only CI
      Refs: R-1, R-2, R-3, R-4
      Depends: T-1
      Verify: Clean npm ci, real hook tests, check/format and exact-head CI including Windows.
      Evidence: Clean npm ci, check (19 unit and 35 Python tests), four real-hook scenarios and formatting pass locally. review.md records evidence; exact-head Linux/Windows CI remains pending on the draft PR.

- [x] T-3: Extend the spec with versioning and release/status boundaries
      Refs: R-5
      Depends: T-1
      Verify: Compare proposed branching to official Release Please behavior; document candidate/version/issue identity and activation permissions.
      Evidence: release-plan.md records the exact promotion sequence, immutable legacy baseline, manual first-release recommendation and deferred automation/setup. No release/status code was added.
