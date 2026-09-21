import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SharedArrayBuffer — which carries the per-band realtime waveform data from
// the AudioWorklet to the UI — is only available on a cross-origin-isolated
// page. Both the dev server and `vite preview` need these headers, or the
// waveforms silently go blank. Production deploys set them in vercel.json.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
});
