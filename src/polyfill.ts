// Global polyfill for axios and other modules that check navigator in Node.js
// This MUST run before any other imports

if (typeof (globalThis as any).navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'Node.js',
      platform: 'linux'
    },
    writable: true,
    configurable: true
  });
}

// Also set window if it doesn't exist (some modules check for it)
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
