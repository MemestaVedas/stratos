import express from 'express';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import accountRoutes from './routes/accounts';
import dashboardRoutes from './routes/dashboard';
import predictionsRoutes from './routes/predictions';
import eventsRoutes from './routes/events';
import alertsRoutes from './routes/alerts';
import forecastRoutes from './routes/forecast';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-org-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Aurum API', version: '1.0.0' });
});

// Routes
app.use('/api/accounts', accountRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/forecast', forecastRoutes);

// SSE endpoint for real-time health score updates
app.get('/api/stream/scores/:orgId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const interval = setInterval(() => {
    const data = JSON.stringify({
      type: 'score_update',
      account_id: 'acct_' + Math.floor(Math.random() * 100),
      new_score: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString(),
    });
    res.write(`data: ${data}\n\n`);
  }, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

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
      logger.info('Routes registered: /api/accounts, /api/dashboard, /api/predictions, /api/events, /api/alerts, /api/forecast');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
