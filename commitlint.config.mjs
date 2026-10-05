const config = {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: false,
  rules: {
    // Product and library names can legitimately start a subject.
    'subject-case': [0],
  },
}

export default config
