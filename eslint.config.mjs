import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
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
);
