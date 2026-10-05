# Design

R-1: Separate malformed size, zero-byte input and cap violations in the private
adapter. Keep all checks before generating upload grants.
P-1: Exercise the pinned Payload getUploadInstructions path with a real tiny PNG,
then the actual browser file picker with private Blob configured. Stop at the
provider boundary using a synthetic token and blocked external requests; never
claim that proves hosted upload delivery. Existing integration tests cover finalized
bytes, image decoding, access and deletion.
