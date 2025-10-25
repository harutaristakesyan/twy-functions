import https from 'node:https';
import { BinaryLike, createHash, createHmac, randomUUID } from 'node:crypto';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const bucketName = process.env.FILES_BUCKET_NAME ?? process.env.FILES_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AWS_SESSION_TOKEN;

if (!region) {
  throw new Error('AWS region is not configured');
}

if (!bucketName) {
  throw new Error('File storage bucket is not configured');
}

if (!accessKeyId || !secretAccessKey) {
  throw new Error('AWS credentials are not configured');
}

const service = 's3';
const host = `s3.${region}.amazonaws.com`;

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes
const MAX_UPLOAD_URL_TTL_SECONDS = 60 * 60; // 1 hour

const resolveUploadUrlTtl = () => {
  const rawTtl = process.env.FILE_UPLOAD_URL_TTL_SECONDS;

  if (!rawTtl) {
    return DEFAULT_UPLOAD_URL_TTL_SECONDS;
  }

  const parsed = Number.parseInt(rawTtl, 10);

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_UPLOAD_URL_TTL_SECONDS) {
    throw new Error('FILE_UPLOAD_URL_TTL_SECONDS must be a positive integer less than or equal to 3600');
  }

  return parsed;
};

const hash = (data: BinaryLike) => createHash('sha256').update(data).digest('hex');

const hmac = (key: BinaryLike, data: string | Buffer) => createHmac('sha256', key).update(data).digest();

const getSignatureKey = (
  key: string,
  dateStamp: string,
  awsRegion: string,
  awsService: string,
) => {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, awsRegion);
  const kService = hmac(kRegion, awsService);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
};

const encodeKey = (key: string) => encodeURIComponent(key).replace(/%2F/g, '/');

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const formatAmzDate = (date: Date) => {
  const YYYY = date.getUTCFullYear().toString();
  const MM = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const DD = date.getUTCDate().toString().padStart(2, '0');
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');

  return {
    amzDate: `${YYYY}${MM}${DD}T${hh}${mm}${ss}Z`,
    dateStamp: `${YYYY}${MM}${DD}`,
  } as const;
};

const buildSignedRequest = ({
  method,
  path,
  headers = {},
}: {
  readonly method: 'DELETE';
  readonly path: string;
  readonly headers?: Record<string, string>;
}) => {
  const now = new Date();
  const { amzDate, dateStamp } = formatAmzDate(now);

  const baseHeaders: Record<string, string> = {
    host,
    'x-amz-content-sha256': hash(Buffer.alloc(0)),
    'x-amz-date': amzDate,
    ...headers,
  };

  if (sessionToken) {
    baseHeaders['x-amz-security-token'] = sessionToken;
  }

  const sortedHeaderEntries = Object.entries(baseHeaders)
    .map(([name, value]) => [name.toLowerCase(), value.trim()] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const canonicalHeaders = sortedHeaderEntries.map(([name, value]) => `${name}:${value}\n`).join('');
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(';');

  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    hash(Buffer.alloc(0)),
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    headers: {
      ...Object.fromEntries(sortedHeaderEntries),
      authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
};

const sendRequest = ({
  method,
  path,
  headers,
}: {
  readonly method: 'DELETE';
  readonly path: string;
  readonly headers: Record<string, string>;
}) =>
  new Promise<void>((resolve, reject) => {
    const request = https.request(
      {
        host,
        method,
        path,
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0;

          if (statusCode >= 200 && statusCode < 300) {
            resolve();
          } else {
            const responseBody = Buffer.concat(chunks).toString('utf-8');
            reject(
              new Error(
                `S3 request failed with status ${statusCode}: ${responseBody || response.statusMessage || 'Unknown error'}`,
              ),
            );
          }
        });
      },
    );

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });

const buildPresignedUrl = ({
  method,
  path,
  contentType,
  expiresIn,
}: {
  readonly method: 'PUT';
  readonly path: string;
  readonly contentType: string;
  readonly expiresIn: number;
}) => {
  const now = new Date();
  const { amzDate, dateStamp } = formatAmzDate(now);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const headers: Record<string, string> = {
    host,
    'content-type': contentType,
  };

  const sortedHeaderEntries = Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalHeaders = sortedHeaderEntries.map(([name, value]) => `${name}:${value}\n`).join('');
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(';');

  const queryParams: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', expiresIn.toString(10)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];

  if (sessionToken) {
    queryParams.push(['X-Amz-Security-Token', sessionToken]);
  }

  const canonicalQueryString = queryParams
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .sort()
    .join('&');

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const finalQuery = `${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return `https://${host}${path}?${finalQuery}`;
};

export interface CreateUploadUrlInput {
  readonly fileName: string;
  readonly contentType: string;
  readonly size: number;
}

export interface CreateUploadUrlResult {
  readonly fileId: string;
  readonly bucket: string;
  readonly key: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
  readonly requiredHeaders: Record<string, string>;
  readonly fileName: string;
  readonly contentType: string;
  readonly contentLength: number;
}

export const createUploadUrl = async ({
  fileName,
  contentType,
  size,
}: CreateUploadUrlInput): Promise<CreateUploadUrlResult> => {
  const fileId = randomUUID();
  const key = fileId;
  const ttlSeconds = resolveUploadUrlTtl();
  const path = `/${bucketName}/${encodeKey(key)}`;

  const uploadUrl = buildPresignedUrl({
    method: 'PUT',
    path,
    contentType,
    expiresIn: ttlSeconds,
  });

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  return {
    fileId,
    bucket: bucketName,
    key,
    uploadUrl,
    expiresAt,
    requiredHeaders: {
      'Content-Type': contentType,
    },
    fileName,
    contentType,
    contentLength: size,
  };
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const path = `/${bucketName}/${encodeKey(fileId)}`;

  const { headers } = buildSignedRequest({
    method: 'DELETE',
    path,
  });

  await sendRequest({
    method: 'DELETE',
    path,
    headers,
  });
};
