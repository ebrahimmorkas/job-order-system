require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { auditFields } = require('../models/plugins/auditPlugin');

// Documents saved before a model got models/plugins/auditPlugin.js have none
// of its fields (status, createdBy, deletedDate...). Mongoose shows the
// defaults when reading them, but they are not in the database - so queries
// on them (e.g. getAll's status filter) and the first AuditLog record
// (status: null -> 'I') are wrong.
//
// This writes each missing field's default into the database. Fields that
// already have a value are never touched, and nothing is written to AuditLog -
// this is a data repair, not a change made by anyone.
//
// Every model in models/ that uses the plugin is found automatically, so it
// also covers models added later. Safe to re-run.
//
//   node scripts/backfillAuditFields.js           -> shows what would change
//   node scripts/backfillAuditFields.js --apply   -> changes it

const APPLY = process.argv.includes('--apply');
const MODELS_DIR = path.join(__dirname, '..', 'models');
const AUDIT_PATHS = Object.keys(auditFields);

// Every registered model whose schema has all of the plugin's fields.
const loadAuditedModels = () => {
    fs.readdirSync(MODELS_DIR)
        .filter((file) => file.endsWith('.js'))
        .forEach((file) => require(path.join(MODELS_DIR, file)));
    return mongoose.modelNames()
        .map((name) => mongoose.model(name))
        .filter((Model) => AUDIT_PATHS.every((field) => Model.schema.path(field)));
};

async function backfillAuditFields() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        process.stdout.write(APPLY ? 'Applying changes.\n' : 'Dry run - nothing is changed. Add --apply to change it.\n');

        for (const Model of loadAuditedModels()) {
            for (const field of AUDIT_PATHS) {
                const filter = { [field]: { $exists: false } };
                const missing = await Model.countDocuments(filter);
                if (missing === 0) continue;

                const value = auditFields[field].default;
                if (APPLY) {
                    // auditSkip: no AuditLog record; timestamps: false keeps updatedAt as it was.
                    await Model.updateMany(filter, { $set: { [field]: value } }, { auditSkip: true, timestamps: false });
                }
                process.stdout.write(`${Model.modelName}.${field}: ${missing} document(s) ${APPLY ? 'set' : 'would be set'} to ${JSON.stringify(value)}\n`);
            }
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`backfillAuditFields failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

backfillAuditFields();
