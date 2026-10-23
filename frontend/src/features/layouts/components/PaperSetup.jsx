import NumberField from '../../../components/common/NumberField';
import { CUSTOM_PAPER, CUSTOM_PAPER_MAX_MM, CUSTOM_PAPER_MIN_MM, LABEL_DEFAULTS, paperOf } from '../layoutConstants';

const LABEL_HINTS = {
  masters: 'Masters show their name: "Cutting: Round". Controls show only the value.',
  controls: 'Controls show their name: "Remarks: Urgent". Masters show only the value.',
  both: 'Masters and controls show their name: "Cutting: Round".',
  none: 'Only the value: "Round". Turn a label on per item any time.',
};

const choiceClass = (isOn) =>
  `rounded-lg border-2 px-3 py-2 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isOn ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-300'}`;

// A little sheet with the paper's shape.
const PaperShape = ({ widthMm, heightMm }) => {
  const scale = 34 / Math.max(widthMm, heightMm);
  return <span aria-hidden="true" className="block rounded-[2px] border border-gray-400 bg-white" style={{ width: Math.max(8, widthMm * scale), height: Math.max(8, heightMm * scale) }} />;
};

/**
 * The paper (named size or custom width / height, portrait or landscape) and
 * which dropped fields show their label by default.
 *
 * @param {Object} props
 * @param {{ size, orientation, widthMm, heightMm }} props.paper
 * @param {(paper: Object) => void} props.onPaperChange
 * @param {Array<{ key, label, widthMm, heightMm }>} props.paperSizes
 * @param {string} props.labelDefault
 * @param {(value: string) => void} props.onLabelDefaultChange
 * @param {Object} [props.errors] - { paper, labelDefault }
 * @param {boolean} [props.isCompact] - In the designer's side panel
 */
const PaperSetup = ({ paper, onPaperChange, paperSizes, labelDefault, onLabelDefaultChange, errors = {}, isCompact = false }) => {
  const isCustom = paper.size === CUSTOM_PAPER;
  const printed = isCustom ? paper : paperOf(paper, paperSizes);

  const pickSize = (size) => {
    if (size !== CUSTOM_PAPER) return onPaperChange({ ...paper, size });
    // A custom size starts from what is shown now.
    return onPaperChange({ ...paper, size, widthMm: printed.widthMm, heightMm: printed.heightMm });
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">Paper size</legend>
        <div className={`grid gap-2 ${isCompact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'}`}>
          {[...paperSizes, { key: CUSTOM_PAPER, label: 'Custom', widthMm: printed.widthMm, heightMm: printed.heightMm }].map((size) => {
            const isOn = paper.size === size.key;
            return (
              <button key={size.key} type="button" aria-pressed={isOn} onClick={() => pickSize(size.key)} className={`${choiceClass(isOn)} flex flex-col items-center gap-1.5`}>
                <span className="flex h-9 items-end"><PaperShape widthMm={size.widthMm} heightMm={size.heightMm} /></span>
                <span className="text-sm font-medium text-gray-900">{size.label}</span>
                {!isCompact && size.key !== CUSTOM_PAPER && <span className="text-[11px] text-gray-500">{size.widthMm} x {size.heightMm} mm</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      {isCustom ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <NumberField label="Width" unit="mm" min={CUSTOM_PAPER_MIN_MM} max={CUSTOM_PAPER_MAX_MM} step={0.5} value={paper.widthMm} onChange={(value) => onPaperChange({ ...paper, widthMm: value })} />
          <NumberField label="Height" unit="mm" min={CUSTOM_PAPER_MIN_MM} max={CUSTOM_PAPER_MAX_MM} step={0.5} value={paper.heightMm} onChange={(value) => onPaperChange({ ...paper, heightMm: value })} />
          <p className="col-span-2 text-xs text-gray-500">From {CUSTOM_PAPER_MIN_MM} to {CUSTOM_PAPER_MAX_MM} mm each.</p>
        </div>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">Orientation</legend>
          <div className="flex gap-2">
            {['portrait', 'landscape'].map((orientation) => (
              <button
                key={orientation}
                type="button"
                aria-pressed={paper.orientation === orientation}
                onClick={() => onPaperChange({ ...paper, orientation })}
                className={`${choiceClass(paper.orientation === orientation)} text-sm font-medium text-gray-900`}
              >
                {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">{printed.widthMm} x {printed.heightMm} mm</p>
        </fieldset>
      )}
      {errors.paper && <p className="text-sm text-red-600" role="alert">{errors.paper}</p>}

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">Show labels by default for</legend>
        <p className="mb-2 text-xs text-gray-500">Used for items you add from now on.</p>
        <div className={`grid gap-2 ${isCompact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {LABEL_DEFAULTS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={labelDefault === option.value}
              onClick={() => onLabelDefaultChange(option.value)}
              className={`${choiceClass(labelDefault === option.value)} text-sm font-medium text-gray-900`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">{LABEL_HINTS[labelDefault]}</p>
      </fieldset>
    </div>
  );
};

export default PaperSetup;
