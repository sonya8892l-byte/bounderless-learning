import { createIcons, icons } from 'lucide';
import './styles.css';
import './tool-gallery.css';
import { renderActivityTools } from './components/activity-tools.js';

const groups = [
  { id: 'collect', label: '采集记录', tools: ['photo', 'audio', 'text'] },
  { id: 'reason', label: '分析表达', tools: ['sketch', 'quiz'] },
  { id: 'model', label: '建模推演', tools: ['builder', 'simulation'] },
  { id: 'share', label: '协作媒介', tools: ['team', 'media', 'scanner'] },
];

const tools = [
  {
    id: 'photo', module: 'A01', name: '拍照采集', icon: 'camera',
    config: { minCount: 5, maxCount: 8, prompt: '拍摄螭首的正面、侧面、出水口与排列细节，至少5张。' },
  },
  {
    id: 'audio', module: 'A01', name: '语音记录', icon: 'mic',
    config: { minSeconds: 10, maxSeconds: 60, prompt: '口述你的流速测量方法，并说明哪个数据最不确定。' },
  },
  {
    id: 'text', module: 'A01', name: '文字表单', icon: 'notebook-pen',
    config: {
      fields: [
        { id: 'height', label: '估测高差（m）', type: 'number', required: true },
        { id: 'distance', label: '估测距离（m）', type: 'number', required: true },
        { id: 'method', label: '估测方法', type: 'long_text', required: true, placeholder: '说明你如何通过目测和步测得到数据…' },
      ],
    },
  },
  {
    id: 'sketch', module: 'A01', name: '画板标注', icon: 'pen-tool',
    config: { width: 720, height: 360, prompt: '标出高点、低点与排水设施，用箭头画出水流方向。' },
  },
  {
    id: 'quiz', module: 'A02', name: '答题评测', icon: 'list-checks',
    config: {
      type: 'multiple_choice',
      question: '护城河除了防御，还承担了哪些功能？（多选）',
      options: ['汇集并暂存雨水', '消防水源', '城市景观', '加速台基风化'],
      answer: ['汇集并暂存雨水', '消防水源', '城市景观'],
    },
  },
  {
    id: 'builder', module: 'A03', name: '拼合搭建', icon: 'blocks',
    config: {
      prompt: '把排水设施卡片放入对应层级，拼出故宫排水网络。',
      items: [
        { id: 'roof', label: '屋顶与螭首' },
        { id: 'yard', label: '院落明沟' },
        { id: 'ditch', label: '地下干沟' },
        { id: 'river', label: '内金水河' },
      ],
      zones: [
        { id: 'collect', label: '一级 · 就地集水' },
        { id: 'transfer', label: '二级 · 沟渠转输' },
        { id: 'store', label: '三级 · 河道蓄排' },
      ],
    },
  },
  {
    id: 'simulation', module: 'A04', name: '沙盘推演', icon: 'waves',
    config: {
      rounds: 3,
      allowRepeat: false,
      prompt: '选择降雨强度，运行推演并观察河道水位与溢流风险。',
      resources: { 管网容量: '75%', 护城河余量: '42%' },
      metrics: [
        { id: 'level', label: '河道水位', initialLabel: '正常' },
        { id: 'risk', label: '溢流风险', initialLabel: '低' },
      ],
      choices: [
        { id: 'normal', label: '正常降雨' },
        { id: 'medium', label: '持续中雨' },
        { id: 'storm', label: '短时暴雨' },
      ],
    },
  },
  {
    id: 'team', module: 'A05', name: '团队协作', icon: 'users',
    config: {
      prompt: '汇总不同角色的证据，保留数据来源和不同意见。',
      minimumEntries: 3,
      roles: ['数龙官', '测坡官', '寻沟官', '引河官', '护城官', '真相官'],
      recordTypes: ['现场证据', '估算数据', '质疑与修正'],
    },
  },
  {
    id: 'media', module: 'A06', name: '沉浸媒体', icon: 'play',
    config: {
      type: 'image',
      url: './lessons/lesson_gewu_001/assets/videos/video-simulation.png',
      title: '暴雨来临：故宫排水系统验证',
      prompt: '查看模拟画面，留意最先出现水位变化的环节。',
      requireCompletion: true,
    },
  },
  {
    id: 'scanner', module: 'A07', name: '扫码识别', icon: 'scan-line',
    config: { mode: 'qr', allowManualEntry: true, prompt: '扫描其他角色的证据二维码，或输入证据码完成交换。' },
  },
];

const evidence = {
  imageUrls: [],
  toolValues: {
    'audio-demo': { audio: { durationSeconds: 24, transcript: '我用水面漂浮物经过固定距离的时间来估测流速。' } },
    'text-demo': { text: { fields: { height: '2', distance: '960', method: '选择南北轴线上两个安全观测点，用步数换算距离，并结合台阶高差估算。' } } },
    'quiz-demo': { quiz: { answer: ['汇集并暂存雨水', '消防水源'], checked: false } },
    'builder-demo': { builder: { placements: { collect: ['roof'], transfer: ['yard'], store: [] } } },
    'simulation-demo': { simulation: { pendingChoice: 'storm', history: [], metrics: { level: '正常', risk: '低' } } },
    'team-demo': { team: { entries: [{ role: '测坡官', type: '估算数据', text: '南北轴线整体北高南低，雨水自然向南汇流。' }] } },
    'media-demo': { media: { completed: false } },
    'scanner-demo': { scanner: { manual: 'EVIDENCE-Y-1142', result: '数龙官 · 螭首数量估算证据' } },
  },
};

const requestedGroup = new URLSearchParams(location.search).get('group');
const activeGroup = groups.find((group) => group.id === requestedGroup) || groups[0];
const visibleTools = activeGroup.tools.map((id) => tools.find((tool) => tool.id === id));
const gallery = document.querySelector('#toolGallery');

gallery.innerHTML = `
  <header class="gallery-hero">
    <a href="./" class="gallery-back"><i data-lucide="arrow-left"></i>学生端</a>
    <span class="gallery-kicker">故宫课程 · 工具验收台</span>
    <h1>每一种任务，都应该打开对应的工具</h1>
    <p>当前展示使用学生端真实活动组件与故宫任务示例参数。</p>
  </header>
  <nav class="gallery-tabs" aria-label="工具分类">
    ${groups.map((group) => `<a href="?group=${group.id}" class="${group.id === activeGroup.id ? 'is-active' : ''}">${group.label}<small>${group.tools.length}项</small></a>`).join('')}
  </nav>
  <section class="gallery-section">
    <div class="gallery-section__head"><span>${activeGroup.label}</span><strong>${visibleTools.map((tool) => tool.name).join(' · ')}</strong></div>
    ${visibleTools.map((tool) => `
      <article class="gallery-item" id="tool-${tool.id}">
        <div class="gallery-item__meta"><span>${tool.module}</span><strong>${tool.name}</strong><em>${tool.id}</em></div>
        ${renderActivityTools({ tools: [tool], evidence, allEvidence: {}, taskId: `${tool.id}-task`, stepId: `${tool.id}-demo` })}
      </article>
    `).join('')}
  </section>
  <footer class="gallery-footer">10种平台工具 · 使用真实渲染器 · 故宫任务参数示例</footer>
`;

createIcons({ icons });
