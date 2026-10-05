import { useMemo, useState } from 'react'
import type { DashboardFilters } from '@/types/api'
import { normalizeDashboardFilters } from '@/lib/dashboardFilters'

type Period = Pick<DashboardFilters, 'periodFrom' | 'periodTo'>

function invalidPeriod(filters: Period): boolean {
  return Boolean(filters.periodFrom && filters.periodTo && filters.periodFrom > filters.periodTo)
}

function groupCount(filters: DashboardFilters): number {
  return [filters.companyIds, filters.industries, filters.health, filters.performanceStatus]
    .filter(values => values?.length).length + Number(Boolean(filters.periodFrom || filters.periodTo))
}

export function useDashboardFilters() {
  // Only dates need a last-valid draft boundary; every analytics query receives
  // the same appliedFilters derived from this single UI state.
  const [state, setState] = useState<{ filters: DashboardFilters; validPeriod: Period }>({
    filters: {}, validPeriod: {},
  })
  const appliedFilters = useMemo(() => normalizeDashboardFilters({
    ...state.filters,
    periodFrom: state.validPeriod.periodFrom,
    periodTo: state.validPeriod.periodTo,
  }), [state])

  const updateFilters = (next: DashboardFilters) => {
    const filters = normalizeDashboardFilters(next)
    setState(previous => ({
      filters,
      validPeriod: invalidPeriod(filters) ? previous.validPeriod : {
        periodFrom: filters.periodFrom, periodTo: filters.periodTo,
      },
    }))
  }

  return {
    filters: state.filters,
    appliedFilters,
    invalidRange: invalidPeriod(state.filters),
    activeGroups: groupCount(appliedFilters),
    canReset: groupCount(state.filters) > 0,
    updateFilters,
    resetFilters: () => setState({ filters: {}, validPeriod: {} }),
  }
}
