const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const requirePermission = require('../middlewares/requirePermission');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/customerValidations');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). Nothing
// works while the Customers feature is off on either side.
router.use(requireFeature(FEATURE_FLAGS.CUSTOMERS));

// The job order form's search: anyone who may create or edit job orders.
router.get('/for-job-order', requirePermission('jobOrders', ['create', 'edit']), validate(v.searchCustomersQuerySchema, 'query'), customerController.searchForJobOrder);

const can = (permission) => requirePermission('customers', permission);
const byId = validate(v.customerIdParamSchema, 'params');

// Above '/:id', so "form-data" and "bulk" are never read as an id.
router.get('/form-data', can('details'), customerController.getFormData);
router.post('/bulk', can('delete'), validate(v.bulkCustomersSchema), customerController.bulkDeleteCustomers);

// No create: customers are saved from job orders.
router.get('/', can('view'), validate(v.listCustomersQuerySchema, 'query'), customerController.listCustomers);
router.get('/:id', can('details'), byId, customerController.getCustomer);
router.put('/:id', can('edit'), byId, validate(v.customerSchema), customerController.updateCustomer);
router.delete('/:id', can('delete'), byId, customerController.deleteCustomer);

module.exports = router;
