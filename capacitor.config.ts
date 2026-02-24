import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.purgehub.app',
  appName: 'Purge Hub',
  webDir: 'dist',
  server: {
    url: 'https://purge-hub-social-einm.vercel.app',
    cleartext: true,
  },
};

export default config;
