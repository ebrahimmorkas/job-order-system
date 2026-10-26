import { formatMoney } from '../jobOrderTotals';

/**
 * The summary under a job order: every master and control filled in (item
 * after item, each under its heading when there are several), then
 * the prices, subtotal, discount, tax (with its split), round off, total,
 * advance and balance due. Used by the form
 * (live, as the owner types) and by the saved job order's view.
 *
 * @param {Object} props
 * @param {Array<{ key: string, label?: string, heading?: string, value?: string, isPrice?: boolean, amount?: number, isTaxed?: boolean }>} props.rows
 * @param {Object|null} props.currency - { code, symbol, decimalPlaces }
 * @param {number} props.subtotal
 * @param {{ isApplied, reason, name, components: Array<{ label, rate, amount }>, taxableAmount, amount }} props.tax
 * @param {number} props.total
 * @param {{ type: 'amount'|'percent', value: number, amount: number }|null} [props.discount]
 * @param {number} [props.roundOff]
 * @param {number|null} [props.advance]
 * @param {number|null} [props.balance]
 * @param {boolean} [props.showAmounts] - false: the details only (My work shows no money)
 */
const JobOrderSummary = ({ rows, currency, subtotal, tax, total, discount = null, roundOff = 0, advance = null, balance = null, showAmounts = true }) => {
  const money = (amount) => formatMoney(amount, currency);
  // "+ 0.40" / "- 0.40"
  const signed = (amount) => `${amount < 0 ? '-' : '+'} ${money(Math.abs(amount))}`;
  const details = rows.filter((row) => !row.isPrice);
  const prices = rows.filter((row) => row.isPrice);

  return (
    <div className="space-y-4">
      {details.length > 0 ? (
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {details.map((row) => (row.heading ? (
            <div key={row.key} className="bg-gray-50 px-4 py-2 first:rounded-t-lg">
              <dt className="text-sm font-semibold text-gray-800 break-words">{row.heading}</dt>
            </div>
          ) : (
            <div key={row.key} className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm text-gray-500 break-words">{row.label}</dt>
              <dd className="text-sm text-gray-900 break-words sm:col-span-2 whitespace-pre-line">{row.value}</dd>
            </div>
          )))}
        </dl>
      ) : (
        <p className="text-sm text-gray-400">Nothing filled in yet.</p>
      )}

      {showAmounts && (<>
      <table className="w-full text-sm" aria-label="Amounts">
        <tbody className="divide-y divide-gray-100">
          {prices.map((row) => (
            <tr key={row.key}>
              <td className="py-2 pr-3 text-gray-700 break-words">
                {row.label}
                {tax.isApplied && row.isTaxed && <span className="ml-2 text-xs text-gray-400">taxed</span>}
              </td>
              <td className="py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">{money(row.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 pr-3 font-medium text-gray-900">Subtotal</td>
            <td className="py-2 text-right font-medium text-gray-900 tabular-nums whitespace-nowrap">{money(subtotal)}</td>
          </tr>
          {discount?.amount > 0 && (
            <tr>
              <td className="py-2 pr-3 text-gray-700">Discount{discount.type === 'percent' && ` ${discount.value}%`}</td>
              <td className="py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">- {money(discount.amount)}</td>
            </tr>
          )}
          {tax.isApplied && (tax.components.length > 0 ? tax.components : [{ label: tax.name, rate: null, amount: tax.amount }]).map((component) => (
            <tr key={component.label}>
              <td className="py-2 pr-3 text-gray-700">
                {component.label}{component.rate !== null && ` ${component.rate}%`}
                <span className="ml-2 text-xs text-gray-400">on {money(tax.taxableAmount)}</span>
              </td>
              <td className="py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">{money(component.amount)}</td>
            </tr>
          ))}
          {roundOff !== 0 && roundOff !== null && roundOff !== undefined && (
            <tr>
              <td className="py-2 pr-3 text-gray-700">Round off</td>
              <td className="py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">{signed(roundOff)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-gray-200">
            <td className="py-2.5 pr-3 text-base font-semibold text-gray-900">Total</td>
            <td className="py-2.5 text-right text-base font-semibold text-gray-900 tabular-nums whitespace-nowrap">{money(total)}</td>
          </tr>
          {advance !== null && advance !== undefined && (<>
            <tr>
              <td className="py-2 pr-3 text-gray-700">Advance received</td>
              <td className="py-2 text-right text-gray-900 tabular-nums whitespace-nowrap">- {money(advance)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-semibold text-indigo-700">Balance due</td>
              <td className="py-2 text-right font-semibold text-indigo-700 tabular-nums whitespace-nowrap">{money(balance ?? total - advance)}</td>
            </tr>
          </>)}
        </tbody>
      </table>
      {!tax.isApplied && tax.reason && <p className="text-xs text-amber-700" role="note">{tax.reason}</p>}
      </>)}
    </div>
  );
};

export default JobOrderSummary;
