export const R2_CONFIG = {
  accountId: import.meta.env.PUBLIC_R2_ACCOUNT_ID || '',
  accessKeyId: import.meta.env.PUBLIC_R2_ACCESS_KEY_ID || '',
  secretAccessKey: import.meta.env.PUBLIC_R2_SECRET_ACCESS_KEY || '',
  bucketName: import.meta.env.PUBLIC_R2_BUCKET_NAME || '',
  publicUrl: import.meta.env.PUBLIC_R2_PUBLIC_URL || '',
};

function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', data);
}

function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then((k) => crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}

async function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
}

function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export async function uploadToR2(file: File, key?: string): Promise<string> {
  const config = R2_CONFIG;
  if (!config.accountId || !config.accessKeyId) {
    throw new Error('R2 未配置，请在 src/lib/r2-upload.ts 中填写 R2_CONFIG');
  }

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const region = 'auto';
  const service = 's3';

  const fileName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '');
  const objectKey = key || `moments/${Date.now()}-${fileName}`;
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const host = new URL(endpoint).host;
  const canonicalUri = `/${config.bucketName}/${objectKey}`;
  const payloadHash = await sha256(await file.arrayBuffer()).then(
    (h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('')
  );

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');

  const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest).buffer as ArrayBuffer).then(
    (h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('')
  );

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const signingKey = await getSignatureKey(config.secretAccessKey, dateStamp, region, service);
  const signature = await hmac(signingKey, stringToSign).then(
    (h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('')
  );

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fileBuffer = await file.arrayBuffer();
  const res = await fetch(`${endpoint}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      Host: host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return `${config.publicUrl.replace(/\/$/, '')}/${objectKey}`;
}
