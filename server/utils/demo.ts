const names = [
  'Sofía Hernández López', 'Mateo García Ruiz', 'Valentina Torres Díaz', 'Santiago Martínez Cruz',
  'Regina Flores Vega', 'Emiliano Sánchez Lara', 'Camila Romero Ortiz', 'Leonardo Castillo Mora',
  'Renata Jiménez Soto', 'Sebastián Mendoza Gil', 'Victoria Navarro León', 'Diego Rojas Luna',
  'Mariana Campos Rey', 'Nicolás Vega Solís', 'Ximena Paredes Cano', 'Andrés Salazar Núñez'
]
const planteles = ['CT', 'PT', 'ST', 'PREEM', 'PREET', 'CM', 'DM', 'CO', 'DC', 'GM', 'PM', 'SM', 'IS', 'ISM']
const concepts = [986, 987, 988]

const fakeCurp = (index: number) => {
  const year = 11 + (index % 11)
  const month = String((index % 9) + 1).padStart(2, '0')
  const day = String((index % 23) + 1).padStart(2, '0')
  return `HELS${String(year).padStart(2, '0')}${month}${day}MDFRPF0${index % 10}`.slice(0, 18)
}

export const demoStudents = () => Array.from({ length: 56 }, (_, index) => ({
  matricula: `SC26${String(index + 1).padStart(4, '0')}`,
  nombreCompleto: names[index % names.length],
  plantel: planteles[index % planteles.length],
  curp: index % 8 === 0 ? '' : fakeCurp(index),
  conceptId: concepts[index % concepts.length],
  photoAvailable: index % 3 !== 0,
  source: 'demo' as const
}))
