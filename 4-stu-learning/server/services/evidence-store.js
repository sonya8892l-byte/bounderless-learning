import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function localStore({ projectRoot }) {
  const directory = path.resolve(projectRoot, 'uploads');
  const metadataPath = (filename) => path.join(directory, `${filename}.metadata.json`);
  return {
    async put({ id, extension, data, contentType, owner = null }) {
      await fs.mkdir(directory, { recursive: true });
      const filename = `${id}${extension}`;
      await fs.writeFile(path.join(directory, filename), data, { mode: 0o600 });
      await fs.writeFile(metadataPath(filename), JSON.stringify({
        evidenceId: id,
        contentType: contentType || null,
        owner,
      }), { mode: 0o600 });
      return filename;
    },
    async get(filename) {
      const data = await fs.readFile(path.join(directory, filename)).catch(() => null);
      if (!data) return null;
      const metadata = await fs.readFile(metadataPath(filename), 'utf8')
        .then((value) => JSON.parse(value))
        .catch(() => null);
      return {
        data,
        contentType: metadata?.contentType || null,
        owner: metadata?.owner || null,
      };
    },
    async findById(id) {
      const filename = (await fs.readdir(directory).catch(() => [])).find((item) => (
        item.startsWith(`${id}.`) && !item.endsWith('.metadata.json')
      ));
      if (!filename) return null;
      return { filename, ...(await this.get(filename)) };
    },
    kind: 'local',
  };
}

function s3Store(env) {
  const client = new S3Client({
    region: env.S3_REGION || 'auto',
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    } : undefined,
  });
  const prefix = String(env.S3_PREFIX || 'evidence').replace(/^\/+|\/+$/g, '');
  const key = (filename) => `${prefix}/${filename}`;
  const ownerMetadata = (id, owner) => Object.fromEntries(Object.entries({
    evidenceid: id,
    ownersessionid: owner?.sessionId,
    ownerrunid: owner?.runId,
    ownerparticipantid: owner?.participantId,
  }).filter(([, value]) => value !== null && value !== undefined && String(value).length));
  const ownerFromMetadata = (metadata = {}) => metadata.ownersessionid ? {
    sessionId: metadata.ownersessionid,
    runId: metadata.ownerrunid || null,
    participantId: metadata.ownerparticipantid || null,
  } : null;
  return {
    async put({ id, extension, data, contentType, owner = null }) {
      const filename = `${id}${extension}`;
      await client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET, Key: key(filename), Body: data, ContentType: contentType,
        Metadata: ownerMetadata(id, owner),
      }));
      return filename;
    },
    async get(filename) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key(filename) }));
        return {
          data: Buffer.from(await result.Body.transformToByteArray()),
          contentType: result.ContentType || null,
          owner: ownerFromMetadata(result.Metadata),
        };
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async findById(id) {
      const result = await client.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: key(`${id}.`), MaxKeys: 1 }));
      const objectKey = result.Contents?.[0]?.Key;
      if (!objectKey) return null;
      const filename = objectKey.split('/').at(-1);
      return { filename, ...(await this.get(filename)) };
    },
    kind: 's3',
  };
}

export function createEvidenceStore(env) {
  return env.S3_BUCKET ? s3Store(env) : localStore(env);
}
