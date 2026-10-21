import { useEffect, useRef, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Switch from '../../../components/common/Switch';
import Button from '../../../components/common/Buttons';
import Alert from '../../../components/common/Alert';
import Spinner from '../../../components/common/Spinner';
import { useToast } from '../../../components/common/Toast';
import IconButton from './IconButton';
import { TrashIcon, MoveUpIcon, MoveDownIcon } from './icons';
import * as mastersApi from '../api/mastersApi';

/**
 * A master's values in a popup (opened from the values count on the list).
 * Moving a value, marking it active / inactive or deleting it is saved straight away.
 *
 * @param {Object} props
 * @param {{ _id: string, name: string }} props.master
 * @param {(hasChanged: boolean) => void} props.onClose - hasChanged: reload the list
 */
const MasterValuesModal = ({ master, onClose }) => {
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const hasChanged = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mastersApi
      .getMaster(master._id)
      .then((result) => !cancelled && setValues(result.master.values))
      .catch((err) => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [master._id]);

  // Runs one request with that row marked busy; toasts its result.
  const run = async (valueId, request, successMessage) => {
    setBusyId(valueId);
    try {
      await request();
      hasChanged.current = true;
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (value) => {
    const isActive = value.status !== 'A';
    const isDone = await run(value._id, () => mastersApi.setValueStatus(master._id, value._id, isActive),
      `"${value.name}" marked as ${isActive ? 'active' : 'inactive'}.`);
    if (isDone) setValues((prev) => prev.map((v) => (v._id === value._id ? { ...v, status: isActive ? 'A' : 'I' } : v)));
  };

  const move = async (index, direction) => {
    const value = values[index];
    const isDone = await run(value._id, () => mastersApi.moveValue(master._id, value._id, direction),
      `"${value.name}" moved ${direction}.`);
    if (!isDone) return;
    const other = index + (direction === 'up' ? -1 : 1);
    setValues((prev) => {
      const next = [...prev];
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  };

  const remove = async (value) => {
    const isDone = await run(value._id, () => mastersApi.deleteValue(master._id, value._id), `"${value.name}" deleted.`);
    setConfirmId(null);
    if (isDone) setValues((prev) => prev.filter((v) => v._id !== value._id));
  };

  return (
    <Modal isOpen onClose={() => onClose(hasChanged.current)} title={`${master.name} - values`} size="lg">
      {error && <Alert variant="error">{error}</Alert>}
      {!values && !error && <div className="py-10 flex justify-center"><Spinner /></div>}
      {values && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 max-h-[60vh] overflow-y-auto">
          {values.map((value, index) => {
            const isActive = value.status === 'A';
            const isBusy = busyId === value._id;
            return (
              <li key={value._id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 shrink-0 text-xs text-gray-400 text-right">{index + 1}</span>
                <div className="flex shrink-0">
                  <IconButton label={`Move "${value.name}" up`} icon={MoveUpIcon} size="sm" onClick={() => move(index, 'up')} disabled={busyId !== null || index === 0} />
                  <IconButton label={`Move "${value.name}" down`} icon={MoveDownIcon} size="sm" onClick={() => move(index, 'down')} disabled={busyId !== null || index === values.length - 1} />
                </div>
                <p className={`flex-1 min-w-0 text-sm break-words ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{value.name}</p>
                {confirmId === value._id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="hidden sm:inline text-xs text-gray-600 mr-1">Delete?</span>
                    <Button size="sm" variant="danger" onClick={() => remove(value)} loading={isBusy}>Delete</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} disabled={isBusy}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      size="sm"
                      checked={isActive}
                      onChange={() => toggle(value)}
                      disabled={busyId !== null}
                      aria-label={`"${value.name}" ${isActive ? 'is active' : 'is inactive'}`}
                    />
                    <span className="w-14 text-xs text-gray-500">{isActive ? 'Active' : 'Inactive'}</span>
                    <IconButton label={`Delete "${value.name}"`} icon={TrashIcon} variant="danger" onClick={() => setConfirmId(value._id)} disabled={busyId !== null} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

export default MasterValuesModal;
