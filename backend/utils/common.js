const mongoose = require("mongoose");
const crypto = require('crypto');
const logger = require('./logger');

const sendSuccess = (res, statusCode, message, data = null) => {
  // Same guard as sendError - never answer a request twice.
  if (res.headersSent) return;
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

// data: anything else the page needs to show the failure (e.g. the
// maintenance page's block).
const sendError = (res, statusCode, message, errors = null, data = null) => {
  // logException() may already have answered this request with a 500 (error
  // page + reference) - a second response would throw ERR_HTTP_HEADERS_SENT.
  if (res.headersSent) return;
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  if (data) payload.data = data;
  return res.status(statusCode).json(payload);
};

const returnResult = (isSuccess, statusCode, message, meta = {}) => {
    return {isSuccess, statusCode, message, meta};
}

// Sends a returnResult(...) straight back as the response, so a controller
// doesn't repeat the isSuccess check every time:
//   return sendResult(res, await someService.doSomething(...));
// On success, meta goes out as `data` (left out when empty). On failure,
// meta.errors - if the service set one - goes out as `errors`.
const sendResult = (res, result) => {
  const { isSuccess, statusCode, message, meta = {} } = result;
  if (!isSuccess) {
    return sendError(res, statusCode, message, meta.errors || null);
  }
  return sendSuccess(res, statusCode, message, Object.keys(meta).length ? meta : null);
};

// A feature works only when it is on in WebsiteMaster AND in the vendor's
// CompanyMaster. Off in WebsiteMaster -> always WebsiteMaster's own
// temporaryFeatureOffMessage. Off in CompanyMaster -> customMessage when the
// caller passes one (e.g. a feature-specific "Upgrade your plan to use
// Reports"), else the vendor's CompanyMaster.featureDisabledForVendorMessage.
const checkFeatureOnOrOff = async (vendorId, websiteMasterData, companyMasterData, websiteMasterField, companyMasterField, customMessage = null) => {
    try {
            if (!websiteMasterData[websiteMasterField]) {
                return returnResult(false, 403, websiteMasterData.temporaryFeatureOffMessage);
            }

            if (!companyMasterData[companyMasterField]) {
                return returnResult(false, 403, customMessage || companyMasterData.featureDisabledForVendorMessage);
            }

            return returnResult(true, 200, `All Good`);
        } catch (err) {
            throw err;
          }
}

// Reads a hex key from .env, checked once at startup. A missing key falls back
// to a random one (fine for local development only - everything encoded or
// encrypted with it becomes unreadable on restart). A key of the wrong length
// stops the server here instead of failing on every single call.
const loadHexKey = (envName, bytes) => {
  const value = process.env[envName];
  if (!value) {
    logger.logWarning(`${envName} is not set - using a random key, which changes on every restart`);
    return crypto.randomBytes(bytes);
  }
  const key = Buffer.from(value, 'hex');
  if (key.length !== bytes) {
    throw new Error(`${envName} must be exactly ${bytes * 2} hex characters`);
  }
  return key;
};

const ID_ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// ID_ENCRYPTION_KEY = 64 hex chars (32 bytes), ID_ENCRYPTION_IV = 32 hex chars
// (16 bytes). Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ID_ENCRYPTION_KEY = loadHexKey('ID_ENCRYPTION_KEY', 32);
const ID_ENCRYPTION_IV = loadHexKey('ID_ENCRYPTION_IV', 16);

// Reversible encoding: raw Mongo ObjectId -> opaque string safe for a URL param.
// The IV is fixed on purpose, so the same id always encodes to the same string.
const encodeId = (id) => {
  if (!id) return null;
  const cipher = crypto.createCipheriv(ID_ENCRYPTION_ALGORITHM, ID_ENCRYPTION_KEY, ID_ENCRYPTION_IV);
  return cipher.update(id.toString(), 'utf8', 'base64url') + cipher.final('base64url');
};

// Reverse of encodeId: opaque string from a URL param -> raw Mongo ObjectId string.
// Throws on a tampered/garbage value - use tryDecodeId for client input.
const decodeId = (encodedId) => {
  if (!encodedId) return null;
  const decipher = crypto.createDecipheriv(ID_ENCRYPTION_ALGORITHM, ID_ENCRYPTION_KEY, ID_ENCRYPTION_IV);
  return decipher.update(encodedId, 'base64url', 'utf8') + decipher.final('utf8');
};

// decodeId for ids a client sends (e.g. picked from a dropdown): a tampered/
// garbage value returns null instead of throwing, so the caller can answer
// with a plain 400 rather than a server error.
const tryDecodeId = (encodedId) => {
  try {
    return decodeId(encodedId);
  } catch {
    return null;
  }
};

const SECRET_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// CREDENTIALS_ENCRYPTION_KEY = 64 hex chars (32 bytes). Set it before storing
// any real secret, or every stored secret becomes undecryptable on restart.
const SECRET_ENCRYPTION_KEY = loadHexKey('CREDENTIALS_ENCRYPTION_KEY', 32);

// Encrypts a real secret (e.g. a vendor's API key) for storage at rest. Unlike
// encodeId, this uses a fresh random IV per call plus a GCM auth tag, so the
// same secret never encrypts the same way twice and tampering is detected.
// Stored as "iv:authTag:data" (hex).
const encryptSecret = (plainText) => {
  if (!plainText) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(SECRET_ENCRYPTION_ALGORITHM, SECRET_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
};

// Reverse of encryptSecret. Throws if the value was tampered with or was
// encrypted with a different key.
const decryptSecret = (encryptedText) => {
  if (!encryptedText) return null;
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted value');
  }
  const decipher = crypto.createDecipheriv(SECRET_ENCRYPTION_ALGORITHM, SECRET_ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
};

// isObjectIdOrHexString, not ObjectId.isValid - isValid also accepts any
// 12-character string (e.g. "aaaaaaaaaaaa") as a valid id.
const isValidObjectId = (id) => !!id && mongoose.isObjectIdOrHexString(id);

// Validates one document ID or an array of them. Bad ids are listed in meta.invalidIds.
const validateObjectId = (ids) => {
  if (Array.isArray(ids)) {
    if (ids.length === 0) {
      return returnResult(false, 400, "At least one ID is required.");
    }
    const invalidIds = ids.filter((id) => !isValidObjectId(id));
    if (invalidIds.length > 0) {
      return returnResult(false, 400, "One or more IDs are invalid.", { invalidIds });
    }
    return returnResult(true, 200, "IDs are valid.");
  }

  if (!ids) {
    return returnResult(false, 400, "ID is required.");
  }
  if (!isValidObjectId(ids)) {
    return returnResult(false, 400, "Invalid ID format.");
  }
  return returnResult(true, 200, "ID is valid.");
};

// Validates that Model is a registered Mongoose model. A failure here is a bug
// in our own code, not the caller's input, hence 500.
const validateModelExists = (Model) => {
  if (!Model || typeof Model !== "function" || !Model.modelName) {
    return returnResult(false, 500, "Invalid Model provided.");
  }
  if (mongoose.models[Model.modelName] !== Model) {
    return returnResult(false, 500, `Model "${Model.modelName}" is not present.`);
  }
  return returnResult(true, 200, "Model is valid.");
};

// Filter for one document by id. With a vendorId, a document belonging to
// another vendor is simply not matched - the database does the ownership
// check, so it reads as "not found" and never leaks that the id exists.
// Models with no vendor scope (e.g. WebsiteMaster) omit vendorId.
const buildIdFilter = (id, vendorId) => {
  const filter = { _id: id };
  if (vendorId !== null && vendorId !== undefined) filter.vendorId = vendorId;
  return filter;
};

// Checks both the id and the model; returns the failed check's result, or null when both are fine.
const checkIdAndModel = (Model, id) => {
  const idCheck = validateObjectId(id);
  if (!idCheck.isSuccess) return idCheck;

  const modelCheck = validateModelExists(Model);
  if (!modelCheck.isSuccess) return modelCheck;

  return null;
};

const notFound = () => returnResult(false, 404, "Document not found.");

// Marks a document active (isActive = true -> status 'A') or inactive
// (isActive = false -> status 'I') and records who did it and when. A deleted
// document (status 'D') is never matched, so it can't be brought back this way.
// One atomic update, so two admins clicking at once can't overwrite each other.
// extraFilter narrows the match further (e.g. { masterId } - a value only
// through its own master). The updated document is in meta.document.
const toggleActiveStatus = async (Model, id, userId, isActive, vendorId = null, extraFilter = {}) => {
  const failure = checkIdAndModel(Model, id);
  if (failure) return failure;

  const update = isActive
    ? { status: 'A', activeMarkedBy: userId, activeMarkedDate: new Date() }
    : { status: 'I', inActiveMarkedBy: userId, inactiveMarkedDate: new Date() };

  // auditUserId: who to record in AuditLog (see models/plugins/auditPlugin.js).
  const document = await Model.findOneAndUpdate(
    { ...extraFilter, ...buildIdFilter(id, vendorId), status: { $ne: 'D' } },
    { $set: update },
    { returnDocument: 'after', auditUserId: userId }
  );
  if (!document) return notFound();

  return returnResult(true, 200, isActive ? "Marked as active." : "Marked as inactive.", { document });
};

// Soft delete - sets status to 'D'. extraFilter as in toggleActiveStatus.
// The deleted document is in meta.document.
const softDelete = async (Model, id, userId, vendorId = null, extraFilter = {}) => {
  const failure = checkIdAndModel(Model, id);
  if (failure) return failure;

  const document = await Model.findOneAndUpdate(
    { ...extraFilter, ...buildIdFilter(id, vendorId), status: { $ne: 'D' } },
    { $set: { status: 'D', deletedBy: userId, deletedDate: new Date() } },
    { returnDocument: 'after', auditUserId: userId }
  );
  if (!document) return notFound();

  return returnResult(true, 200, "Deleted successfully.", { document });
};

// Hard delete - removes the document for good. Its last contents stay
// readable in AuditLog (HARD_DELETE record).
const hardDelete = async (Model, id, userId, vendorId = null) => {
  const failure = checkIdAndModel(Model, id);
  if (failure) return failure;

  const document = await Model.findOneAndDelete(buildIdFilter(id, vendorId), { auditUserId: userId });
  if (!document) return notFound();

  return returnResult(true, 200, "Deleted permanently.");
};

// Every document of the vendor that isn't deleted (unless filter.status says
// otherwise), in meta.documents. The caller's filter object is never modified.
const getAll = async (Model, filter = {}, vendorId) => {
  const modelCheck = validateModelExists(Model);
  if (!modelCheck.isSuccess) return modelCheck;

  // Without this, a missing vendorId would return every vendor's documents.
  if (!vendorId) return returnResult(false, 400, "Vendor ID is required.");

  const documents = await Model.find({ ...filter, vendorId, status: filter.status || { $ne: 'D' } });
  return returnResult(true, 200, "Documents fetched successfully.", { documents });
};

// One document by its ID, in meta.document.
const getByID = async (Model, id, vendorId = null) => {
  const failure = checkIdAndModel(Model, id);
  if (failure) return failure;

  const document = await Model.findOne(buildIdFilter(id, vendorId));
  if (!document) return notFound();

  return returnResult(true, 200, "Document fetched successfully.", { document });
};

// Checks that every id exists (within the vendor, when a vendorId is passed).
// The ones that don't are listed in meta.missingIds. Only _id is fetched.
const checkWhetherDocumentExists = async (Model, ids, vendorId = null) => {
  const idCheck = validateObjectId(ids);
  if (!idCheck.isSuccess) return idCheck;

  const hasVendor = vendorId !== null && vendorId !== undefined;
  if (hasVendor) {
    const vendorCheck = validateObjectId(vendorId);
    if (!vendorCheck.isSuccess) return vendorCheck;
  }

  // Duplicates are only looked up once.
  const idArray = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))];

  const query = { _id: { $in: idArray } };
  if (hasVendor) query.vendorId = vendorId;

  const existingDocuments = await Model.find(query, { _id: 1 }).lean();
  const existingIds = new Set(existingDocuments.map((doc) => doc._id.toString()));
  const missingIds = idArray.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    return returnResult(false, 404, "One or more documents not found.", { missingIds });
  }

  return returnResult(true, 200, "All documents exist.");
};

