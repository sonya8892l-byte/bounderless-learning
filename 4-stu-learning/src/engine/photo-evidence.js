function ensurePhotoCollections(evidence, value) {
  evidence.imageUrls ||= [];
  evidence.files ||= [];
  value.imageUrls ||= [];
  value.files ||= [];
  value.dataUrls ||= [];
  value.assetIds ||= [];
  while (value.assetIds.length < value.imageUrls.length) value.assetIds.push(nextAssetId());
  if (value.assetIds.length > value.imageUrls.length) {
    value.assetIds.splice(value.imageUrls.length);
  }
}

function nextAssetId() {
  return globalThis.crypto?.randomUUID?.()
    || `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function removeTaskPhoto(evidence, url) {
  const taskIndex = evidence.imageUrls.indexOf(url);
  if (taskIndex < 0) return;
  evidence.imageUrls.splice(taskIndex, 1);
  evidence.files.splice(taskIndex, 1);
}

function revokeBlobUrl(url, revokeObjectUrl) {
  if (String(url || '').startsWith('blob:')) revokeObjectUrl?.(url);
}

export function appendPhotoBatch(evidence, value, files, imageUrls) {
  ensurePhotoCollections(evidence, value);
  const batch = {
    files: [...files],
    imageUrls: [...imageUrls],
    assetIds: imageUrls.map(() => nextAssetId()),
  };
  evidence.files.push(...batch.files);
  evidence.imageUrls.push(...batch.imageUrls);
  value.files.push(...batch.files);
  value.imageUrls.push(...batch.imageUrls);
  value.assetIds.push(...batch.assetIds);
  value.count = value.imageUrls.length;
  value.processing = true;
  return batch;
}

export function completePhotoBatch(value, dataUrls) {
  value.dataUrls ||= [];
  value.dataUrls.push(...dataUrls);
  value.processing = false;
  value.count = value.imageUrls?.length || 0;
  // 只在图像准备成功后增加版本。服务端会把这个版本和 assetIds 一并纳入
  // Step 证据指纹，因此“删一张再补一张、总数没变”也会被识别为证据修改。
  value.revision = Number(value.revision || 0) + 1;
}

export function rollbackPhotoBatch(evidence, value, batch, { revokeObjectUrl } = {}) {
  ensurePhotoCollections(evidence, value);
  for (const url of batch.imageUrls) {
    const stepIndex = value.imageUrls.indexOf(url);
    if (stepIndex >= 0) {
      value.imageUrls.splice(stepIndex, 1);
      value.files.splice(stepIndex, 1);
      if (stepIndex < value.dataUrls.length) value.dataUrls.splice(stepIndex, 1);
      if (stepIndex < value.assetIds.length) value.assetIds.splice(stepIndex, 1);
    }
    removeTaskPhoto(evidence, url);
    revokeBlobUrl(url, revokeObjectUrl);
  }
  value.processing = false;
  value.count = value.imageUrls.length;
}

export function removePhotoAt(evidence, value, index, { revokeObjectUrl } = {}) {
  ensurePhotoCollections(evidence, value);
  if (value.processing || !Number.isInteger(index) || index < 0 || index >= value.imageUrls.length) {
    return false;
  }
  const [url] = value.imageUrls.splice(index, 1);
  value.files.splice(index, 1);
  value.dataUrls.splice(index, 1);
  value.assetIds.splice(index, 1);
  removeTaskPhoto(evidence, url);
  value.count = value.imageUrls.length;
  value.revision = Number(value.revision || 0) + 1;
  revokeBlobUrl(url, revokeObjectUrl);
  return true;
}
