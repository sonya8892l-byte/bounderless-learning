import { teacherAuthenticatedFetch } from './teacher-auth.js';

const CONFIG_URL = '/api/map-config';
const GROUP_ZOOM_THRESHOLD = 16.5;

let configPromise = null;
let loaderPromise = null;
let map = null;
let mapContainer = null;
let activeRunId = null;
let groupMarkers = [];
let participantMarkers = [];

function validPosition(location) {
  const lng = Number(location?.lng);
  const lat = Number(location?.lat);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

async function getMapConfig() {
  if (!configPromise) {
    configPromise = teacherAuthenticatedFetch(CONFIG_URL, { headers: { 'x-teacher-id': 'teacher-demo' } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || '地图配置读取失败');
        if (!body.key) throw new Error('高德地图 Key 尚未配置');
        return body;
      })
      .catch((error) => {
        configPromise = null;
        throw error;
      });
  }
  return configPromise;
}

function loadAmap(config) {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (config.securityCode) window._AMapSecurityConfig = { securityJsCode: config.securityCode };
    const callbackName = `__teacherAmapReady_${Date.now()}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => finish(new Error('高德地图加载超时')), 10_000);
    const finish = (error) => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.onerror = null;
      if (error) {
        loaderPromise = null;
        reject(error);
      } else resolve(window.AMap);
    };
    window[callbackName] = () => finish(window.AMap ? null : new Error('高德地图初始化失败'));
    script.onerror = () => finish(new Error('高德地图资源加载失败'));
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&plugin=AMap.Scale&callback=${callbackName}`;
    document.head.appendChild(script);
  });
  return loaderPromise;
}

function setMapStatus(kind, message, detail = '') {
  const status = document.querySelector('#mapStatus');
  if (!status) return;
  status.hidden = kind === 'ready';
  status.classList.toggle('is-error', kind === 'error');
  status.querySelector('strong').textContent = message;
  status.querySelector('small').textContent = detail;
}

function markerButton({ label, ariaLabel, group = false, status = 'fresh', alertCount = 0, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = [
    'map-marker',
    group ? 'map-marker--group' : 'map-marker--participant',
    status === 'lost' ? 'is-lost' : status === 'stale' ? 'is-stale' : '',
    alertCount ? 'has-alert' : '',
  ].filter(Boolean).join(' ');
  button.setAttribute('aria-label', ariaLabel);
  const text = document.createElement('span');
  text.textContent = label;
  button.appendChild(text);
  if (alertCount) {
    const badge = document.createElement('i');
    badge.className = 'marker-badge';
    badge.textContent = String(alertCount);
    button.appendChild(badge);
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick?.();
  });
  return button;
}

function groupPosition(group) {
  const positions = group.members.map((member) => validPosition(member.location)).filter(Boolean);
  if (!positions.length) return null;
  return [
    positions.reduce((sum, item) => sum + item[0], 0) / positions.length,
    positions.reduce((sum, item) => sum + item[1], 0) / positions.length,
  ];
}

function positionStatus(members) {
  if (members.some((member) => member.positionStatus === 'lost')) return 'lost';
  if (members.some((member) => member.positionStatus === 'stale')) return 'stale';
  return 'fresh';
}

function clearMarkers() {
  const overlays = [...groupMarkers, ...participantMarkers];
  if (map && overlays.length) map.remove(overlays);
  groupMarkers = [];
  participantMarkers = [];
}

function syncMarkerLevel() {
  if (!map) return;
  const showParticipants = map.getZoom() > GROUP_ZOOM_THRESHOLD;
  groupMarkers.forEach((marker) => showParticipants ? marker.hide() : marker.show());
  participantMarkers.forEach((marker) => showParticipants ? marker.show() : marker.hide());
}

function renderMarkers(AMap, { groups, participants, alerts, onOpenGroup, onOpenParticipant }) {
  clearMarkers();
  groupMarkers = groups.map((group, index) => {
    const position = groupPosition(group);
    if (!position) return null;
    const groupAlerts = alerts.filter((alert) => alert.groupId === group.id);
    const status = positionStatus(group.members);
    return new AMap.Marker({
      position,
      anchor: 'bottom-center',
      zIndex: groupAlerts.length ? 160 : 120,
      title: `${group.name} · ${group.onlineCount}/${group.members.length}人在线`,
      content: markerButton({
        label: `${index + 1}组`,
        group: true,
        status,
        alertCount: groupAlerts.length,
        ariaLabel: `${group.name}，${group.onlineCount}/${group.members.length}人在线，${groupAlerts.length}个异常`,
        onClick: () => onOpenGroup?.(group.id),
      }),
    });
  }).filter(Boolean);

  participantMarkers = participants.map((participant) => {
    const position = validPosition(participant.location);
    if (!position) return null;
    const participantAlerts = alerts.filter((alert) => alert.participantId === participant.id);
    const accuracy = Number(participant.location?.accuracyMeters);
    const updated = participant.positionStatus === 'fresh'
      ? `${participant.positionAgeSeconds}秒前更新`
      : `位置可能已过期，${Math.floor(participant.positionAgeSeconds / 60)}分钟前更新`;
    return new AMap.Marker({
      position,
      anchor: 'bottom-center',
      zIndex: participantAlerts.length ? 150 : 110,
      title: `${participant.name} · ${participant.roleName} · ${updated}`,
      content: markerButton({
        label: participant.roleName?.slice(0, 1) || '员',
        status: participant.positionStatus,
        alertCount: participantAlerts.length,
        ariaLabel: `${participant.name}，${participant.roleName}，${updated}${Number.isFinite(accuracy) ? `，精度约${Math.round(accuracy)}米` : ''}`,
        onClick: () => onOpenParticipant?.(participant.id),
      }),
    });
  }).filter(Boolean);

  map.add([...groupMarkers, ...participantMarkers]);
  syncMarkerLevel();
}

export async function mountTeacherMap(container, data) {
  if (!container?.isConnected) return false;
  setMapStatus('loading', '正在连接高德地图', '学生位置将显示在真实地图上');
  try {
    const [config, AMap] = await getMapConfig().then(async (resolved) => [resolved, await loadAmap(resolved)]);
    if (!container.isConnected) return false;
    if (!map || mapContainer !== container) {
      map?.destroy();
      mapContainer = container;
      map = new AMap.Map(container, {
        zoom: 15,
        mapStyle: 'amap://styles/normal',
        viewMode: '2D',
        features: ['bg', 'road', 'point'],
        showLabel: true,
        dragEnable: true,
        zoomEnable: true,
      });
      map.addControl(new AMap.Scale({ position: 'LB' }));
      map.on('zoomend', syncMarkerLevel);
    }
    const shouldFit = activeRunId !== data.runId || !groupMarkers.length;
    activeRunId = data.runId;
    renderMarkers(AMap, data);
    if (shouldFit) fitTeacherMap();
    setMapStatus('ready', '', '');
    return true;
  } catch (error) {
    setMapStatus('error', '高德地图暂未加载', String(error.message || '请检查网络后重试；下方已切换为位置列表'));
    return false;
  }
}

export function fitTeacherMap() {
  if (!map || !groupMarkers.length) {
    setMapStatus('error', '暂无可定位成员', '位置列表仍可用于查看小组状态');
    return false;
  }
  map.setFitView(groupMarkers, false, [72, 72, 96, 72], 16);
  return true;
}

export function resizeTeacherMap() {
  map?.resize();
}