// Runs `operationFn` once per id, best-effort - one id's failure (not found,
// a returnResult-style business validation failure, etc.) is recorded and
// the loop continues rather than aborting the whole batch. A genuinely
// unexpected exception thrown by operationFn still propagates up to the
// caller's own try/catch. Runs one at a time on purpose: operations on
// related documents (e.g. updating the same totals) must not race each other.
// operationFn(id) must resolve to a returnResult(...) object. Always
// succeeds as a whole; each id's own outcome is in meta.results.
const runBulkOperation = async (ids, operationFn) => {
  const results = [];
  let successCount = 0;

  for (const id of ids) {
    const result = await operationFn(id);
    const isSuccess = !!result?.isSuccess;
    if (isSuccess) successCount++;
    results.push({ id, isSuccess, message: result ? result.message : 'Unknown error' });
  }

  const failureCount = results.length - successCount;
  return returnResult(true, 200, `${successCount} succeeded, ${failureCount} failed.`, { results, successCount, failureCount });
};

// Moves a document one place up / down: swaps its precedence with the
// nearest document above / below it among those matching `scope` (e.g.
// { vendorId } or { vendorId, masterId }) that are active or inactive.
// noun names the document in the messages ('master', 'value', 'control').
const swapPrecedence = async (Model, scope, id, direction, userId, noun) => {
  try {
    const live = { $in: ['A', 'I'] };
    const notFoundMessage = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} not found.`;
    const doc = await Model.findOne({ ...scope, _id: id, status: live }).select('_id precedence').lean();
    if (!doc) return returnResult(false, 404, notFoundMessage);

    const isUp = direction === 'up';
    const neighbour = await Model.findOne({ ...scope, status: live, precedence: isUp ? { $lt: doc.precedence } : { $gt: doc.precedence } })
      .sort({ precedence: isUp ? -1 : 1 }).select('_id precedence').lean();
    if (!neighbour) return returnResult(false, 400, `This ${noun} is already ${isUp ? 'first' : 'last'}.`);

    await Promise.all([
      Model.updateOne({ ...scope, _id: doc._id }, { $set: { precedence: neighbour.precedence } }, { auditUserId: userId }),
      Model.updateOne({ ...scope, _id: neighbour._id }, { $set: { precedence: doc.precedence } }, { auditUserId: userId })
    ]);
    return returnResult(true, 200, isUp ? 'Moved up.' : 'Moved down.');
  } catch (err) {
    throw err;
  }
};

// The next free position at the end of the documents matching `scope`
// (active or inactive).
const nextPrecedence = async (Model, scope) => {
  try {
    const last = await Model.findOne({ ...scope, status: { $in: ['A', 'I'] } }).sort({ precedence: -1 }).select('precedence').lean();
    return (last?.precedence || 0) + 1;
  } catch (err) {
    throw err;
  }
};

// The vendor's active default document (isDefault: true), in meta.document.
const getDefault = async (Model, vendorId) => {
  const document = await Model.findOne({ vendorId, isDefault: true, status: 'A' });
  if (!document) return returnResult(false, 404, "No default document found.");
  return returnResult(true, 200, "Default document fetched successfully.", { document });
};

module.exports = {
  sendSuccess,
  sendError,
  sendResult,
  returnResult,
  checkFeatureOnOrOff,
  validateObjectId,
  validateModelExists,
  toggleActiveStatus,
  softDelete,
  hardDelete,
  runBulkOperation,
  swapPrecedence,
  nextPrecedence,
  getAll,
  getByID,
  getDefault,
  encodeId,
  decodeId,
  tryDecodeId,
  encryptSecret,
  decryptSecret,
  checkWhetherDocumentExists
};
