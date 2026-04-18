import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

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
    ignores: ["out/**", "dist/**", "**/*.d.ts"],
  },
]);
