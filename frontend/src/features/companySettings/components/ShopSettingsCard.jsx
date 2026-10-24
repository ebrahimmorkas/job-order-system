import { useEffect, useState } from 'react';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Switch from '../../../components/common/Switch';
import TextArea from '../../../components/common/TextArea';
import InputField from '../../../components/common/InputField';
import Alert from '../../../components/common/Alert';
import { useToast } from '../../../components/common/Toast';
import { useServiceStatus } from '../../serviceStatus/hooks/useServiceStatus';
import * as serviceStatusApi from '../../serviceStatus/api/serviceStatusApi';
import { formatDueAt } from '../../jobOrders/workTime';

// Same as the backend (constants/serviceStatusConstants.js SERVICE_MESSAGE_MAX_LENGTH).
const MESSAGE_MAX_LENGTH = 500;

// <input type="datetime-local"> works in local time without a zone: "2026-10-24T17:30".
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fieldsOf = (shop) => ({
  shopClosed: !!shop?.isClosed,
  message: shop?.message || '',
  resumeAt: toLocalInput(shop?.resumeAt),
});

const sameFields = (a, b) => a.shopClosed === b.shopClosed && a.message.trim() === b.message.trim() && a.resumeAt === b.resumeAt;

/**
 * Company Settings > General > Shop (the owner only): close the shop - users
 * then see the shop closed page with the message and when it opens again -
 * or open it. With a time to open again the shop opens by itself then;
 * without one it stays closed until the owner opens it here (or from the
 * banner).
 *
 * @param {Object} props
 * @param {(key: string, isDirty: boolean) => void} props.onDirtyChange
 */
const ShopSettingsCard = ({ onDirtyChange }) => {
  const toast = useToast();
  const { shop, setShop } = useServiceStatus();
  const [fields, setFields] = useState(() => fieldsOf(shop));
  const [saved, setSaved] = useState(() => fieldsOf(shop));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // The earliest time to pick: when the card opened.
  const [minResumeAt] = useState(() => toLocalInput(new Date()));

  // Opened from the banner, or by itself at its time: show it here too.
  const shopKey = `${shop?.isClosed}|${shop?.message}|${shop?.resumeAt}`;
  const [seenKey, setSeenKey] = useState(shopKey);
  if (shopKey !== seenKey) {
    setSeenKey(shopKey);
    setFields(fieldsOf(shop));
    setSaved(fieldsOf(shop));
  }

  const isDirty = !sameFields(fields, saved);
  useEffect(() => { onDirtyChange('shop', isDirty); }, [isDirty, onDirtyChange]);

  const setField = (field, value) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (fields.shopClosed && fields.resumeAt && new Date(fields.resumeAt) <= new Date()) {
      setErrors({ resumeAt: 'Pick a time in the future' });
      return;
    }
    setIsSaving(true);
    try {
      const result = await serviceStatusApi.updateShop({
        shopClosed: fields.shopClosed,
        shopClosedMessage: fields.shopClosed ? fields.message.trim() || null : null,
        estimatedResumeTime: fields.shopClosed && fields.resumeAt ? new Date(fields.resumeAt).toISOString() : null,
      });
      setShop(result.shop);
      toast.success(result.shop.isClosed ? 'The shop is closed.' : 'The shop is open.');
    } catch (err) {
      const fieldErrors = Object.fromEntries((err.errors || []).map(({ field, message }) => [field === 'estimatedResumeTime' ? 'resumeAt' : field, message]));
      setErrors(fieldErrors);
      if (!err.errors?.length) setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card variant="outlined" title="Shop" subtitle="Close the shop for a while: your users see a closed page until it opens again. You keep working.">
        <div className="space-y-5">
          {formError && <Alert variant="error">{formError}</Alert>}
          {shop?.isClosed && (
            <Alert variant="warning">
              {shop.resumeAt
                ? `The shop is closed. It opens again by itself on ${formatDueAt(shop.resumeAt)}.`
                : 'The shop is closed with no time to open again - it stays closed until you open it here.'}
            </Alert>
          )}
          <Switch
            name="shopClosed"
            label="Shop closed"
            description={fields.shopClosed ? 'Users see the shop closed page.' : 'Users work as usual.'}
            checked={fields.shopClosed}
            onChange={(e) => setField('shopClosed', e.target.checked)}
            disabled={isSaving}
          />
          {fields.shopClosed && (
            <>
              <TextArea
                label="Message for your users (optional)"
                name="shopClosedMessage"
                placeholder="e.g. Closed for Diwali. See you on Monday!"
                value={fields.message}
                onChange={(e) => setField('message', e.target.value)}
                maxLength={MESSAGE_MAX_LENGTH}
                rows={2}
                disabled={isSaving}
              />
              <div>
                <InputField
                  label="Opens again at (optional)"
                  name="estimatedResumeTime"
                  type="datetime-local"
                  value={fields.resumeAt}
                  min={minResumeAt}
                  onChange={(e) => setField('resumeAt', e.target.value)}
                  error={errors.resumeAt}
                  disabled={isSaving}
                  className="sm:max-w-xs"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {fields.resumeAt
                    ? 'The shop opens by itself at this time.'
                    : 'Without a time, the shop stays closed until you open it again yourself.'}
                </p>
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={isSaving} loadingText="Saving..." disabled={!isDirty}>
              {fields.shopClosed && !saved.shopClosed ? 'Close the shop' : !fields.shopClosed && saved.shopClosed ? 'Open the shop' : 'Save changes'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
};

export default ShopSettingsCard;
