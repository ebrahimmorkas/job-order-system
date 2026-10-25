// Moves job orders made before items into the items shape (models/JobOrder.js):
// each old job order's masters, controls and images become its one item
// (no job name), and the old work indexes are swapped for the items ones.
// Safe to run again: job orders already in the new shape are left alone.
//
// Without --apply it only prints what would change. Run it while the
// server is stopped.
//
//   node scripts/migrateJobOrderItems.js
//   node scripts/migrateJobOrderItems.js --apply
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const JobOrder = require('../models/JobOrder');

const BATCH_SIZE = 500;
// The old shape: masters / controls / images on the job order itself.
const OLD_SHAPE = { items: { $exists: false }, $or: [{ masters: { $exists: true } }, { controls: { $exists: true } }, { images: { $exists: true } }] };

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
        const collection = JobOrder.collection;
        const count = await collection.countDocuments(OLD_SHAPE);
        const { toDrop, toCreate } = await JobOrder.diffIndexes();
        process.stdout.write(`Database: ${mongoose.connection.db.databaseName}\n`);
        process.stdout.write(`Job orders to move into items: ${count}\n`);
        process.stdout.write(`Indexes to drop:   ${toDrop.length ? toDrop.join(', ') : 'none'}\n`);
        process.stdout.write(`Indexes to create: ${toCreate.length ? toCreate.map((index) => JSON.stringify(index.key || index)).join(', ') : 'none'}\n`);
        if (count === 0 && toDrop.length === 0 && toCreate.length === 0) {
            process.stdout.write('Already up to date.\n');
        } else if (process.argv.includes('--apply')) {
            let moved = 0;
            for (;;) {
                const batch = await collection.find(OLD_SHAPE).project({ masters: 1, controls: 1, images: 1 }).limit(BATCH_SIZE).toArray();
                if (batch.length === 0) break;
                await collection.bulkWrite(batch.map((jobOrder) => ({
                    updateOne: {
                        filter: { _id: jobOrder._id, items: { $exists: false } },
                        update: {
                            $set: { items: [{ _id: new mongoose.Types.ObjectId(), name: null, masters: jobOrder.masters || [], controls: jobOrder.controls || [], images: jobOrder.images || [] }] },
                            $unset: { masters: '', controls: '', images: '' }
                        }
                    }
                })));
                moved += batch.length;
            }
            await JobOrder.syncIndexes();
            process.stdout.write(`Done: ${moved} job orders moved, indexes in line.\n`);
        } else {
            process.stdout.write('Nothing changed - run again with --apply to do it.\n');
        }
        await mongoose.disconnect();
    } catch (err) {
        process.stderr.write(`Failed: ${err.message}\n`);
        await mongoose.disconnect();
        process.exitCode = 1;
    }
};

run();
