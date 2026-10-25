import { useState } from 'react';
import Dropdown from '../../../components/common/DropDown';
import NumberField from '../../../components/common/NumberField';
import TextArea from '../../../components/common/TextArea';
import Button from '../../../components/common/Buttons';
import { useToast } from '../../../components/common/Toast';
import * as myWorkApi from '../api/myWorkApi';

// Same as the backend (constants/stepConstants.js HOLD_REASON_MAX_LENGTH).
const HOLD_REASON_MAX_LENGTH = 500;

/**
 * Moves the user's work on one value of an item to a step - any step, in the vendor's
 * order. In progress asks how much is done (%, optional); Hold asks why
 * (optional). Saved with "Update step". Also moves a whole job order (onSave).
 *
 * @param {Object} props
 * @param {string} props.jobOrderId
 * @param {{ itemId: string, valueId: string, valueName: string, step: Object|null }} props.work
 * @param {Array<{ key: string, fixedStep: string|null, name: string }>} props.steps
 * @param {() => void} props.onChanged - After a step is saved
 * @param {((data: { stepKey, percent, holdReason }) => Promise<{ step: Object }>)} [props.onSave] - Saves it instead of the user's own work
 */
const StepChanger = ({ jobOrderId, work, steps, onChanged, onSave }) => {
  const toast = useToast();
  const current = work.step;
  const [stepKey, setStepKey] = useState(current?.key && steps.some((step) => step.key === current.key) ? current.key : '');
  const [percent, setPercent] = useState(current?.fixedStep === 'inProgress' ? current.percent : null);
  const [holdReason, setHoldReason] = useState(current?.fixedStep === 'hold' ? current.holdReason || '' : '');
  const [isSaving, setIsSaving] = useState(false);

  const picked = steps.find((step) => step.key === stepKey);
  const isChanged = !!picked && (picked.key !== current?.key
    || (picked.fixedStep === 'inProgress' && (percent ?? null) !== (current?.percent ?? null))
    || (picked.fixedStep === 'hold' && holdReason.trim() !== (current?.holdReason || '')));

  const save = async () => {
    setIsSaving(true);
    try {
      const data = {
        stepKey,
        percent: picked.fixedStep === 'inProgress' ? percent : null,
        holdReason: picked.fixedStep === 'hold' ? holdReason.trim() || null : null,
      };
      const result = onSave ? await onSave(data) : await myWorkApi.setMyStep(jobOrderId, { itemId: work.itemId, valueId: work.valueId, ...data });
      toast.success(`${work.valueName}: moved to ${result.step.name}.`);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg bg-gray-50 p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <Dropdown
            label="Step"
            name={`step-${work.itemId}-${work.valueId}`}
            options={steps.map((step) => ({ value: step.key, label: step.name }))}
            value={stepKey}
            onChange={setStepKey}
            placeholder="Pick a step"
            size="sm"
            disabled={isSaving}
            aria-label={`Step for ${work.valueName}`}
          />
        </div>
        {picked?.fixedStep === 'inProgress' && (
          <NumberField
            label="Work done (%)"
            value={percent}
            onChange={(value) => setPercent(value === null || Number.isInteger(value) ? value : percent)}
            min={0}
            max={100}
            unit="%"
            allowEmpty
            placeholder="Optional"
            disabled={isSaving}
            className="w-32"
          />
        )}
        <Button size="sm" onClick={save} loading={isSaving} loadingText="Saving..." disabled={!isChanged}>Update step</Button>
      </div>
      {picked?.fixedStep === 'hold' && (
        <TextArea
          label="Why is it on hold? (optional)"
          name={`hold-${work.itemId}-${work.valueId}`}
          value={holdReason}
          onChange={(e) => setHoldReason(e.target.value)}
          maxLength={HOLD_REASON_MAX_LENGTH}
          rows={2}
          disabled={isSaving}
        />
      )}
    </div>
  );
};

export default StepChanger;
