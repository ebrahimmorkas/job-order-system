import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandingContext } from './BrandingContext';
import * as brandingApi from '../api/brandingApi';

/**
 * Loads the vendor's branding (company name, login tagline, logo) once per
 * page load - every screen reads it from here instead of fetching again.
 * Also uses it for the browser tab: the company name as the title and the
 * logo as the icon.
 */
const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState(null);
  const [error, setError] = useState(null);
  // Bumped by retry() to run the fetch again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    brandingApi
      .getBranding({ signal: controller.signal })
      .then((data) => setBranding(data.branding))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(err);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!branding) return;
    if (branding.companyName) document.title = branding.companyName;
    if (branding.logoUrl) {
      const icon = document.querySelector("link[rel='icon']");
      if (icon) {
        // The default icon is an SVG; the logo can be any image type.
        icon.removeAttribute('type');
        icon.href = branding.logoUrl;
      }
    }
  }, [branding]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  // After Company Settings saves the name / tagline / logo, so the sidebar
  // and the browser tab show it at once.
  const updateBranding = useCallback((changes) => {
    setBranding((prev) => ({ ...prev, ...changes }));
  }, []);

  const value = useMemo(
    () => ({ branding, isLoading: !branding && !error, error, retry, updateBranding }),
    [branding, error, retry, updateBranding]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export default BrandingProvider;
