# Tasks

- [x] T-1: Reproduce inaccurate empty-file feedback and add upload metadata coverage
      Refs: R-1, P-1
      Depends: none
      Verify: check, Blob integration tests, build and actual browser upload-metadata test.
      Evidence: Empty instructions now report an empty file; real 240x160 PNG keeps its 911-byte size through the file picker and receives 200. Local check/build and new integration regression pass. Cap/auth/private storage unchanged; external provider traffic blocked in browser regression.
- [ ] T-2: Verify exact-head CI and native retry
      Refs: R-1, P-1
      Depends: T-1
      Verify: CI, automatic deployment, native request byte count and successful actual hosted upload.
      Evidence: Native source file is 1629 bytes on disk; actual failing request size and hosted completion remain unconfirmed. Preserve page3 marker20261005-B on rebuild.
