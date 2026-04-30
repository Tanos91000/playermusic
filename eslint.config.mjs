import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-unused-vars": "off"
    }
  },
  globalIgnores([
    "dist/**",
    "dist-electron/**",
    "node_modules/**"
  ])
]);
