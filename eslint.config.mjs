import js from "@eslint/js";
import globals from "globals";
import next from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";

export default [
  js.configs.recommended,

  // ✅ TypeScript + TSX files
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: false
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "@next/next": next
    },
    rules: {
      ...next.configs["core-web-vitals"].rules
    }
  },

  // ✅ JS files
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },

  // ✅ ignore junk/vendor/build outputs
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/vendor/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/.vercel/**",
      "**/.turbo/**",
      "**/generated/**",
      "**/output/**",
      "**/downloads/**"
    ]
  }
];