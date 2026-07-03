import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { ok } from './utils/http.js'
import { authenticateToken } from './middleware/auth.js'
import errorHandler from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import productsRoutes from './routes/products.js'
import warehousesRoutes from './routes/warehouses.js'
import operationsRoutes from './routes/operations.js'
import dashboardRoutes from './routes/dashboard.js'
import stacksRoutes from './routes/stacks.js'
import movesRoutes from './routes/moves.js'
import aiRoutes from './routes/ai.js'
import { ensureAuthTables, ensureFeatureTables, backfillConsumptionEvents } from './services/startupService.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => ok(res, { ok: true }))
app.use('/api/auth', authRoutes)

app.use('/api', authenticateToken)
app.use('/api', warehousesRoutes)
app.use('/api', productsRoutes)
app.use('/api', operationsRoutes)
app.use('/api', dashboardRoutes)
app.use('/api', stacksRoutes)
app.use('/api', movesRoutes)
app.use('/api/ai', aiRoutes)

app.use(errorHandler)

const PORT = Number(process.env.PORT || 4000)

async function start() {
  try {
    await ensureAuthTables()
    await ensureFeatureTables()
    await backfillConsumptionEvents()
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start API:', err)
    process.exit(1)
  }
}

start()
