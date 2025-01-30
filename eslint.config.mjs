/**
 * ESLint configuration for the project.
 * 
 * See https://eslint.style and https://typescript-eslint.io for additional linting options.
 */
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'.vscode-test',
			'out',
			'examples',
			'esbuild.js'
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.stylistic,
	{
		rules: {
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
		}
	}
);