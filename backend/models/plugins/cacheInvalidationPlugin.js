const redisService = require('../../services/redisService');

// Deletes a model's Redis cache entry whenever one of its documents changes,
// however it was changed (doc.save, create, update or delete queries), so
// ensureVendorDataCached never serves stale data for up to an hour.
//
//   schema.plugin(cacheInvalidationPlugin, { key: (vendorId) => redisKeys.companyMaster(vendorId) });
//   schema.plugin(cacheInvalidationPlugin, { key: () => redisKeys.websiteMaster() });  // one shared key
//
// A key function that takes no vendorId is a single shared key. Does nothing
// (not even its lookup query) while Redis is switched off.

const QUERY_OPS = ['findOneAndUpdate', 'updateOne', 'updateMany', 'findOneAndReplace', 'replaceOne',
    'findOneAndDelete', 'deleteOne', 'deleteMany'];

const cacheInvalidationPlugin = (schema, { key }) => {
    const isVendorScoped = key.length > 0;

    const invalidate = async (vendorIds) => {
        if (!isVendorScoped) {
            await redisService.del(key());
            return;
        }
        const unique = new Set(vendorIds.filter(Boolean).map(String));
        for (const vendorId of unique) {
            await redisService.del(key(vendorId));
        }
    };

    schema.post('save', async function (doc) {
        if (redisService.isRedisEnabled()) await invalidate([doc.vendorId]);
    });

    schema.post('insertMany', async function (docs) {
        if (redisService.isRedisEnabled()) await invalidate([].concat(docs).map((doc) => doc.vendorId));
    });

    // Which vendors' documents the query touches - read before it runs, as a
    // delete leaves nothing to read afterwards.
    schema.pre(QUERY_OPS, { document: false, query: true }, async function () {
        if (!redisService.isRedisEnabled() || !isVendorScoped) return;
        this._cacheVendorIds = await this.model.distinct('vendorId', this.getFilter());
    });

    schema.post(QUERY_OPS, { document: false, query: true }, async function () {
        if (!redisService.isRedisEnabled()) return;
        // Also covers an upsert that just created a document for a new vendor.
        const after = isVendorScoped ? await this.model.distinct('vendorId', this.getFilter()) : [];
        await invalidate([...(this._cacheVendorIds || []), ...after]);
    });
};

module.exports = cacheInvalidationPlugin;
