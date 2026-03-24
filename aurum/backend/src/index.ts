import express from 'express';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import accountRoutes from './routes/accounts';
import dashboardRoutes from './routes/dashboard';
import predictionsRoutes from './routes/predictions';
import eventsRoutes from './routes/events';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Aurum API', version: '1.0.0' });
});

// Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/events', eventsRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function start() {
  try {
    logger.info('Initializing Aurum services...');
    await connectDatabase();
    await initializeRedis();
    
    app.listen(PORT, () => {
      logger.info(`Aurum API server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
