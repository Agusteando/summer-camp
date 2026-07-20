import { programLabel } from '~/shared/catalog'
import type { CampusName, ProgramScope, SummerStudent } from '~/types/summer'

type ExportOptions = {
  students: SummerStudent[]
  campus: CampusName
  program: ProgramScope
  date?: string
  includeAttendance?: boolean
}

const attendanceLabel = (status: SummerStudent['attendance']) => ({
  present: 'Presente',
  absent: 'Ausente',
  unmarked: 'Sin marcar'
})[status]

const safeFilename = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

export const useExcelExport = () => {
  const exporting = ref(false)
  const error = ref('')

  const exportStudents = async (options: ExportOptions) => {
    if (!import.meta.client || !options.students.length || exporting.value) return
    exporting.value = true
    error.value = ''
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()
      const present = options.students.filter((student) => student.attendance === 'present').length
      const absent = options.students.filter((student) => student.attendance === 'absent').length
      const unmarked = options.students.filter((student) => student.attendance === 'unmarked').length
      const summaryRows = [
        ['Campus', options.campus],
        ['Modalidad', programLabel(options.program)],
        ...(options.date ? [['Fecha', options.date]] : []),
        ['Total de alumnos', options.students.length],
        ...(options.includeAttendance ? [
          ['Presentes', present],
          ['Ausentes', absent],
          ['Sin marcar', unmarked]
        ] : [])
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
      summarySheet['!cols'] = [{ wch: 22 }, { wch: 28 }]
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')

      const rows = options.students.map((student, index) => ({
        'No.': index + 1,
        'Nombre': student.name,
        'Folio': student.folio,
        'Edad': student.age ?? '',
        'Campus': student.campus,
        'Plantel': student.plantel,
        'Plantel completo': student.plantelLabel,
        'Modalidad': programLabel(student.program),
        ...(options.includeAttendance ? { 'Asistencia': attendanceLabel(student.attendance) } : {}),
        'Entrada': student.schedule.entry,
        'Salida': student.schedule.exit,
        'Desayuno': student.services.breakfast ? 'Sí' : 'No',
        'Comida': student.services.lunch ? 'Sí' : 'No',
        'Cena': student.services.dinner ? 'Sí' : 'No',
        'Servicio extra': student.services.extendedTime ? 'Sí' : 'No',
        'Contacto principal': student.contacts.primary.name,
        'Parentesco': student.contacts.primary.relation,
        'Teléfono principal': student.contacts.primary.phone,
        'Contacto alterno': student.contacts.alternate.name,
        'Parentesco alterno': student.contacts.alternate.relation,
        'Teléfono alterno': student.contacts.alternate.phone,
        'Alergias / notas médicas': student.allergies,
        'Observaciones': student.observations
      }))
      const studentsSheet = XLSX.utils.json_to_sheet(rows)
      studentsSheet['!autofilter'] = { ref: studentsSheet['!ref'] || 'A1:A1' }
      studentsSheet['!freeze'] = { xSplit: 0, ySplit: 1 }
      studentsSheet['!cols'] = [
        { wch: 6 }, { wch: 34 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 22 },
        ...(options.includeAttendance ? [{ wch: 14 }] : []),
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 32 }, { wch: 40 }
      ]
      XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Alumnos')

      const suffix = options.includeAttendance && options.date ? `-${options.date}` : ''
      const filename = `summer-camp-${safeFilename(options.campus)}-${safeFilename(programLabel(options.program))}${suffix}.xlsx`
      XLSX.writeFile(workbook, filename, { compression: true })
      return true
    } catch (cause: any) {
      error.value = cause?.message || 'No se pudo generar el archivo de Excel.'
      return false
    } finally {
      exporting.value = false
    }
  }

  return { exporting, error, exportStudents }
}
