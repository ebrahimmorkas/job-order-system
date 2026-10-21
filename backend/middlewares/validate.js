const { sendError } = require("../utils/common");

/**
 * Validates req[property] against a Joi schema before the controller runs.
 *   router.post('/', validate(createJobSchema, 'body'), controller.create);
 *   router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
 *   router.get('/', validate(listQuerySchema, 'query'), controller.list);
 *
 * On failure: 400 with every problem at once, each as { field, message }.
 * On success: req[property] is replaced by the cleaned value (trimmed,
 * converted, unknown fields removed).
 */
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // collect all validation errors, not just the first
      stripUnknown: true, // drop fields not defined in the schema
      // Plain labels in messages: `Title is required`, not `"Title" is required`.
      errors: { wrap: { label: false } },
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        // The exact path, e.g. "items.0.quantity", so the frontend can point
        // at the right input even inside a list.
        field: detail.path.join("."),
        message: detail.message.replace(/"/g, ""),
      }));

      return sendError(res, 400, "Validation failed", errors);
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
