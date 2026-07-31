function firstQueryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function apiPathFromRequest(request, url) {
  const queryPath = firstQueryValue(request.query?.path);
  if (typeof queryPath === 'string') return queryPath;
  return url.searchParams.get('path') || '';
}

export function restoreApiRequestUrl(request) {
  const url = new URL(request.url || '/', 'http://vercel.internal');
  const rewrittenPath = apiPathFromRequest(request, url)
    .replace(/^\/+/, '');

  url.pathname = rewrittenPath ? `/api/${rewrittenPath}` : '/api/';
  url.searchParams.delete('path');
  request.url = `${url.pathname}${url.search}`;
  return request.url;
}

export function createServerlessHandler({ buildApp, loadEnv }) {
  let appPromise;

  function getApp() {
    if (!appPromise) {
      appPromise = Promise.resolve()
        .then(() => loadEnv())
        .then((env) => buildApp({
          env,
          serveStatic: false,
          realtimeMode: 'polling',
        }))
        .then(async (app) => {
          await app.ready();
          return app;
        });
    }
    return appPromise;
  }

  return async function serverlessHandler(request, response) {
    restoreApiRequestUrl(request);
    const app = await getApp();
    app.server.emit('request', request, response);
  };
}
