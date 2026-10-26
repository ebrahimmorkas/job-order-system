import { useEffect, useState } from 'react';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import { BackIcon, EditIcon, PrintIcon } from '../../../components/common/ActionIcons';
import JobOrderSummary from '../components/JobOrderSummary';
import WorkProgress from '../components/WorkProgress';
import StepBadge from '../components/StepBadge';
import StepHistory from '../components/StepHistory';
import StepChanger from '../../myWork/components/StepChanger';
import ImageGrid from '../components/ImageGrid';
import { summaryRowsOf } from '../summaryRows';
import { itemLabelOf } from '../jobOrderItems';
import { formatDueAt } from '../workTime';
import * as jobOrdersApi from '../api/jobOrdersApi';

const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * A saved job order, as it was saved (names copied in at the time).
 *
 * @param {Object} props
 * @param {string} props.jobOrderId
 * @param {() => void} props.onBack
 * @param {(() => void)|null} props.onEdit - null without the Edit permission
 * @param {(() => void)|null} props.onPrint - null while Layout Master is off
 * @param {boolean} props.canChangeStep - May move the job order's own step (Edit on job orders)
 */
const JobOrderViewPage = ({ jobOrderId, onBack, onEdit, onPrint, canChangeStep }) => {
  const [jobOrder, setJobOrder] = useState(null);
  // The vendor's steps (none while steps are off).
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState('');
  // Bumped when the server says this job order changed.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    jobOrdersApi
      .getJobOrder(jobOrderId, { signal: controller.signal })
      .then((result) => {
        setJobOrder(result.jobOrder);
        setSteps(result.steps || []);
      })
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [jobOrderId, reloadKey]);

  useRealtimeEvent([REALTIME_EVENTS.JOB_ORDERS_CHANGED, REALTIME_EVENTS.RECONNECTED], (data) => {
    if (!data.jobOrderId || data.jobOrderId === jobOrderId) setReloadKey((n) => n + 1);
  });

  const backLink = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
      <BackIcon className="w-4 h-4" /> Back to job orders
    </button>
  );

  if (error) return <div className="max-w-3xl space-y-4">{backLink}<Alert variant="error">{error}</Alert></div>;
  if (!jobOrder) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const wasEdited = jobOrder.updatedAt && jobOrder.updatedAt !== jobOrder.createdAt;
  const itemCount = jobOrder.items.length;
  const hasImages = jobOrder.items.some((item) => item.images.length > 0);

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
            {onEdit && <Button variant="outline" leftIcon={<EditIcon className="w-4 h-4" />} onClick={onEdit}>Edit</Button>}
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Created {formatDateTime(jobOrder.createdAt)}{wasEdited && ` · last changed ${formatDateTime(jobOrder.updatedAt)}`}
        </p>
        {jobOrder.deliveryAt && <p className="mt-1 text-sm font-medium text-indigo-700">Delivery {formatDate(jobOrder.deliveryAt)}</p>}
      </div>

      {hasImages && (
        <Card variant="outlined" title="Images">
          <div className="space-y-4">
            {jobOrder.items.map((item, itemIndex) => item.images.length > 0 && (
              <div key={item._id} className="space-y-2">
                {itemCount > 1 && <p className="text-sm font-medium text-gray-700 break-words">{itemLabelOf(item, itemIndex, itemCount)}</p>}
                <ImageGrid images={item.images} altOf={(index) => `Image ${index + 1} of ${itemCount > 1 ? `item ${itemIndex + 1} of ` : ''}job order ${jobOrder.jobOrderNumber}`} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {steps.length > 0 && (
        <Card variant="outlined" title="Job order step" subtitle="The step of the whole job order. The workers' own steps don't change.">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StepBadge step={jobOrder.step} />
              {jobOrder.step && <span className="text-xs text-gray-500">by {jobOrder.step.byName} - {formatDueAt(jobOrder.step.at)}</span>}
            </div>
            {jobOrder.step?.holdReason && <p className="text-sm text-gray-600 break-words">{jobOrder.step.holdReason}</p>}
            {canChangeStep && (
              <StepChanger
                // A fresh form after each change (the saved step is its start).
                key={jobOrder.step?.at || 'none'}
                jobOrderId={jobOrder._id}
                work={{ itemId: 'jobOrder', valueId: jobOrder._id, valueName: `Job order ${jobOrder.jobOrderNumber}`, step: jobOrder.step }}
                steps={steps}
                onSave={(data) => jobOrdersApi.setJobOrderStep(jobOrder._id, data)}
                onChanged={() => setReloadKey((n) => n + 1)}
              />
            )}
            <StepHistory history={jobOrder.stepHistory} />
          </div>
        </Card>
      )}

      {jobOrder.items.some((item) => item.masters.some((master) => master.values.some((value) => value.assignedTo?.length > 0))) && (
        <Card variant="outlined" title="Work progress">
          <WorkProgress items={jobOrder.items} />
        </Card>
      )}

      <Card variant="outlined" title="Summary">
        <JobOrderSummary
          rows={summaryRowsOf(jobOrder)}
          currency={jobOrder.currency}
          subtotal={jobOrder.subtotal}
          tax={jobOrder.tax}
          total={jobOrder.total}
          discount={jobOrder.discount}
          roundOff={jobOrder.roundOff}
          advance={jobOrder.advance}
          balance={jobOrder.balance}
        />
      </Card>
    </div>
  );
};

export default JobOrderViewPage;
