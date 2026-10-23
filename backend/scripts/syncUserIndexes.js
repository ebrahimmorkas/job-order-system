// Brings the users collection's indexes in line with models/User.js.
// Needed once on a database made before the Users module: the old unique
// username / email / phone indexes counted deleted users and did not allow
// two users without an email or phone. MongoDB can't change an index in
// place, so they are dropped and made again (partial - see models/User.js).
//
// Without --apply it only prints what would change. Run it while the
// server is stopped (a moment without the unique indexes).
//
//   node scripts/syncUserIndexes.js
//   node scripts/syncUserIndexes.js --apply
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
        const { toDrop, toCreate } = await User.diffIndexes();
        process.stdout.write(`Database: ${mongoose.connection.db.databaseName}\n`);
        process.stdout.write(`To drop:   ${toDrop.length ? toDrop.join(', ') : 'none'}\n`);
        process.stdout.write(`To create: ${toCreate.length ? toCreate.map((index) => JSON.stringify(index.key || index)).join(', ') : 'none'}\n`);
        if (toDrop.length === 0 && toCreate.length === 0) {
            process.stdout.write('Already up to date.\n');
        } else if (process.argv.includes('--apply')) {
            await User.syncIndexes();
            process.stdout.write('Done.\n');
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
