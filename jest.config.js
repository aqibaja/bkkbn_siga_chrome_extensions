module.exports = {
    testEnvironment: 'jsdom',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'popup.js',
        '!node_modules/**',
        '!coverage/**'
    ],
    testMatch: [
        '**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
