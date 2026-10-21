const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { STORAGE_PROVIDERS } = require('../../constants/storageConstants');
const { buildStorageKey } = require('./storageKey');

// AWS S3 and Cloudflare R2 (same API; only the client and the public URL
// differ). The account comes in on every call - the vendor's own or the
// platform's - so a client is created for the call and destroyed right after,
// releasing its sockets, instead of one long-lived client per account.
//
// Interface (same as every provider):
//   upload(buffer, meta, credentials) -> Promise<{ url, key }>
//   delete(key, credentials) -> Promise<void>

const createClient = (provider, credentials) => {
    try {
        const s3Credentials = {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey
        };
        if (provider === STORAGE_PROVIDERS.R2) {
            return new S3Client({
                region: 'auto',
                endpoint: credentials.endpoint || `https://${credentials.accountId}.r2.cloudflarestorage.com`,
                credentials: s3Credentials
            });
        }
        return new S3Client({ region: credentials.region, credentials: s3Credentials });
    } catch (err) {
        throw err;
    }
};

const buildObjectUrl = (provider, credentials, key) => {
    try {
        if (provider === STORAGE_PROVIDERS.R2) {
            return `${String(credentials.publicUrl).replace(/\/+$/, '')}/${key}`;
        }
        return `https://${credentials.bucket}.s3.${credentials.region}.amazonaws.com/${key}`;
    } catch (err) {
        throw err;
    }
};

const createProvider = (provider) => {
    try {
        const upload = async (buffer, meta, credentials) => {
            const client = createClient(provider, credentials);
            try {
                const key = buildStorageKey(meta);
                await client.send(new PutObjectCommand({
                    Bucket: credentials.bucket,
                    Key: key,
                    Body: buffer,
                    ContentType: meta.mimeType
                }));
                return { url: buildObjectUrl(provider, credentials, key), key };
            } catch (err) {
                throw err;
            } finally {
                client.destroy();
            }
        };

        const deleteFile = async (key, credentials) => {
            const client = createClient(provider, credentials);
            try {
                await client.send(new DeleteObjectCommand({ Bucket: credentials.bucket, Key: key }));
            } catch (err) {
                throw err;
            } finally {
                client.destroy();
            }
        };

        return { upload, delete: deleteFile };
    } catch (err) {
        throw err;
    }
};

module.exports = { createProvider };
