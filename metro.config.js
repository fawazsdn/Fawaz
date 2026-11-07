const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// web/ is the separate Next.js website; keep it out of the app bundle and file watcher.
const webDir = path.join(__dirname, 'web').replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [new RegExp(`^${webDir}[/\\\\].*`)];

module.exports = config;
