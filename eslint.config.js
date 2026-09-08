import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Atrapa en build lo que antes llegaba a producción: variables sin importar,
// hooks mal usados y JSX con referencias indefinidas.
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023, sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-no-undef": "error",
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true, caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
