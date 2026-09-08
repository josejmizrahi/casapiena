import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Atrapa en build lo que no debe llegar a producción: variables sin importar,
// hooks mal usados, JSX con referencias indefinidas.
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "react/jsx-no-undef": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true, caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
