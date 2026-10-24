import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/common/Buttons';
import Card from '../../../components/common/Card';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import Menu from '../../../components/common/Menu';
import Dropdown from '../../../components/common/DropDown';
import InputField from '../../../components/common/InputField';
import { BackIcon } from '../../../components/common/ActionIcons';
import { useToast } from '../../../components/common/Toast';
import { useUnsavedChanges } from '../../../components/common/UnsavedChanges';
import DesignerCanvas, { ZOOM_MAX, ZOOM_MIN } from '../components/DesignerCanvas';
import ElementPalette from '../components/ElementPalette';
import PropertiesPanel from '../components/PropertiesPanel';
import SidePanel from '../components/SidePanel';
import PaperSetup from '../components/PaperSetup';
import LayoutPage from '../components/LayoutPage';
import { useLayoutHistory } from '../useLayoutHistory';
import { placeholderResolver } from '../fieldValues';
import { EXPORT_FORMATS, exportPage } from '../exportLayout';
import {
  CUSTOM_PAPER, ELEMENTS_MAX, IMAGE_NUMBER_MAX, NAME_MAX_LENGTH, PX_PER_MM, createElement, describePaper, elementName, fitOnPage, newElementId, paperOf,
} from '../layoutConstants';
import * as layoutsApi from '../api/layoutsApi';

const NAME_MIN_LENGTH = 2;

// Which side panels are open (items on the left, settings on the right),
// kept in this browser. A folded panel gives its room to the page.
const PANELS_KEY = 'layoutPanels';
const readPanels = () => {
  try {
    return { items: true, settings: true, ...JSON.parse(localStorage.getItem(PANELS_KEY) || '{}') };
  } catch {
    return { items: true, settings: true };
  }
};
// A folded panel keeps a slim strip. Written out in full so Tailwind keeps every one.
const GRID_COLUMNS = {
  'items-settings': 'lg:grid-cols-[220px_minmax(0,1fr)_300px]',
  items: 'lg:grid-cols-[220px_minmax(0,1fr)_2.75rem]',
  settings: 'lg:grid-cols-[2.75rem_minmax(0,1fr)_300px]',
  '': 'lg:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]',
};
const COPY_SUFFIX = ' (copy)';
const NEW_LAYOUT = { name: '', paper: { size: 'A4', orientation: 'portrait' }, labelDefault: 'none', elements: [] };
const ZOOM_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  ...[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => ({ value: String(z), label: `${z * 100}%` })),
];
// Items added by a click land a little apart.
const ADD_SPOT_MM = 10;
const ADD_STEP_MM = 5;

// What the server keeps; also tells whether anything changed.
const toPayload = ({ name, labelDefault, doc }) => ({
  name: name.trim(),
  paper: doc.paper.size === CUSTOM_PAPER
    ? { size: CUSTOM_PAPER, widthMm: doc.paper.widthMm, heightMm: doc.paper.heightMm }
    : { size: doc.paper.size, orientation: doc.paper.orientation },
  labelDefault,
  elements: doc.elements,
});

const isOutside = (element, paper) =>
  element.x + element.width > paper.widthMm + 0.01 || element.y + element.height > paper.heightMm + 0.01;

const isTyping = (target) => target.closest('input, textarea, select, [contenteditable="true"], [role="listbox"]');

/**
 * The designer, once everything it needs is loaded.
 */
