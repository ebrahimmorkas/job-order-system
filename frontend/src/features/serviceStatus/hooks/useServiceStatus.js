import { useContext } from 'react';
import { ServiceStatusContext } from '../context/ServiceStatusContext';

/**
 * Whether the app is open: { block, shop, isLoading, refresh, setShop }.
 * block null = open; otherwise what to show (maintenance, payment,
 * unavailable, shop closed).
 */
export const useServiceStatus = () => {
  const ctx = useContext(ServiceStatusContext);
  if (!ctx) throw new Error('useServiceStatus must be used within a <ServiceStatusProvider>');
  return ctx;
};

export default useServiceStatus;
