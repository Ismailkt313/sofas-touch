import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import { env } from './config/env';
import { connectDB } from './config/db';
import helmet from 'helmet';
import authRouter from './modules/auth';
import adminRoutes from './routes/adminRoutes';
import projectRoutes from './routes/projectRoutes';

const app = express();
const PORT = env.PORT;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

connectDB();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (env.CORS_ORIGINS.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          `CORS policy violation: Origin '${origin}' is not allowed by CORS_ORIGINS.`,
        ),
      );
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Soft Touch Sofas API',
    status: 'online',
    port: PORT,
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested route does not exist.',
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message && err.message.includes('CORS policy violation')) {
    res.status(403).json({
      error: 'Forbidden',
      message: err.message,
    });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message:
      env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Soft Touch Sofas server is running on http://localhost:${PORT}`);
    console.log(`Allowed CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
  });
}

export default app;
