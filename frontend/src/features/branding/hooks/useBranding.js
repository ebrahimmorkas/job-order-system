import { useContext } from 'react';
import { BrandingContext } from '../context/BrandingContext';

/**
 * Hook to read the vendor's branding from anywhere below <BrandingProvider>.
 *
 * Usage:
 *   const { branding, isLoading, error, retry } = useBranding();
 *   // branding: { companyName, loginTagline, logoUrl } - any of them may be null
 */
export const useBranding = () => {
  const ctx = useContext(BrandingContext);

  if (!ctx) {
    throw new Error('useBranding must be used within a <BrandingProvider>');
  }

  return ctx;
};

export default useBranding;
