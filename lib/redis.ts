import { Redis } from '@upstash/redis';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing. Set it in your environment variables.`);
  }
  return value;
}

let redisClient: Redis | null = null;

export function getRedis() {
  if (!redisClient) {
    redisClient = new Redis({
      url: requireEnv('UPSTASH_REDIS_REST_URL'),
      token: requireEnv('UPSTASH_REDIS_REST_TOKEN')
    });
  }

  return redisClient;
}
