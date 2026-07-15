import mysql, { type Pool } from 'mysql2/promise'

let appPool: Pool | null = null
let financialPool: Pool | null = null

const required = (value: unknown, name: string) => {
  const clean = String(value || '').trim()
  if (!clean) throw createError({ statusCode: 503, message: `${name} no está configurado.` })
  return clean
}

export const appDb = () => {
  if (!appPool) {
    const config = useRuntimeConfig()
    appPool = mysql.createPool({
      host: required(config.appMysqlHost, 'APP_MYSQL_HOST'),
      port: Number(config.appMysqlPort || 3306),
      user: required(config.appMysqlUser, 'APP_MYSQL_USER'),
      password: String(config.appMysqlPassword || ''),
      database: required(config.appMysqlDatabase, 'APP_MYSQL_DATABASE'),
      waitForConnections: true,
      connectionLimit: 8,
      queueLimit: 0,
      charset: 'utf8mb4'
    })
  }
  return appPool
}

export const financialDb = () => {
  if (!financialPool) {
    const config = useRuntimeConfig()
    financialPool = mysql.createPool({
      host: required(config.financialMysqlHost, 'FINANCIAL_MYSQL_HOST'),
      port: Number(config.financialMysqlPort || 3306),
      user: required(config.financialMysqlUser, 'FINANCIAL_MYSQL_USER'),
      password: String(config.financialMysqlPassword || ''),
      database: required(config.financialMysqlDatabase, 'FINANCIAL_MYSQL_DATABASE'),
      waitForConnections: true,
      connectionLimit: 6,
      queueLimit: 0,
      charset: 'utf8mb4'
    })
  }
  return financialPool
}

export const appQuery = async <T>(sql: string, params: unknown[] = []) => {
  const [rows] = await appDb().query(sql, params)
  return rows as T
}

export const financialQuery = async <T>(sql: string, params: unknown[] = []) => {
  const [rows] = await financialDb().query(sql, params)
  return rows as T
}
