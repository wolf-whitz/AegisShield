import Redis from 'ioredis';

export const redis = new Redis({
  host: "redis-15880.c8.us-east-1-2.ec2.redns.redis-cloud.com",
  port: 15880,
  username: "default",
  password: process.env.REDIS_PASSWORD,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});