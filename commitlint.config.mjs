/** @type {import('@commitlint/types').UserConfig} */
const Configuration = {
  // Use conventional commit rules
  extends: ['@commitlint/config-conventional'],

  // Use conventional changelog parser
  parserPreset: 'conventional-changelog-atom',

  // Use built-in formatter
  formatter: '@commitlint/format',

  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // ✨ A new feature
        'fix', // 🐛 A bug fix
        'docs', // 📝 Documentation changes
        'style', // 💄 Code style (formatting only)
        'refactor', // ♻️ Code refactor without new features or fixes
        'perf', // ⚡️ Performance improvements
        'test', // ✅ Test updates or additions
        'build', // 📦 Build or dependency changes
        'ci', // 🤖 CI/CD pipeline updates
        'chore', // 🔧 Miscellaneous chores
        'revert',
      ],
    ],
    'scope-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 150],
  },

  // Ignore empty commits
  ignores: [(commit) => commit === ''],

  defaultIgnores: true,

  // Help URL on failure
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',

  // Commit prompt support (used by commitizen or `@commitlint/prompt`)
  prompt: {
    messages: {
      type: "Select the type of change that you're committing:",
    },
    questions: {
      type: {
        description: 'Please choose the type of change:',
      },
      scope: {
        description: 'What is the scope of this change (e.g. component or file name)?',
      },
      subject: {
        description: 'Write a short, imperative description of the change:',
      },
    },
  },

  examples: {
    valid: [
      'feat(api): add login endpoint',
      'fix(auth): handle token expiration',
      'docs(readme): update setup instructions',
      'style(button): adjust padding and spacing',
      'refactor(utils): simplify validation logic',
      'perf(db): improve query speed',
      'test(auth): add test for invalid credentials',
      'build(deps): update AWS SDK',
      'ci(github): add build matrix to workflow',
      'chore: rename unused files',
      'revert: revert feat(api): add login endpoint',
    ],
    invalid: [
      'fix',
      'update README',
      'test:',
      'feat(auth):',
      'feat(api): add login endpoint that supports multiple roles, retries, and fallback logic with external validation',
    ],
  },
};

export default Configuration;
