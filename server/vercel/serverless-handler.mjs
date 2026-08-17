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

function sendBootFailure(response, error) {
  if (response.headersSent || typeof response.end !== 'function') throw error;
  const message = String(error?.message || error || '服务端启动失败。').slice(0, 300);
  response.statusCode = 503;
  response.setHeader?.('content-type', 'application/json; charset=utf-8');
  response.setHeader?.('cache-control', 'no-store');
  response.end(JSON.stringify({
    error: '服务端配置尚未就绪，请检查 TEACHER_ACCOUNTS 等环境变量后重新部署。',
    details: message,
  }));
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
        })
        .catch((error) => {
          appPromise = undefined;
          throw error;
        });
    }
    return appPromise;
  }

  return async function serverlessHandler(request, response) {
    restoreApiRequestUrl(request);
    try {
      const app = await getApp();
      app.server.emit('request', request, response);
    } catch (error) {
      sendBootFailure(response, error);
    }
  };
}
