import Modal from '../Modal';
import Button from '../Buttons';

/**
 * Asks the user to confirm an action (e.g. a delete) before it runs.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {string} props.title
 * @param {React.ReactNode} props.message - What will happen, in plain words
 * @param {string} [props.confirmLabel] - Text of the confirm button (default 'Confirm')
 * @param {string} [props.cancelLabel] - Text of the cancel button (default 'Cancel')
 * @param {string} [props.variant] - Confirm button variant (default 'danger')
 * @param {boolean} [props.loading] - Shows the confirm button as busy and blocks closing
 * @param {Function} props.onConfirm
 * @param {Function} props.onCancel
 */
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={loading ? undefined : onCancel}
    title={title}
    size="sm"
    closeOnOverlayClick={!loading}
    closeOnEsc={!loading}
    showCloseButton={!loading}
    footer={
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button variant={variant} onClick={onConfirm} loading={loading} loadingText="Please wait...">{confirmLabel}</Button>
      </div>
    }
  >
    <div className="text-sm text-gray-600">{message}</div>
  </Modal>
);

export default ConfirmDialog;
