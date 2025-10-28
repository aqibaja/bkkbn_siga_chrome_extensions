// Jest setup file untuk konfigurasi global

// Mock untuk window.scrollTo yang digunakan di PageNavigator
global.scrollTo = jest.fn();

// Mock untuk alert
global.alert = jest.fn();

// Mock untuk confirm
global.confirm = jest.fn(() => true);

// Mock untuk console methods (optional - untuk mengurangi noise)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
// };
