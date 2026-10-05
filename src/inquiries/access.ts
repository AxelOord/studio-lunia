// A JSON REST request cannot manufacture this in-process capability.
export const inquiryCapability = Symbol.for('studio-lunia.validated-inquiry')
export function inquiryContext(key: string) {
  return { inquiryCapability, inquiryKey: key }
}
