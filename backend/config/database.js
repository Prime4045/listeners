import mongoose from 'mongoose';
import { createClient } from 'redis';

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connected successfully');
});

const initializeRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Redis connection error:', error);
  }
};

export { connectMongoDB, redisClient, initializeRedis };
