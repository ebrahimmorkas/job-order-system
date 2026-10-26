import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../components/common/Buttons';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import Dropdown from '../../../components/common/DropDown';
import EmptyState from '../../../components/common/EmptyState';
import { BackIcon, PrintIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import LayoutPage from '../../layouts/components/LayoutPage';
import { jobOrderResolver } from '../../layouts/fieldValues';
import { EXPORT_FORMATS, exportPages } from '../../layouts/exportLayout';
import { PX_PER_MM, describePaper } from '../../layouts/layoutConstants';
import { usePrintedPages } from '../../layouts/usePrintedPages';
import * as layoutsApi from '../../layouts/api/layoutsApi';
import * as jobOrdersApi from '../api/jobOrdersApi';

const PRINT_AREA_ID = 'job-order-print-area';

// On screen the pages to print wait out of sight (exports draw them from
// there); when printing only they show, one sheet each, at the layout's paper size.
const printCss = (paper) => `
  #${PRINT_AREA_ID} { position: fixed; left: -100000px; top: 0; pointer-events: none; }
  @page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
    body > *:not(#${PRINT_AREA_ID}) { display: none !important; }
    #${PRINT_AREA_ID} { position: static; left: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/**
 * A job order put through a layout: pick the layout (the default first),
 * see its pages, print them or download them as PDF / PNG / JPEG. Every item
 * prints: a table row repeated for each item grows the table, and what
 * doesn't fit continues on more pages (layouts/printFlow.js).
 *
 * @param {Object} props
 * @param {string} props.jobOrderId
 * @param {() => void} props.onBack
 * @param {string} [props.backLabel]
 */
const JobOrderPrintPage = ({ jobOrderId, onBack, backLabel = 'Back to the job order' }) => {
  const toast = useToast();
  const [jobOrder, setJobOrder] = useState(null);
  const [layouts, setLayouts] = useState(null);
  const [layoutId, setLayoutId] = useState('');
  const [printData, setPrintData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const areaRef = useRef(null);
  // The print area: its pages are drawn from there for downloads.
  const printAreaRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      jobOrdersApi.getJobOrder(jobOrderId, { signal: controller.signal }),
      layoutsApi.listLayoutsForPrint({ signal: controller.signal }),
    ])
      .then(([order, list]) => {
        setJobOrder(order.jobOrder);
        setLayouts(list.layouts);
        // The default comes first.
        setLayoutId(list.layouts[0]?._id || '');
      })
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [jobOrderId]);

  useEffect(() => {
    if (!layoutId) return undefined;
    const controller = new AbortController();
    layoutsApi
      .getLayoutForPrint(layoutId, { signal: controller.signal })
      .then((result) => setPrintData(result))
      .catch((err) => err?.name !== 'AbortError' && setError(err.message));
    return () => controller.abort();
  }, [layoutId]);

  // The preview fills the area's width (never bigger than real size).
  const hasPreview = !!(printData && jobOrder);
  useEffect(() => {
    if (!hasPreview || !areaRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setAreaWidth(entry.contentRect.width));
    observer.observe(areaRef.current);
    return () => observer.disconnect();
  }, [hasPreview]);

  const resolve = useMemo(() => (hasPreview ? jobOrderResolver(jobOrder, printData) : null), [hasPreview, jobOrder, printData]);
  // Numbered over all items: item 1's images first.
  const images = useMemo(() => (jobOrder?.items || []).flatMap((item) => item.images).map((image) => image.url), [jobOrder]);

  // A layout that was just picked is still loading.
  const isReady = hasPreview && printData.layout._id === layoutId;
  const paper = isReady ? printData.layout.paper : null;
  const { pages, measurer } = usePrintedPages({
    layout: isReady ? printData.layout : null,
    paper,
    resolve,
    itemCount: jobOrder?.items.length || 1,
    canFormatText: printData?.settings.canFormatText === true,
  });

  const backLink = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
      <BackIcon className="w-4 h-4" /> {backLabel}
    </button>
  );

  if (error) return <div className="max-w-3xl space-y-4">{backLink}<Alert variant="error">{error}</Alert></div>;
  if (!layouts) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;

  if (layouts.length === 0) {
    return (
      <div className="max-w-3xl space-y-4">
        {backLink}
        <EmptyState title="No layouts to print with" description="Create a layout in Layout Master (or mark one as active), then come back to print this job order." />
      </div>
    );
  }

  const scale = isReady && areaWidth > 0 ? Math.min(1, (areaWidth - 32) / (paper.widthMm * PX_PER_MM)) : 0;
  const fileName = `Job order ${jobOrder.jobOrderNumber}`;

  const runExport = async (format) => {
    setExporting(format);
    try {
      await exportPages([...printAreaRef.current.querySelectorAll(':scope > div')], paper, format, fileName);
    } catch (err) {
      toast.error(err?.message || 'The file could not be made.');
    } finally {
      setExporting(null);
    }
  };

  const isPaged = isReady && !!pages;
  const pageOf = (elements, index, extra = {}) => (
    <LayoutPage
      key={index}
      paper={paper}
      elements={elements}
      resolve={resolve}
      canFormatText={printData.settings.canFormatText}
      logoUrl={printData.company.logoUrl}
      images={images}
      page={{ number: index + 1, count: pages.length }}
      {...extra}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        {backLink}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 break-all">Print job order {jobOrder.jobOrderNumber}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button leftIcon={<PrintIcon className="w-4 h-4" />} onClick={() => window.print()} disabled={!isPaged}>Print</Button>
            {EXPORT_FORMATS.map((f) => (
              <Button key={f.value} variant="outline" size="sm" onClick={() => runExport(f.value)} disabled={!isPaged || exporting !== null} loading={exporting === f.value} loadingText="Making...">
                {f.label === 'PDF' ? 'Download PDF' : f.label.replace(' image', '')}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <Dropdown
            label="Layout"
            aria-label="Layout"
            options={layouts.map((l) => ({ value: l._id, label: l.isDefault ? `${l.name} (default)` : l.name }))}
            value={layoutId}
            onChange={(value) => setLayoutId(value)}
          />
        </div>
        {isReady && (
          <p className="pb-2 text-sm text-gray-500">
            {describePaper(paper)} · {paper.widthMm} x {paper.heightMm} mm{pages && ` · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-500">In the print window pick the same paper size and set margins to none. "Save as PDF" there keeps the text sharp; Download PDF saves a picture of the page.</p>

      <div ref={areaRef} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 p-4">
        {isPaged && scale > 0 ? (
          <div className="space-y-4">
            {pages.map((elements, index) => (
              <div key={index}>
                {pages.length > 1 && <p className="mb-1 text-center text-xs text-gray-500">Page {index + 1} of {pages.length}</p>}
                <div
                  className="mx-auto shadow-lg ring-1 ring-gray-300"
                  style={{ width: paper.widthMm * PX_PER_MM * scale, height: paper.heightMm * PX_PER_MM * scale }}
                  aria-label={`Print preview, page ${index + 1} of ${pages.length}`}
                  role="img"
                >
                  <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>{pageOf(elements, index)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 flex justify-center"><Spinner size="lg" /></div>
        )}
      </div>

      {measurer}
      {isPaged && createPortal(
        <div id={PRINT_AREA_ID} ref={printAreaRef} aria-hidden="true">
          <style>{printCss(paper)}</style>
          {/* One sheet per page. */}
          {pages.map((elements, index) => pageOf(elements, index, { style: index < pages.length - 1 ? { breakAfter: 'page' } : undefined }))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default JobOrderPrintPage;
