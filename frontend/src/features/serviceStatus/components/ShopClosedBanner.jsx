import { useState } from 'react';
import Button from '../../../components/common/Buttons';
import { useToast } from '../../../components/common/Toast';
import { useServiceStatus } from '../hooks/useServiceStatus';
import * as serviceStatusApi from '../api/serviceStatusApi';
import { formatDueAt } from '../../jobOrders/workTime';

/**
 * Across the top of every page for the owner while the shop is closed: users
 * see the closed page; "Open shop" opens it at once.
 */
const ShopClosedBanner = () => {
  const toast = useToast();
  const { shop, setShop } = useServiceStatus();
  const [isOpening, setIsOpening] = useState(false);
  if (!shop?.isClosed) return null;

  const openShop = async () => {
    setIsOpening(true);
    try {
      const result = await serviceStatusApi.updateShop({ shopClosed: false });
      setShop(result.shop);
      toast.success('The shop is open.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="min-w-0 flex-1 text-sm text-amber-900">
        <p className="font-semibold">Your shop is closed</p>
        <p className="text-amber-800">
          Your users see the shop closed page.{' '}
          {shop.resumeAt ? `It opens again by itself on ${formatDueAt(shop.resumeAt)}.` : 'It stays closed until you open it.'}
        </p>
      </div>
      <Button size="sm" onClick={openShop} loading={isOpening} loadingText="Opening...">Open shop</Button>
    </div>
  );
};

export default ShopClosedBanner;
