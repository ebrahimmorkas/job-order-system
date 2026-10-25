import { useEffect, useState } from 'react';
import { useRealtimeEvent } from '../../realtime/hooks/useRealtimeEvent';
import { REALTIME_EVENTS } from '../../realtime/events';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useNow } from '../../../utils/useNow';
import JobOrderSummary from '../../jobOrders/components/JobOrderSummary';
import { summaryRowsOf } from '../../jobOrders/summaryRows';
import WorkItem from '../components/WorkItem';
import StepChanger from '../components/StepChanger';
import StepHistory from '../../jobOrders/components/StepHistory';
import ImageGrid from '../../jobOrders/components/ImageGrid';
import { itemLabelOf } from '../../jobOrders/jobOrderItems';
import * as myWorkApi from '../api/myWorkApi';

const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * A job order the user is given work on: their work, when it is due, the
 * step it is at (they move it to another step here, while steps are on) and
 * its history; then the job order itself - read only, without any money.
 *
 * @param {Object} props
 * @param {string} props.jobOrderId
 * @param {() => void} props.onBack
 */
const MyWorkViewPage = ({ jobOrderId, onBack }) => {
  const now = useNow();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Bumped after a step change (or when the server says it changed) to load the job order again.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    myWorkApi
      .getMyWorkJobOrder(jobOrderId, { signal: controller.signal })
      .then(setData)
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [jobOrderId, reloadKey]);

  useRealtimeEvent([REALTIME_EVENTS.MY_WORK_CHANGED, REALTIME_EVENTS.RECONNECTED], (data) => {
    if (!data.jobOrderId || data.jobOrderId === jobOrderId) setReloadKey((n) => n + 1);
  });

  const backLink = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
      <BackIcon className="w-4 h-4" /> Back to my work
    </button>
  );

  if (error) return <div className="max-w-3xl space-y-4">{backLink}<Alert variant="error">{error}</Alert></div>;
  if (!data) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const { jobOrder, work, steps } = data;
  const itemCount = jobOrder.items.length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        {backLink}
        <h1 className="mt-2 text-2xl font-bold text-gray-900 break-all">Job order {jobOrder.jobOrderNumber}</h1>
        <p className="mt-1 text-sm text-gray-500">Created {formatDateTime(jobOrder.createdAt)}</p>
      </div>

      <Card variant="outlined" title="Your work">
        <ul className="divide-y divide-gray-100">
          {work.map((item) => (
            <li key={`${item.itemId}-${item.valueId}`} className="py-4 first:pt-0 last:pb-0 space-y-3">
              <WorkItem work={item} now={now} />
              {steps.length > 0 && (
                <StepChanger key={item.step?.at || 'none'} jobOrderId={jobOrder._id} work={item} steps={steps} onChanged={() => setReloadKey((n) => n + 1)} />
              )}
              <StepHistory history={item.history} />
            </li>
          ))}
        </ul>
      </Card>

      {jobOrder.items.some((item) => item.images.length > 0) && (
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

      <Card variant="outlined" title="Job order">
        <JobOrderSummary rows={summaryRowsOf(jobOrder)} showAmounts={false} />
      </Card>
    </div>
  );
};

export default MyWorkViewPage;
