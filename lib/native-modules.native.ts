// lib/native-modules.native.ts
// Modul native-only. File ini TIDAK akan dibundel untuk platform web
// karena Metro memilih `.web.ts` saat bundling untuk web.
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as MediaLibraryNative from 'expo-media-library';
import { captureRef as captureRefNative } from 'react-native-view-shot';

export { FileSystemLegacy, MediaLibraryNative, captureRefNative };