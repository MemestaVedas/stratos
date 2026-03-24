import express from 'express';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import indexRoutes from './routes/indexes';
import dataSourceRoutes from './routes/datasources';
import queryRoutes from './routes/query';
import analyticsRoutes from './routes/analytics';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Vektor API', version: '1.0.0' });
});

// Routes
app.use('/api/indexes', indexRoutes);
app.use('/api/datasources', dataSourceRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function start() {
  try {
    logger.info('Initializing Vektor services...');
    await connectDatabase();
    await initializeRedis();
    
    app.listen(PORT, () => {
      logger.info(`Vektor API server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
