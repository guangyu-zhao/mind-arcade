import config from './playwright.config.js';
export default {
  ...config,
  outputDir: 'test-results-built',
  testMatch: ['**/smoke.spec.js', '**/languages.spec.js', '**/appearance.spec.js'],
  use: { ...config.use, baseURL: 'http://127.0.0.1:4174/mind-arcade/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/mind-arcade/',
    reuseExistingServer: !process.env.CI,
  },
};
