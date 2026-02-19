import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.purgehub.app',
  appName: 'Purge Hub',
  webDir: 'dist',
  server: {
    url: 'https://57a58703-71d3-4794-a6d6-398931acd9e6.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
