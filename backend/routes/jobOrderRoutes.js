const express = require('express');
const router = express.Router();
const jobOrderController = require('../controllers/jobOrderController');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/jobOrderValidations');
const imageUpload = require('../middlewares/imageUpload');
const parseMultipartData = require('../middlewares/parseMultipartData');
const requirePermission = require('../middlewares/requirePermission');
const requireFeature = require('../middlewares/requireFeature');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// Logged in already (server.js mounts this below authenticate). The owner,
// or a user whose roles give the permission.
const can = (permission) => requirePermission('jobOrders', permission);

// Above '/:id', so "form-data" is never read as an id.
router.get('/form-data', can(['create', 'edit']), jobOrderController.getFormData);

const byId = validate(v.jobOrderIdParamSchema, 'params');

router.get('/', can('view'), validate(v.listJobOrdersQuerySchema, 'query'), jobOrderController.listJobOrders);
// JSON, or multipart: the job order as JSON in "data" plus new images in "images".
const withImages = [imageUpload.multiple.array('images'), parseMultipartData];

router.post('/', can('create'), ...withImages, validate(v.jobOrderSchema), jobOrderController.createJobOrder);
router.get('/:id', can('details'), byId, jobOrderController.getJobOrder);
router.put('/:id', can('edit'), byId, ...withImages, validate(v.jobOrderSchema), jobOrderController.updateJobOrder);
router.delete('/:id', can('delete'), byId, jobOrderController.cancelJobOrder);
// The job order's own step: Edit on job orders, steps on (RBAC not needed).
router.patch('/:id/step', can('edit'), requireFeature(FEATURE_FLAGS.STEPS), byId, validate(v.jobOrderStepSchema), jobOrderController.setJobOrderStep);

module.exports = router;
