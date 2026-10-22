import { useEffect, useState } from 'react';
import Alert from '../../../components/common/Alert';
import Badge from '../../../components/common/Badge';
import Spinner from '../../../components/common/Spinner';
import CountryTaxForm from './CountryTaxForm';
import * as companySettingsApi from '../api/companySettingsApi';

/**
 * Company Settings > Tax: one form per country assigned to the vendor. With
 * several countries, each has its own tab, marked whether tax can be charged
 * there. Every country form stays mounted, so switching never loses edits.
 *
 * @param {Object} props
 * @param {(key: string, isDirty: boolean) => void} props.onDirtyChange
 */
const TaxSettingsTab = ({ onDirtyChange }) => {
  const [countries, setCountries] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    companySettingsApi
      .getTaxSettings({ signal: controller.signal })
      .then((data) => {
        setCountries(data.countries);
        setActiveId(data.countries[0]?._id ?? null);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setLoadError(err.message);
      });
    return () => controller.abort();
  }, []);

  const handleSaved = (countryId, { isTaxReady }) => {
    setCountries((prev) => prev.map((c) => (c._id === countryId ? { ...c, isTaxReady } : c)));
  };

  if (loadError) return <Alert variant="error">{loadError}</Alert>;
  if (!countries) return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>;
  if (countries.length === 0) return <Alert variant="info">No countries are available for your account yet.</Alert>;

  const readyCount = countries.filter((c) => c.isTaxReady).length;

  return (
    <div className="space-y-6">
      <Alert variant={readyCount > 0 ? 'info' : 'warning'}>
        {countries.length === 1
          ? (readyCount > 0
            ? `Tax is charged on job orders for ${countries[0].name}.`
            : `No tax is charged on job orders until you are registered for ${countries[0].taxName} in ${countries[0].name} below.`)
          : `Fill in each country you bill in. A job order for a country you are not registered in is made without tax.`}
      </Alert>

      {countries.length > 1 && (
        <div role="tablist" aria-label="Countries" className="flex flex-wrap gap-2">
          {countries.map((country) => {
            const isActive = country._id === activeId;
            return (
              <button
                key={country._id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(country._id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${isActive ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
              >
                {country.name}
                <Badge variant={country.isTaxReady ? 'green' : 'yellow'} size="sm">{country.isTaxReady ? 'Tax ready' : 'Not filled'}</Badge>
              </button>
            );
          })}
        </div>
      )}

      {countries.map((country) => (
        <div key={country._id} hidden={country._id !== activeId}>
          <CountryTaxForm country={country} onSaved={handleSaved} onDirtyChange={onDirtyChange} />
        </div>
      ))}
    </div>
  );
};

export default TaxSettingsTab;
