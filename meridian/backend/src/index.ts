import express from 'express';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import workflowRoutes from './routes/workflows';
import executionRoutes from './routes/executions';
import triggerRoutes from './routes/triggers';
import credentialsRoutes from './routes/credentials';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Meridian API', version: '1.0.0' });
});

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/credentials', credentialsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Initialize services and start server
async function start() {
  try {
    logger.info('Initializing Meridian services...');
    await connectDatabase();
    await initializeRedis();
    
    app.listen(PORT, () => {
      logger.info(`Meridian API server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