const Designer = ({ mode, initial, formData, onBack }) => {
  const toast = useToast();
  const [layoutId, setLayoutId] = useState(initial.id);
  const [step, setStep] = useState(mode === 'create' ? 'setup' : 'design');
  const [name, setName] = useState(initial.name);
  const [labelDefault, setLabelDefault] = useState(initial.labelDefault);
  const history = useLayoutHistory({ paper: initial.paper, elements: initial.elements });
  const { doc } = history;
  const [savedSnapshot, setSavedSnapshot] = useState(() => (mode === 'clone' ? null : JSON.stringify(toPayload({ ...initial, doc: history.doc }))));
  const [selectedId, setSelectedId] = useState(null);
  // Opens at real size, so text is readable; a bigger page scrolls in its area.
  const [zoomChoice, setZoomChoice] = useState('1');
  const [areaWidth, setAreaWidth] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [formError, setFormError] = useState('');
  const [nameError, setNameError] = useState('');
  // Server errors per element id.
  const [elementErrors, setElementErrors] = useState({});
  const [panels, setPanels] = useState(readPanels);
  const areaRef = useRef(null);
  const exportRef = useRef(null);

  const { canFormatText } = formData.settings;
  const paper = useMemo(() => paperOf(doc.paper, formData.paperSizes), [doc.paper, formData.paperSizes]);
  const resolve = useMemo(() => placeholderResolver(formData), [formData]);
  const selected = doc.elements.find((e) => e.id === selectedId) || null;
  const outsideCount = doc.elements.filter((e) => isOutside(e, paper)).length;

  const snapshot = JSON.stringify(toPayload({ name, labelDefault, doc }));
  const isDirty = snapshot !== savedSnapshot;
  const confirmLeave = useUnsavedChanges(isDirty && !isSaving);

  // The page fills the area's width at "Fit" (the area's padding keeps the edges to stretch it).
  useEffect(() => {
    if (step !== 'design' || !areaRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setAreaWidth(entry.contentRect.width));
    observer.observe(areaRef.current);
    return () => observer.disconnect();
  }, [step]);
  const fitZoom = areaWidth > 0 ? Math.min(2, Math.max(ZOOM_MIN, (areaWidth - 8) / (paper.widthMm * PX_PER_MM))) : 0.5;
  const zoom = zoomChoice === 'fit' ? fitZoom : Number(zoomChoice);
  // A zoom made by stretching the page shows in the list too.
  const zoomOptions = ZOOM_OPTIONS.some((option) => option.value === zoomChoice)
    ? ZOOM_OPTIONS
    : [...ZOOM_OPTIONS, { value: zoomChoice, label: `${Math.round(Number(zoomChoice) * 100)}%` }];

  const togglePanel = (panel) => {
    const next = { ...panels, [panel]: !panels[panel] };
    setPanels(next);
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify(next));
    } catch {
      // Not kept (private window); the panel still opens and closes.
    }
  };
  const gridColumns = GRID_COLUMNS[['items', 'settings'].filter((panel) => panels[panel]).join('-')];

  const checkName = () => {
    const trimmed = name.trim();
    const message = trimmed.length < NAME_MIN_LENGTH ? `Please enter a name of at least ${NAME_MIN_LENGTH} characters.` : '';
    setNameError(message);
    return !message;
  };

  const forgetError = (id) => {
    if (!elementErrors[id]) return;
    setElementErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addItem = (item, at = null) => {
    if (doc.elements.length >= ELEMENTS_MAX) return toast.warning(`A layout can have at most ${ELEMENTS_MAX} items.`);
    const offset = (doc.elements.length % 10) * ADD_STEP_MM;
    const spot = at || { x: ADD_SPOT_MM + offset, y: ADD_SPOT_MM + offset };
    // A new job order image takes the next number.
    const imageNumber = Math.min(IMAGE_NUMBER_MAX, Math.max(0, ...doc.elements.filter((e) => e.type === 'image').map((e) => e.imageNumber)) + 1);
    const element = fitOnPage(createElement(item.kind, { ...spot, field: item.field, labelDefault, imageNumber }), paper);
    history.change((d) => ({ ...d, elements: [...d.elements, element] }));
    setSelectedId(element.id);
    return areaRef.current?.focus({ preventScroll: true });
  };

  const changeSelected = (patch, mergeKey) => {
    forgetError(selectedId);
    history.changeElement(selectedId, patch, mergeKey);
  };

  const removeSelected = () => {
    history.change((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selectedId) }));
    forgetError(selectedId);
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (doc.elements.length >= ELEMENTS_MAX) return toast.warning(`A layout can have at most ${ELEMENTS_MAX} items.`);
    const copy = fitOnPage({ ...structuredClone(selected), id: newElementId(), x: selected.x + ADD_STEP_MM, y: selected.y + ADD_STEP_MM }, paper);
    history.change((d) => ({ ...d, elements: [...d.elements, copy] }));
    return setSelectedId(copy.id);
  };

  const arrangeSelected = (where) => history.change((d) => {
    const others = d.elements.filter((e) => e.id !== selectedId);
    return { ...d, elements: where === 'front' ? [...others, selected] : [selected, ...others] };
  });

  const nudgeSelected = (dx, dy) => {
    const moved = fitOnPage({ ...selected, x: selected.x + dx, y: selected.y + dy }, paper);
    if (moved.x !== selected.x || moved.y !== selected.y) changeSelected({ x: moved.x, y: moved.y }, 'nudge');
  };

  const changePaper = (next) => history.change((d) => ({ ...d, paper: next }), 'paper');
  const fitAllOnPage = () => {
    history.change((d) => ({ ...d, elements: d.elements.map((e) => fitOnPage(e, paper)) }));
    setFormError('');
  };

  const handleKeyDown = (e) => {
    if (step !== 'design' || isTyping(e.target)) return;
    const isCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (isCtrl && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) history.redo(); else history.undo();
      return;
    }
    if (isCtrl && key === 'y') {
      e.preventDefault();
      history.redo();
      return;
    }
    if (!selected) return;
    const stepMm = e.shiftKey ? 10 : 1;
    const moves = { arrowleft: [-stepMm, 0], arrowright: [stepMm, 0], arrowup: [0, -stepMm], arrowdown: [0, stepMm] };
    if (moves[key]) {
      e.preventDefault();
      nudgeSelected(...moves[key]);
    } else if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      removeSelected();
    } else if (isCtrl && key === 'd') {
      e.preventDefault();
      duplicateSelected();
    } else if (key === 'escape') {
      setSelectedId(null);
    }
  };

  // Joi's "elements.3.x" and the service's "elements.<id>" both point at an item.
  const toElementErrors = (errors) => {
    const byId = {};
    for (const { field, message } of errors || []) {
      const [list, ref] = field.split('.');
      if (list !== 'elements' || !ref) continue;
      const id = /^\d+$/.test(ref) ? doc.elements[Number(ref)]?.id : ref;
      if (id && !byId[id]) byId[id] = message;
    }
    return byId;
  };

  const save = async () => {
    if (!checkName()) return;
    if (outsideCount > 0) {
      setFormError(`${outsideCount === 1 ? 'One item goes' : `${outsideCount} items go`} outside the page. Move ${outsideCount === 1 ? 'it' : 'them'} onto the page first.`);
      return;
    }
    setIsSaving(true);
    setFormError('');
    const payload = toPayload({ name, labelDefault, doc });
    try {
      if (layoutId) {
        await layoutsApi.updateLayout(layoutId, payload);
        toast.success('Layout saved.');
      } else {
        const result = await layoutsApi.createLayout(payload);
        setLayoutId(result.layout._id);
        toast.success(mode === 'clone' ? 'Copy of the layout created.' : 'Layout created.');
      }
      setSavedSnapshot(JSON.stringify(payload));
      setElementErrors({});
    } catch (err) {
      const byId = toElementErrors(err.errors);
      setElementErrors(byId);
      const nameMessage = err.errors?.find((e) => e.field === 'name')?.message;
      if (nameMessage) setNameError(nameMessage);
      const firstId = Object.keys(byId)[0];
      if (firstId) setSelectedId(firstId);
      setFormError(firstId ? `Some items need fixing. ${byId[firstId]}` : (nameMessage ? '' : err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const runExport = async (format) => {
    setExporting(format);
    try {
      await exportPage(exportRef.current, paper, format, name.trim() || 'layout');
    } catch (err) {
      toast.error(err?.message || 'The file could not be made.');
    } finally {
      setExporting(null);
    }
  };

  const title = layoutId ? 'Edit layout' : { create: 'New layout', clone: 'Copy layout' }[mode];
  const backLink = (
    <button type="button" onClick={() => confirmLeave(onBack)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
      <BackIcon className="w-4 h-4" /> Back to layouts
    </button>
  );

  if (step === 'setup') {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          {backLink}
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">Name the layout and choose its paper. You can change these later.</p>
        </div>
        <Card variant="outlined">
          <div className="space-y-6">
            <InputField
              label="Layout name"
              placeholder="e.g. Workshop slip"
              maxLength={NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              error={nameError}
              required
            />
            <PaperSetup
              paper={doc.paper}
              onPaperChange={changePaper}
              paperSizes={formData.paperSizes}
              labelDefault={labelDefault}
              onLabelDefaultChange={setLabelDefault}
            />
            <div className="flex justify-end">
              <Button onClick={() => checkName() && setStep('design')}>Start designing</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const exportItems = EXPORT_FORMATS.map((f) => ({ key: f.value, label: `Download ${f.label}`, onClick: () => runExport(f.value), disabled: exporting !== null }));

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {backLink}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="sr-only">{title}</h1>
            <div className="w-full max-w-xs">
              <InputField
                aria-label="Layout name"
                placeholder="Layout name"
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                error={nameError}
              />
            </div>
            <span className="text-sm text-gray-500">{describePaper(paper)} · {doc.elements.length} {doc.elements.length === 1 ? 'item' : 'items'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={history.undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)">Undo</Button>
          <Button variant="ghost" size="sm" onClick={history.redo} disabled={!history.canRedo} title="Redo (Ctrl+Y)">Redo</Button>
          <div className="w-24">
            <Dropdown size="sm" options={zoomOptions} value={zoomChoice} onChange={(value) => setZoomChoice(value)} aria-label="Zoom" />
          </div>
          <Menu align="right" width="w-48" trigger={<Button variant="outline" size="sm" loading={exporting !== null} loadingText="Exporting...">Export</Button>} items={exportItems} />
          <Button size="sm" onClick={save} loading={isSaving} loadingText="Saving...">{layoutId ? 'Save' : 'Create layout'}</Button>
        </div>
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}
      {outsideCount > 0 && (
        <Alert variant="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{outsideCount === 1 ? 'One item goes' : `${outsideCount} items go`} outside the page.</span>
            <Button size="xs" variant="outline" onClick={fitAllOnPage}>Move onto the page</Button>
          </div>
        </Alert>
      )}

      <div className={`grid gap-4 lg:h-[calc(100vh-12rem)] lg:min-h-[520px] ${gridColumns}`}>
        <SidePanel
          side="left"
          title="Items"
          ariaLabel="Items"
          isOpen={panels.items}
          onToggle={() => togglePanel('items')}
          className="rounded-xl border border-gray-200 bg-white p-3 lg:overflow-hidden max-lg:max-h-80 max-lg:overflow-y-auto"
        >
          <ElementPalette sources={formData} onAdd={(item) => addItem(item)} />
        </SidePanel>

        <div
          ref={areaRef}
          tabIndex={0}
          aria-label="Design area. Arrow keys move the selected item, Delete removes it."
          onPointerDownCapture={() => areaRef.current.focus({ preventScroll: true })}
          className="min-h-[420px] overflow-auto rounded-xl border border-gray-200 bg-gray-100 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <div className="mx-auto w-max">
            <DesignerCanvas
              paper={paper}
              elements={doc.elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBeginChange={history.beginDrag}
              onMove={(id, patch) => {
                forgetError(id);
                history.drag((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
              }}
              onDropItem={(item, x, y) => addItem(item, { x, y })}
              zoom={zoom}
              onZoomChange={(value) => setZoomChoice(String(Math.min(ZOOM_MAX, value)))}
              resolve={resolve}
              canFormatText={canFormatText}
              logoUrl={formData.company.logoUrl}
            />
          </div>
        </div>

        <SidePanel
          side="right"
          title="Settings"
          ariaLabel={selected ? 'Item settings' : 'Page settings'}
          isOpen={panels.settings}
          onToggle={() => togglePanel('settings')}
          className="rounded-xl border border-gray-200 bg-white p-4 lg:overflow-hidden"
        >
          {selected ? (
            <div className="space-y-3">
              {elementErrors[selected.id] && <Alert variant="error">{elementErrors[selected.id]}</Alert>}
              <PropertiesPanel
                key={selected.id}
                element={selected}
                paper={paper}
                sources={formData}
                resolve={resolve}
                canFormatText={canFormatText}
                onChange={changeSelected}
                onDuplicate={duplicateSelected}
                onDelete={removeSelected}
                onArrange={arrangeSelected}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Page</h2>
                <p className="text-xs text-gray-500">Click an item on the page to change it.</p>
              </div>
              {Object.keys(elementErrors).length > 0 && (
                <Alert variant="error">
                  <ul className="space-y-1">
                    {Object.entries(elementErrors).map(([id, message]) => {
                      const element = doc.elements.find((e) => e.id === id);
                      return element && (
                        <li key={id}>
                          <button type="button" className="text-left underline cursor-pointer" onClick={() => setSelectedId(id)}>{elementName(element, resolve)}</button>: {message}
                        </li>
                      );
                    })}
                  </ul>
                </Alert>
              )}
              <PaperSetup
                paper={doc.paper}
                onPaperChange={changePaper}
                paperSizes={formData.paperSizes}
                labelDefault={labelDefault}
                onLabelDefaultChange={setLabelDefault}
                isCompact
              />
              {!canFormatText && <p className="text-xs text-gray-500">Text formatting (font, size, bold...) is not part of your plan.</p>}
            </div>
          )}
        </SidePanel>
      </div>

      <div aria-hidden="true" style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
        <LayoutPage ref={exportRef} paper={paper} elements={doc.elements} resolve={resolve} canFormatText={canFormatText} logoUrl={formData.company.logoUrl} />
      </div>
    </div>
  );
};

/**
 * Creates, copies or edits a layout: first the paper (new layouts), then the
 * designer.
 *
 * @param {Object} props
 * @param {'create'|'clone'|'edit'} props.mode
 * @param {string} [props.layoutId]
 * @param {() => void} props.onBack
 */
const LayoutDesignerPage = ({ mode, layoutId, onBack }) => {
  const [loaded, setLoaded] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([layoutsApi.getFormData(), mode === 'create' ? null : layoutsApi.getLayout(layoutId)])
      .then(([formData, result]) => {
        if (cancelled) return;
        const saved = result?.layout || NEW_LAYOUT;
        const base = saved.name.slice(0, NAME_MAX_LENGTH - COPY_SUFFIX.length);
        const paper = saved.paper.size === CUSTOM_PAPER
          ? { size: CUSTOM_PAPER, orientation: 'portrait', widthMm: saved.paper.widthMm, heightMm: saved.paper.heightMm }
          : { size: saved.paper.size, orientation: saved.paper.orientation };
        setLoaded({
          formData,
          initial: {
            id: mode === 'edit' ? layoutId : null,
            name: mode === 'clone' ? `${base}${COPY_SUFFIX}` : saved.name,
            labelDefault: saved.labelDefault,
            paper,
            elements: saved.elements,
          },
        });
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => { cancelled = true; };
  }, [mode, layoutId]);

  if (loadError) {
    return (
      <div className="max-w-3xl space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 cursor-pointer">
          <BackIcon className="w-4 h-4" /> Back to layouts
        </button>
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!loaded) return <div className="py-24 flex justify-center"><Spinner size="lg" /></div>;
  return <Designer mode={mode} initial={loaded.initial} formData={loaded.formData} onBack={onBack} />;
};

export default LayoutDesignerPage;
