import { useState } from 'react';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Buttons';
import Alert from '../../../components/common/Alert';
import { useAuth } from '../hooks/useAuth';
import { useBranding } from '../../branding/hooks/useBranding';

// Same limits as the backend's login validation (authValidations.js).
const IDENTIFIER_MAX_LENGTH = 254;
const PASSWORD_MAX_LENGTH = 128;

const EyeIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.04 12.32a1 1 0 010-.64C3.42 7.51 7.36 4.5 12 4.5c4.64 0 8.57 3 9.96 7.18a1 1 0 010 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3-9.96-7.18z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeOffIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.22A10.48 10.48 0 002.04 12.3c1.38 4.18 5.32 7.2 9.96 7.2 1.66 0 3.24-.39 4.63-1.07M6.23 6.23A10.45 10.45 0 0112 4.5c4.64 0 8.57 3 9.96 7.18.07.21.07.43 0 .64a10.52 10.52 0 01-4.29 5.45M6.23 6.23L3 3m3.23 3.23l3.65 3.65m7.89 7.89L21 21m-3.23-3.23l-3.65-3.65m0 0a3 3 0 10-4.24-4.24m4.24 4.24L9.88 9.88" />
  </svg>
);

// The company logo, or the first letter of the name when there is no logo
// (letterClassName styles only the letter). Decorative - the name is always
// shown next to it.
const BrandLogo = ({ companyName, logoUrl, className = '', letterClassName = '' }) => {
  if (logoUrl) return <img src={logoUrl} alt="" className={`object-contain ${className}`} />;
  if (!companyName) return null;
  return (
    <div className={`flex items-center justify-center rounded-2xl font-bold ${className} ${letterClassName}`}>
      {companyName[0].toUpperCase()}
    </div>
  );
};

/**
 * The login screen. Everything about the company on it (name, tagline,
 * logo) comes from the vendor's CompanySettings via useBranding.
 */
const LoginPage = () => {
  const { login, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const { branding } = useBranding();
  const { companyName, loginTagline, logoUrl } = branding;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIdentifierChange = (e) => {
    setIdentifier(e.target.value);
    if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: '' }));
    if (formError) setFormError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedIdentifier = identifier.trim();
    const errors = {};
    if (!trimmedIdentifier) errors.identifier = 'Enter your username, email or phone number';
    if (!password) errors.password = 'Enter your password';
    setFieldErrors(errors);
    if (errors.identifier || errors.password) return;

    setFormError('');
    clearSessionExpiredMessage();
    setIsSubmitting(true);
    const result = await login(trimmedIdentifier, password);
    // On success AuthProvider sets the user and this page is replaced.
    if (!result.success) {
      // The server's own message: wrong details, account inactive, or too
      // many attempts (with how long to wait).
      setFormError(result.message);
      setPassword('');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Brand panel - large screens only */}
      <aside className="hidden lg:flex lg:w-1/2 xl:w-5/12 flex-col justify-center gap-10 bg-linear-to-br from-indigo-600 via-indigo-700 to-indigo-900 px-14 py-12 text-white">
        <div className="flex items-center gap-4">
          {(logoUrl || companyName) && (
            <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-lg shrink-0 flex items-center justify-center">
              <BrandLogo companyName={companyName} logoUrl={logoUrl} className="w-full h-full" letterClassName="text-2xl text-indigo-700" />
            </div>
          )}
          {companyName && <p className="text-2xl font-bold leading-tight break-words">{companyName}</p>}
        </div>
        {loginTagline && (
          <p className="text-3xl xl:text-4xl font-semibold leading-snug text-indigo-50 max-w-lg break-words">{loginTagline}</p>
        )}
      </aside>

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          {/* Brand header - small screens only (the side panel shows it on large screens) */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <BrandLogo companyName={companyName} logoUrl={logoUrl} className="w-16 h-16 mb-3" letterClassName="text-2xl bg-indigo-600 text-white" />
            {companyName && <p className="text-xl font-bold text-gray-900 break-words">{companyName}</p>}
            {loginTagline && <p className="mt-1 text-sm text-gray-500 break-words">{loginTagline}</p>}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
            <p className="mt-1 text-sm text-gray-500">Enter your details to continue.</p>

            {(formError || sessionExpiredMessage) && (
              <Alert variant={formError ? 'error' : 'warning'} className="mt-5">
                {formError || sessionExpiredMessage}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <InputField
                label="Username, email or phone"
                name="identifier"
                value={identifier}
                onChange={handleIdentifierChange}
                error={fieldErrors.identifier}
                maxLength={IDENTIFIER_MAX_LENGTH}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                disabled={isSubmitting}
              />

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <InputField
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={handlePasswordChange}
                    error={fieldErrors.password}
                    maxLength={PASSWORD_MAX_LENGTH}
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className="pr-11"
                  />
                  {/* Sits over the input's right edge; top-aligned so a field error below doesn't move it. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-[42px] w-11 flex items-center justify-center rounded-r-lg text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:text-indigo-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" fullWidth loading={isSubmitting} loadingText="Signing in...">
                Sign in
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
