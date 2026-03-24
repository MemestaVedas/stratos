import redis from 'redis';
import { logger } from '../utils/logger';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export async function initializeRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis connection established');
    
    // Test connection
    await redisClient.ping();
    logger.info('Redis ping successful');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

export function getRedisClient() {
  return redisClient;
}
