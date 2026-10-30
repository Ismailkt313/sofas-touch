import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import { env } from './config/env';
import { connectDB } from './config/db';
import helmet from 'helmet';
import authRouter from './modules/auth';
import userRouter from './modules/users';
import adminRoutes from './routes/adminRoutes';
import projectRoutes from './routes/projectRoutes';
import rawMaterialRoutes from './routes/rawMaterialRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import expenseRoutes from './routes/expenseRoutes';
import reportRoutes from './routes/reportRoutes';
import activityRoutes from './routes/activityRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import permissionRoutes from './routes/permissionRoutes';
import settingsRoutes from './routes/settingsRoutes';

const app = express();
const PORT = env.PORT;

app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

connectDB();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (
      env.CORS_ORIGINS.includes(normalizedOrigin) ||
      /^https:\/\/[a-z0-9-]+\.e2b\.app$/i.test(normalizedOrigin)
    ) {
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
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Idempotency-Key'],
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
app.use('/api/users', userRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/settings', settingsRoutes);

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
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Soft Touch Sofas server is running on http://0.0.0.0:${PORT}`);
    console.log(`Allowed CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
  });
}

export default app;
