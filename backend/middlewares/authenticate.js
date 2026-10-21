const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendError } = require("../utils/common");
const { logException } = require("../utils/logger");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return sendError(res, 401, "Please Login Again");

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      return sendError(res, 401, "Please Login Again");
    }

    const user = await User.findById(decoded.userId);

    if (!user || user.status === "D")
      return sendError(res, 401, "User not found");

    if (user.status === "I")
      return sendError(res, 403, "Your account has been deactivated. Please contact support.");

    // Tenant check: a token only works on the vendor its user belongs to.
    // vendorDetection (mounted app-wide in server.js) has already resolved
    // req.vendorId from the hostname, so without this a user of vendor A
    // could call vendor B's domain with A's token and act on B's data.
    if (isForeignVendor(user, req))
      return sendError(res, 403, "You do not have access to this account.");

    // req.user is also what AuditLog records as changedBy (models/plugins/auditPlugin.js).
    req.user = { _id: user._id, role: user.role, vendorId: user.vendorId };

    next();
  } catch (error) {
    // Answers the request with a 500 + error reference itself, so it never hangs.
    logException("Exception in authenticate middleware", error);
  }
};

// True only when both sides are known AND differ - a user record or request
// without a vendorId (legacy data, or a route that runs before vendor
// detection) is left to the rest of the middleware chain instead of being
// locked out here.
const isForeignVendor = (user, req) =>
  !!user.vendorId && !!req.vendorId && user.vendorId.toString() !== req.vendorId.toString();

module.exports = authenticate;
