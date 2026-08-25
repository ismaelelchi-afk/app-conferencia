// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite usa WebAssembly en el bundle web (wa-sqlite.wasm).
// Sin esto, Metro falla al resolver el archivo .wasm porque no
// lo reconoce como asset ni como fuente JS.
config.resolver.assetExts.push('wasm');

module.exports = config;
