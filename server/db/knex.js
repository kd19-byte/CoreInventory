import knexFactory from 'knex'

const knex = knexFactory({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_system',
  },
  pool: {
    min: 2,
    max: Number(process.env.DB_POOL_SIZE || 10),
  },
})

export default knex
