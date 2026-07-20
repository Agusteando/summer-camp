import { SERVICE_FILTERS } from '~/shared/catalog'
import type { ServiceView, SummerStudent } from '~/types/summer'

const VALID_SERVICES = new Set<ServiceView>(['all', ...SERVICE_FILTERS.map((service) => service.key)])

export const useServiceView = () => {
  const activeService = useState<ServiceView>('summer-service-view-v1', () => 'all')

  const setService = (service: ServiceView) => {
    if (!VALID_SERVICES.has(service)) return
    activeService.value = service
  }

  const reset = () => {
    activeService.value = 'all'
  }

  const matches = (student: SummerStudent) => {
    const service = activeService.value
    return service === 'all' || student.services[service]
  }

  const reconcile = (students: SummerStudent[]) => {
    const service = activeService.value
    if (service === 'all') return
    if (!students.some((student) => student.services[service])) reset()
  }

  return { activeService, setService, reset, matches, reconcile }
}
