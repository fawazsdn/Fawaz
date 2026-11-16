const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// web/ is the separate Next.js website; keep it out of the app bundle and file watcher.
const webDir = path.join(__dirname, 'web').replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [new RegExp(`^${webDir}[/\\\\].*`)];

if (process.env.APP_VARIANT === 'staging') {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const fromSupabase = context.originModulePath === path.join(__dirname, 'src/lib/supabase.ts');
    const target = fromSupabase && moduleName === './productionPublishableKey'
      ? './stagingPublishableKey'
      : moduleName;
    return context.resolveRequest(context, target, platform);
  };
}

module.exports = config;
