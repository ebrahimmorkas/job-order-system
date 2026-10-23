const express = require('express');
const router = express.Router();
const jobOrderController = require('../controllers/jobOrderController');
const validate = require('../middlewares/validate');
const v = require('../middlewares/validations/jobOrderValidations');
const imageUpload = require('../middlewares/imageUpload');
const parseMultipartData = require('../middlewares/parseMultipartData');

// Logged in already (server.js mounts this below authenticate). Any user of
// the vendor - roles (RBAC) can narrow this later.

// Above '/:id', so "form-data" is never read as an id.
router.get('/form-data', jobOrderController.getFormData);

const byId = validate(v.jobOrderIdParamSchema, 'params');

router.get('/', validate(v.listJobOrdersQuerySchema, 'query'), jobOrderController.listJobOrders);
// JSON, or multipart: the job order as JSON in "data" plus new images in "images".
const withImages = [imageUpload.multiple.array('images'), parseMultipartData];

router.post('/', ...withImages, validate(v.jobOrderSchema), jobOrderController.createJobOrder);
router.get('/:id', byId, jobOrderController.getJobOrder);
router.put('/:id', byId, ...withImages, validate(v.jobOrderSchema), jobOrderController.updateJobOrder);
router.delete('/:id', byId, jobOrderController.cancelJobOrder);

module.exports = router;
