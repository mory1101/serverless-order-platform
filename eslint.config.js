const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    // Apply configuration to all JavaScript files
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            // Enables modern features while maintaining CommonJS structure
            sourceType: "commonjs", 
            globals: {
                ...globals.node, // Enables process.env, require, module, etc.
                ...globals.jest  // Optional: Enables test globals if using Jest
            }
        },
        rules: {
            // Customize your team's code style rules here
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-console": "off", // Allowed since Azure Functions use context.log or console
            "indent": ["error", 4], // Matches the 4-space indent in your earlier code
            "quotes": ["error", "double"],
            "semi": ["error", "always"]
        }
    }
];
