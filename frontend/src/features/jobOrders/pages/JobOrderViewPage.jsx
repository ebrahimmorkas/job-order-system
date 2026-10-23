import { useEffect, useState } from 'react';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import { BackIcon, EditIcon, PrintIcon } from '../../../components/common/ActionIcons';
import JobOrderSummary from '../components/JobOrderSummary';
import { summaryRowsOf } from '../summaryRows';
import * as jobOrdersApi from '../api/jobOrdersApi';

const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * A saved job order, as it was saved (names copied in at the time).
 *
 * @param {Object} props
 * @param {string} props.jobOrderId
 * @param {() => void} props.onBack
 * @param {() => void} props.onEdit
 * @param {(() => void)|null} props.onPrint - null while Layout Master is off
 */
const JobOrderViewPage = ({ jobOrderId, onBack, onEdit, onPrint }) => {
  const [jobOrder, setJobOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    jobOrdersApi
      .getJobOrder(jobOrderId, { signal: controller.signal })
      .then((result) => setJobOrder(result.jobOrder))
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [jobOrderId]);

  const backLink = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
      <BackIcon className="w-4 h-4" /> Back to job orders
    </button>
  );

  if (error) return <div className="max-w-3xl space-y-4">{backLink}<Alert variant="error">{error}</Alert></div>;
  if (!jobOrder) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const wasEdited = jobOrder.updatedAt && jobOrder.updatedAt !== jobOrder.createdAt;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        {backLink}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 break-all">Job order {jobOrder.jobOrderNumber}</h1>
            {jobOrder.tax?.isApplied && <Badge variant="green">Tax charged</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {onPrint && <Button variant="outline" leftIcon={<PrintIcon className="w-4 h-4" />} onClick={onPrint}>Print</Button>}
            <Button variant="outline" leftIcon={<EditIcon className="w-4 h-4" />} onClick={onEdit}>Edit</Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Created {formatDateTime(jobOrder.createdAt)}{wasEdited && ` · last changed ${formatDateTime(jobOrder.updatedAt)}`}
        </p>
      </div>

      {jobOrder.images?.length > 0 && (
        <Card variant="outlined" title="Images">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Job order images">
            {jobOrder.images.map((image, index) => (
              <li key={image.imageId} className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <a href={image.url} target="_blank" rel="noopener noreferrer" title="Open full size" className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <img src={image.url} alt={`Image ${index + 1} of job order ${jobOrder.jobOrderNumber}`} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card variant="outlined" title="Summary">
        <JobOrderSummary
          rows={summaryRowsOf(jobOrder)}
          currency={jobOrder.currency}
          subtotal={jobOrder.subtotal}
          tax={jobOrder.tax}
          total={jobOrder.total}
        />
      </Card>
    </div>
  );
};

export default JobOrderViewPage;
