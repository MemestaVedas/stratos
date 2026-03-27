import express from 'express';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import indexRoutes from './routes/indexes';
import queryRoutes from './routes/query';
import datasourceRoutes from './routes/datasources';
import analyticsRoutes from './routes/analytics';
import apikeyRoutes from './routes/apikeys';
import chunkRoutes from './routes/chunks';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '50mb' })); // Larger limit for file uploads
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-org-id, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Vektor API', version: '1.0.0' });
});

// Routes
app.use('/api/indexes', indexRoutes);
app.use('/api/indexes', queryRoutes);     // /api/indexes/:id/query
app.use('/api/indexes', analyticsRoutes); // /api/indexes/:id/analytics
app.use('/api/indexes', chunkRoutes);     // /api/indexes/:id/chunks
app.use('/api', datasourceRoutes);        // /api/indexes/:id/datasources + /api/datasources/:id
app.use('/api/apikeys', apikeyRoutes);

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
      logger.info('Routes: /api/indexes, /api/datasources, /api/apikeys');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
