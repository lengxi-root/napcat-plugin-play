import { resolve } from 'path';
import { defineConfig } from 'vite';
import nodeResolve from '@rollup/plugin-node-resolve';
import { builtinModules } from 'module';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

const nodeModules = [...builtinModules, builtinModules.map((m) => `node:${m}`)].flat();

// 复制资源文件插件
function copyAssetsPlugin () {
  return {
    name: 'copy-assets',
    closeBundle () {
      const srcImage = resolve(__dirname, 'src/data/meme-list.png');
      const destImage = resolve(__dirname, 'dist/meme-list.png');
      if (existsSync(srcImage)) {
        copyFileSync(srcImage, destImage);
        console.log('已复制 meme-list.png 到 dist 目录');
      }
    },
  };
}

export default defineConfig({
  resolve: {
    conditions: ['node', 'default'],
  },
  build: {
    sourcemap: false,
    target: 'esnext',
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: [...nodeModules],
      output: {
        inlineDynamicImports: true,
      },
    },
    outDir: 'dist',
    emptyDirBeforeWrite: true,
  },
  plugins: [nodeResolve(), copyAssetsPlugin()],
});
