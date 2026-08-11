import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { renderActivityTools } from '../src/components/activity-tools.js';
import { resetShellScrollOffsets } from '../src/engine/shell-scroll.js';

test('resetShellScrollOffsets restores the clipped learning shell after a file picker returns', () => {
  const learningContent = {
    scrollTop: 1469,
    scrollLeft: 12,
    scrollTo({ top, left }) {
      this.scrollTop = top;
      this.scrollLeft = left;
    },
  };
  const panels = [
    { scrollTop: 320, scrollLeft: 5 },
    { scrollTop: 240, scrollLeft: 4 },
  ];
  const documentObject = {
    documentElement: { scrollTop: 100 },
    body: { scrollTop: 80 },
    querySelector(selector) {
      if (selector === '#studentApp') return this.app;
      if (selector === '.learning-content') return learningContent;
      return null;
    },
    querySelectorAll(selector) {
      return selector === '.tab-panel' ? panels : [];
    },
    app: { scrollTop: 60 },
  };
  const windowObject = {
    top: 44,
    left: 21,
    scrollTo({ top, left }) {
      this.top = top;
      this.left = left;
    },
  };

  resetShellScrollOffsets({ windowObject, documentObject });

  assert.deepEqual([windowObject.top, windowObject.left], [0, 0]);
  assert.equal(documentObject.documentElement.scrollTop, 0);
  assert.equal(documentObject.body.scrollTop, 0);
  assert.equal(documentObject.app.scrollTop, 0);
  assert.deepEqual([learningContent.scrollTop, learningContent.scrollLeft], [0, 0]);
  assert.deepEqual(panels.map((panel) => [panel.scrollTop, panel.scrollLeft]), [[0, 0], [0, 0]]);
});

test('scanner input stays on the visible upload control and the shell cannot become a focus scroll container', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const learningContentRule = styles.match(/\.learning-content\s*\{([^}]*)\}/s)?.[1] || '';
  const activityUploadRule = styles.match(/\.activity-upload\s*\{([^}]*)\}/s)?.[1] || '';
  const activityInputRule = styles.match(/\.activity-upload input\s*\{([^}]*)\}/s)?.[1] || '';

  assert.match(learningContentRule, /overflow:\s*clip/);
  assert.match(activityUploadRule, /position:\s*relative/);
  assert.match(activityUploadRule, /overflow:\s*hidden/);
  assert.match(activityInputRule, /inset:\s*0/);
  assert.match(activityInputRule, /width:\s*100%/);
  assert.match(activityInputRule, /height:\s*100%/);

  const html = renderActivityTools({
    tools: [{ id: 'scanner', name: '扫码识别', module: 'A07', config: { mode: 'qr' } }],
    evidence: { toolValues: {} },
    taskId: 'scanner-fixture-task',
    stepId: 'scanner-fixture-step',
  });
  assert.match(html, /data-scan-file/);
  assert.match(html, /capture="environment"/);
});

test('file picker return paths keep a layout-only recovery guard', async () => {
  const controller = await readFile(new URL('../src/app-controller.js', import.meta.url), 'utf8');
  assert.match(controller, /addEventListener\('cancel'/);
  assert.match(controller, /addEventListener\('focus'/);
  assert.match(controller, /addEventListener\('pageshow'/);
  assert.match(controller, /addEventListener\('visibilitychange'/);
  assert.match(controller, /scheduleFilePickerLayoutRestore/);
});
