/**
 * The one layout every error screen uses: an icon, a short code, a heading,
 * a line of explanation and up to two buttons. Anything extra (e.g. the
 * error reference on the 500 screen) goes in `children`, under the buttons.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.code] - e.g. "404"
 * @param {React.ReactNode} props.title
 * @param {string} [props.description]
 * @param {{ label: string, onClick: () => void }} [props.primaryAction]
 * @param {{ label: string, onClick: () => void }} [props.secondaryAction]
 * @param {string} [props.titleId] - id for the heading, for aria-labelledby.
 * @param {React.ReactNode} [props.children]
 */
const ErrorPage = ({ icon, code, title, description, primaryAction, secondaryAction, titleId, children }) => (
  <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-16">
    <div className="w-full max-w-lg rounded-2xl bg-white p-8 sm:p-10 text-center shadow-sm ring-1 ring-slate-200">
      {icon && (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <div className="h-8 w-8">{icon}</div>
        </div>
      )}
      {code && <p className="mb-2 text-sm font-semibold tracking-widest text-indigo-600">{code}</p>}
      <h1 id={titleId} className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
      {description && <p className="mt-3 text-slate-600">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 cursor-pointer"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  </main>
);

export default ErrorPage;
