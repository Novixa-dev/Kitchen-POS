import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "*.config.js", "*.config.mjs"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ─── TypeScript Strict Rules ───
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/return-await": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
        },
      ],

      // ─── General JS/TS Best Practices ───
      "no-console": ["off"], // Backend often needs console for logs
      "no-debugger": "error",
      "no-alert": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-expressions": "error",
      "no-duplicate-imports": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "object-shorthand": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-throw-literal": "error",
    },
  },
  {
    // Test files may use non-null assertions. In production a wrong `!` is a
    // crash in front of a customer; in a test it is an immediate, loud
    // failure — which is the signal the test exists to give. Every other
    // strict rule still applies here.
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      // A test may compare method identity — "does restore put back the same
      // function" is a thing worth asserting, and there is no call involved.
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
