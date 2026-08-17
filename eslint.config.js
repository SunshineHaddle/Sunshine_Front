import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// .claude/worktrees 처럼 tsconfig.json 을 가진 폴더가 안에 생기면
// typescript-eslint 가 루트 후보를 여럿 발견해 파싱 자체를 멈춘다. 여기서 못 박는다.
const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig([
  globalIgnores(['dist', '.claude/worktrees']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: rootDir,
      },
    },
  },
])
