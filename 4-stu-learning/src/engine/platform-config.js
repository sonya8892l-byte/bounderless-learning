const publicBaseUrl = import.meta.env?.BASE_URL || '/';
const publicAsset = (path) => `${publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`}${path.replace(/^\/+/, '')}`;

export const PLATFORM_COMPANION = Object.freeze({
  name: '絮絮',
  character: '亲切、好奇、有少年感，尊重学生的观察和试错过程',
  tone: '清晰、自然、耐心，偶尔幽默',
  posterAsset: publicAsset('assets/images/xuxu-avatar.png'),
  idleAsset: publicAsset('assets/video/xuxu-idle.webm'),
  talkAsset: publicAsset('assets/video/xuxu-talk.webm'),
});

export const PLATFORM_LEARNING_VIEW = Object.freeze({
  enabled: true,
  default: 'dialogue',
  allowStudentSwitch: true,
});
