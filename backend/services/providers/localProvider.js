const fs = require('fs/promises');
const path = require('path');
const { buildStorageKey } = require('./storageKey');

// This server's own disk. "credentials" is just { basePath, baseUrl }
// (config/storageProviderConfig.js) - local has no account; every vendor's
// files sit under their own <vendorId>/ folder.

// Absolute path of a key, refusing anything that would land outside basePath.
const resolveInside = (basePath, key) => {
    try {
        const absolutePath = path.resolve(basePath, key);
        if (!absolutePath.startsWith(path.resolve(basePath) + path.sep)) {
            throw new Error(`Storage key escapes the upload folder: ${key}`);
        }
        return absolutePath;
    } catch (err) {
        throw err;
    }
};

// buffer -> { url, key }
const upload = async (buffer, meta, credentials) => {
    try {
        const key = buildStorageKey(meta);
        const absolutePath = resolveInside(credentials.basePath, key);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, buffer);
        return { url: `${credentials.baseUrl}/${key}`, key };
    } catch (err) {
        throw err;
    }
};

const deleteFile = async (key, credentials) => {
    try {
        await fs.unlink(resolveInside(credentials.basePath, key));
    } catch (err) {
        // Already gone - nothing to delete.
        if (err.code !== 'ENOENT') throw err;
    }
};

module.exports = {
    upload,
    delete: deleteFile
};
