import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/naming-convention": "off",
      "curly": "off",
      "eqeqeq": "warn",
      "semi": "warn",
    },
  },
  {
    files: ["*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: { "no-undef": "error" },
  },
  {
    ignores: ["out/**", "dist/**", "**/*.d.ts"],
  },
]);
