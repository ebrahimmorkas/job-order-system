const { randomUUID } = require('crypto');

// Where a new file goes, the same for every provider:
// <vendorId>/<module>/<random>.<ext>. The uploader's own file name is never
// used - it could contain "../" or other characters that escape the folder.
const buildStorageKey = (meta) => {
    try {
        return `${meta.vendorId}/${meta.module}/${randomUUID()}.${meta.extension}`;
    } catch (err) {
        throw err;
    }
};

module.exports = { buildStorageKey };
