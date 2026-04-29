/**
 * StreamFlow — API Gateway
 *
 * Ponto de entrada único para todos os microsserviços.
 * Responsabilidades:
 *   - Roteamento de requisições para serviços internos
 *   - Autenticação JWT centralizada (chave pública RS256)
 *   - Logging estruturado (Pino, nativo do Fastify)
 *   - Health check agregado
 */

const Fastify = require('fastify');
const proxy = require('@fastify/http-proxy');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' }
    }
  }
});

const PORT = process.env.PORT || 8080;

// ── Chave pública para validação JWT ────────────────────────
let PUBLIC_KEY;
try {
  PUBLIC_KEY = fs.readFileSync(
    process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem',
    'utf8'
  );
} catch (err) {
  app.log.warn('Chave pública JWT não encontrada — autenticação desabilitada');
}

// ── Hook de autenticação JWT ────────────────────────────────
// Usado como preHandler nas rotas que exigem autenticação
async function authenticateJWT(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    request.headers['x-user-id'] = decoded.sub;
    request.headers['x-user-role'] = decoded.role;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return reply.code(401).send({ error: 'Token expirado.' });
    }
    return reply.code(403).send({ error: 'Token inválido.' });
  }
}

// ── Rotas de proxy ──────────────────────────────────────────

// Auth — público (login não exige token)
app.register(proxy, {
  upstream: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  prefix: '/auth',
  rewritePrefix: '',
});

// Catalog — protegido
app.register(proxy, {
  upstream: process.env.CATALOG_SERVICE_URL || 'http://localhost:3002',
  prefix: '/api/catalog',
  rewritePrefix: '/catalog',
  preHandler: authenticateJWT,
});

// Streaming — protegido
app.register(proxy, {
  upstream: process.env.STREAMING_SERVICE_URL || 'http://localhost:3003',
  prefix: '/api/streaming',
  rewritePrefix: '/streaming',
  preHandler: authenticateJWT,
});

// Recommendations — protegido
app.register(proxy, {
  upstream: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3004',
  prefix: '/api/recommendations',
  rewritePrefix: '/recommendations',
  preHandler: authenticateJWT,
});

// Billing — protegido
app.register(proxy, {
  upstream: process.env.BILLING_SERVICE_URL || 'http://localhost:3006',
  prefix: '/api/billing',
  rewritePrefix: '/billing',
  preHandler: authenticateJWT,
});

// Analytics — protegido
app.register(proxy, {
  upstream: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007',
  prefix: '/api/analytics',
  rewritePrefix: '/analytics',
  preHandler: authenticateJWT,
});

// ── Health check agregado ───────────────────────────────────
app.get('/health', async (request, reply) => {
  const services = {
    'auth-service': process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    'catalog-service': process.env.CATALOG_SERVICE_URL || 'http://localhost:3002',
    'streaming-service': process.env.STREAMING_SERVICE_URL || 'http://localhost:3003',
    'recommendation-service': process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3004',
    'notification-service': process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
    'billing-service': process.env.BILLING_SERVICE_URL || 'http://localhost:3006',
    'analytics-service': process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007',
  };

  const results = {};

  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();
      console.log(`Verificando saúde de ${name} em ${url}/health, com resposta:`, data);

      results[name] = { status: 'up', ...data };
    } catch {
      console.error(`Falha ao verificar saúde de ${name} em ${url}/health`);
      results[name] = { status: 'down' };
    }
  }

  const allUp = Object.values(results).every(r => r.status === 'ok');

  return reply.code(allUp ? 200 : 503).send({
    service: 'gateway',
    status: allUp ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    downstream: results,
  });
});

// ── Inicialização ───────────────────────────────────────────
app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`StreamFlow Gateway operando na porta ${PORT}`);
});
