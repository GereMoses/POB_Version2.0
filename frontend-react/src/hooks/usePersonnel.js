import { useQuery } from '@tanstack/react-query';
import apiService from '../services/api';

/**
 * Shared hook for fetching the active personnel roster.
 * All modules that need an employee picker should use this
 * instead of making their own independent API calls.
 *
 * Returns:
 *   personnel  — raw array of personnel objects
 *   isLoading  — boolean
 *   empOptions — [{value: id, label: "EMP001 John Doe"}] for Ant Design <Select>
 *   getById    — (id) => personnel object or undefined
 */
const usePersonnel = ({ status = null, pageSize = 500 } = {}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['personnel-roster', status, pageSize],
    queryFn: () => {
      const p = new URLSearchParams({ page_size: String(pageSize) });
      if (status) p.append('status', status);
      return apiService.get(`/api/v1/personnel/?${p}`);
    },
    staleTime: 5 * 60 * 1000,   // treat fresh for 5 min — roster rarely changes mid-session
    refetchOnWindowFocus: false,
  });

  const personnel = data?.data?.results ?? data?.data ?? data?.results ?? [];

  const empOptions = personnel.map(p => ({
    value: p.id,
    label: `${p.emp_code ?? ''} ${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
  }));

  const getById = (id) => personnel.find(p => p.id === id);

  return { personnel, isLoading, empOptions, getById };
};

export default usePersonnel;
