// "2 / 10 used" with a small bar - how much of a limit is used. Amber once
// the limit is reached.
const UsagePill = ({ used, allowed, label = 'used', title }) => {
  const isFull = used >= allowed;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${isFull ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600'}`}
      title={title}
    >
      <span>{used} / {allowed} {label}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
        <span
          className={`block h-full rounded-full ${isFull ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${Math.min(100, (used / Math.max(1, allowed)) * 100)}%` }}
        />
      </span>
    </div>
  );
};

export default UsagePill;
