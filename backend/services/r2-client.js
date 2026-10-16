const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

let client = null;

function getClient() {
  if (client) return client;

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
    );
  }

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

async function uploadImage(buffer, mimetype) {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    throw new Error('R2_BUCKET_NAME and R2_PUBLIC_URL must be set.');
  }

  const ext = EXT_MAP[mimetype] || 'bin';
  const key = `pc-issues/${crypto.randomUUID()}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const base = publicUrl.replace(/\/+$/, '');
  return { key, url: `${base}/${key}` };
}

async function deleteImage(key) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket || !key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

module.exports = { uploadImage, deleteImage };