import { defineConfig } from 'vite';

export default defineConfig({
  // Si el repo se llama 'AsistenciaV2', el base debe ser '/AsistenciaV2/'
  // Por ahora usamos './' para que sea relativo y funcione en cualquier subcarpeta
  base: './',
  build: {
    outDir: 'dist',
  }
});
