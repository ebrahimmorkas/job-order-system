import { useEffect, useState } from 'react';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useNow } from '../../../utils/useNow';
import JobOrderSummary from '../../jobOrders/components/JobOrderSummary';
import { summaryRowsOf } from '../../jobOrders/summaryRows';
import WorkItem from '../components/WorkItem';
import * as myWorkApi from '../api/myWorkApi';

const formatDateTime = (value) => new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * A job order the user is given work on: their work and when it is due, then
 * the job order itself - read only, without any money.
 *
 * @param {Object} props
 * @param {string} props.jobOrderId
 * @param {() => void} props.onBack
 */
const MyWorkViewPage = ({ jobOrderId, onBack }) => {
  const now = useNow();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    myWorkApi
      .getMyWorkJobOrder(jobOrderId, { signal: controller.signal })
      .then(setData)
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [jobOrderId]);

  const backLink = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
      <BackIcon className="w-4 h-4" /> Back to my work
    </button>
  );

  if (error) return <div className="max-w-3xl space-y-4">{backLink}<Alert variant="error">{error}</Alert></div>;
  if (!data) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  const { jobOrder, work } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        {backLink}
        <h1 className="mt-2 text-2xl font-bold text-gray-900 break-all">Job order {jobOrder.jobOrderNumber}</h1>
        <p className="mt-1 text-sm text-gray-500">Created {formatDateTime(jobOrder.createdAt)}</p>
      </div>

      <Card variant="outlined" title="Your work">
        <ul className="divide-y divide-gray-100">
          {work.map((item, index) => <li key={index} className="py-3 first:pt-0 last:pb-0"><WorkItem work={item} now={now} /></li>)}
        </ul>
      </Card>

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

      <Card variant="outlined" title="Job order">
        <JobOrderSummary rows={summaryRowsOf(jobOrder)} showAmounts={false} />
      </Card>
    </div>
  );
};

export default MyWorkViewPage;
