// v3.51 — Enable .wasm import cho expo-sqlite web worker (chạy npm run web)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
