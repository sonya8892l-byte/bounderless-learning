export function resetShellScrollOffsets({
  windowObject = globalThis.window,
  documentObject = globalThis.document,
  app = documentObject?.querySelector?.('#studentApp'),
} = {}) {
  windowObject?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  if (documentObject?.documentElement) documentObject.documentElement.scrollTop = 0;
  if (documentObject?.body) documentObject.body.scrollTop = 0;
  if (app) app.scrollTop = 0;

  const learningContent = documentObject?.querySelector?.('.learning-content');
  if (learningContent) {
    learningContent.scrollTop = 0;
    learningContent.scrollLeft = 0;
    learningContent.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }

  documentObject?.querySelectorAll?.('.tab-panel')?.forEach((panel) => {
    panel.scrollTop = 0;
    panel.scrollLeft = 0;
  });
}
