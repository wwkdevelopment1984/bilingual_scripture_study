import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getBilingualChapter,
  ScriptureFetchError,
} from './server/scriptureFetcher.ts';
import { searchScriptures } from './server/scriptureSearch.ts';
import type { SearchVolumeFilter } from './src/types/scripture.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // When the app is reverse-proxied under a path prefix (e.g. Caddy mounts it
  // at /scripture on the home server) set APP_BASE_PATH=/scripture. Empty
  // means "serve at the root", which is the default for local runs.
  const BASE_PATH = (process.env.APP_BASE_PATH || '').replace(/\/+$/, '');

  app.get(`${BASE_PATH}/api/health`, (_req, res) => {
    res.json({ ok: true });
  });

  app.get(`${BASE_PATH}/api/scripture`, async (req, res) => {
    const book = typeof req.query.book === 'string' ? req.query.book : 'john';
    const chapter =
      typeof req.query.chapter === 'string' ? req.query.chapter : '1';
    const bypassCache =
      req.query.refresh === '1' || req.query.refresh === 'true';

    try {
      const data = await getBilingualChapter({ book, chapter, bypassCache });
      res.json(data);
    } catch (err) {
      if (err instanceof ScriptureFetchError) {
        res.status(err.statusCode).json({
          error: err.message,
          retryable: err.retryable,
          details: err.details,
        });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unexpected server error',
        retryable: true,
      });
    }
  });

  app.get(`${BASE_PATH}/api/search`, async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const volume = (
      typeof req.query.volume === 'string' ? req.query.volume : 'all'
    ) as SearchVolumeFilter;
    const page =
      typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;

    try {
      const data = await searchScriptures({
        query,
        volume,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: 15,
      });
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : 'Unable to complete scripture search.',
        retryable: true,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    if (BASE_PATH) {
      // Prefixed deployment: /scripture/ serves the SPA, /scripture/<asset>
      // serves the build output, and unknown /scripture/* paths fall back to
      // index.html so client-side navigation keeps working.
      app.use(BASE_PATH, express.static(distPath));
      app.get(BASE_PATH, (_req, res) => res.redirect(308, `${BASE_PATH}/`));
      app.get(`${BASE_PATH}/*`, (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server listening on http://localhost:${PORT}${BASE_PATH || '/'}`
    );
  });
}

startServer();
