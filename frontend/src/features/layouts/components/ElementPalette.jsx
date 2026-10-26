import { useState } from 'react';
import SearchInput from '../../../components/common/SearchInput';
import { ITEM_FIELD_KEYS, PALETTE_DRAG_TYPE } from '../layoutConstants';

const SHAPES = [
  { kind: 'text', label: 'Text', hint: 'Words you type' },
  { kind: 'line', label: 'Line' },
  { kind: 'rectangle', label: 'Rectangle' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'table', label: 'Table', hint: 'Text or fields in cells' },
  { kind: 'logo', label: 'Company logo' },
];
const JOB_ORDER_IMAGE = { kind: 'image', label: 'Job order image', hint: 'An image added to the job order: Image 1, Image 2...' };
// Turn on the header / footer band (click only).
const BANDS = [
  { kind: 'header', label: 'Header', hint: 'A band at the top: what you put in it prints on every page', isBand: true },
  { kind: 'footer', label: 'Footer', hint: 'A band at the bottom: what you put in it prints on every page', isBand: true },
];

/**
 * What can go on the page, in groups: the header / footer, job order fields,
 * each item's own fields, masters and controls (active ones), shapes. Drag an
 * item onto the page, or click it to add it.
 *
 * @param {Object} props
 * @param {{ masters, controls, systemFields, settings }} props.sources
 * @param {(item: { kind, field?, label }) => void} props.onAdd - kind 'header' / 'footer': turn that band on
 */
const ElementPalette = ({ sources, onAdd }) => {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const fieldOf = (f) => ({ kind: 'field', field: { source: 'system', key: f.key }, label: f.label });
  const groups = [
    { title: 'Page', items: BANDS },
    { title: 'Job order', items: sources.systemFields.filter((f) => !ITEM_FIELD_KEYS.includes(f.key)).map(fieldOf) },
    { title: 'Item', items: sources.systemFields.filter((f) => ITEM_FIELD_KEYS.includes(f.key)).map((f) => ({ ...fieldOf(f), hint: 'Best in a table row repeated for each item' })) },
    { title: 'Masters', items: sources.masters.filter((m) => m.status === 'A').map((m) => ({ kind: 'field', field: { source: 'master', refId: m._id }, label: m.name })) },
    { title: 'Controls', items: sources.controls.filter((c) => c.status === 'A').map((c) => ({ kind: 'field', field: { source: 'control', refId: c._id }, label: c.label })) },
    { title: 'Shapes & more', items: sources.settings?.canPlaceJobOrderImages ? [...SHAPES, JOB_ORDER_IMAGE] : SHAPES },
  ]
    .map((group) => ({ ...group, items: query ? group.items.filter((item) => item.label.toLowerCase().includes(query)) : group.items }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <SearchInput value={search} onChange={setSearch} placeholder="Search items" ariaLabel="Search items" className="!mb-3" />
      <p className="mb-3 text-xs text-gray-500">Drag onto the page, or click to add.</p>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="text-sm text-gray-500">Nothing matches.</p>}
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={`${item.kind}-${item.field?.key || item.field?.refId || item.label}`}>
                  <button
                    type="button"
                    draggable={!item.isBand}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PALETTE_DRAG_TYPE, JSON.stringify(item));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAdd(item)}
                    aria-label={item.isBand ? `Turn on the ${item.label.toLowerCase()}` : `Add ${item.label}`}
                    title={item.hint || `Add ${item.label}`}
                    className="w-full cursor-pointer rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:cursor-grabbing break-words"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default ElementPalette;
