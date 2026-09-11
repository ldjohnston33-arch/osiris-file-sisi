import type { NextConfig } from 'next';

/** Sites allowed to embed the tool in an iframe (e.g. an l4global.com post). */
const FRAME_ANCESTORS = process.env.FRAME_ANCESTORS || "'self' https://l4global.com https://*.l4global.com";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      // MapLibre 6 builds its worker URL at runtime; see tools/maplibre-url-loader.cjs.
      'maplibre-gl.mjs': {
        loaders: [`${__dirname}/tools/maplibre-url-loader.cjs`],
        as: '*.js',
      },
    },
  },
  serverExternalPackages: ['ws'],
  transpilePackages: ['maplibre-gl'],
  // The first build runs a full ingest (GDELT asks for 5 s between calls).
  staticPageGenerationTimeout: 300,
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      {
        source: '/vendor/maplibre/:version/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: `default-src 'self' 'unsafe-inline' 'unsafe-eval' https: wss: data: blob:; worker-src 'self' blob:; frame-ancestors ${FRAME_ANCESTORS};` },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
