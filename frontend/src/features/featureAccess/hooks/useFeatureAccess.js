import { useEffect, useState } from 'react';
import * as featureAccessApi from '../api/featureAccessApi';

/**
 * The vendor's feature switches, fetched once by the logged-in layout.
 * null while loading or if the request failed - callers then show
 * everything (the backend refuses a switched-off feature anyway).
 *
 * @returns {Object<string, boolean>|null} e.g. { isMasterModuleFeatureOn: true }
 */
export const useFeatureAccess = () => {
  const [featureAccess, setFeatureAccess] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    featureAccessApi
      .getFeatureAccess({ signal: controller.signal })
      .then((data) => setFeatureAccess(data.featureAccess))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return featureAccess;
};

export default useFeatureAccess;
