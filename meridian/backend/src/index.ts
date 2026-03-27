import express from 'express';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import workflowRoutes from './routes/workflows';
import executionRoutes from './routes/executions';
import triggerRoutes from './routes/triggers';
import credentialRoutes from './routes/credentials';
import versionRoutes from './routes/versions';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-org-id, x-workspace-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Meridian API', version: '1.0.0' });
});

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflows', versionRoutes);       // /api/workflows/:id/versions
app.use('/api', executionRoutes);                // /api/workflows/:id/executions + /api/executions/:id
app.use('/api/triggers', triggerRoutes);
app.use('/api/credentials', credentialRoutes);

// LLM models endpoint
app.get('/api/llm/models', (req, res) => {
  const { llmRouter } = require('./services/LLMRouter');
  res.json({ status: 'success', data: llmRouter.listModels() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function start() {
  try {
    logger.info('Initializing Meridian services...');
    await connectDatabase();
    await initializeRedis();

    app.listen(PORT, () => {
      logger.info(`Meridian API server running on port ${PORT}`);
      logger.info('Routes: /api/workflows, /api/executions, /api/triggers, /api/credentials');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
