module.exports = {
	testEnvironment: 'jsdom',
	testMatch: ['**/__tests__/**/*.test.js'],
	collectCoverageFrom: [
		'src/**/*.js',
		'!src/manifest*.json',
		'!src/background*.js'
	],
	coverageDirectory: 'coverage',
	verbose: true
};
