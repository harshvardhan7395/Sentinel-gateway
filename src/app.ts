import express from 'express';
import gatewayRouter from './routes/gateway';
import healthRouter from './routes/health';
import controlRouter from './routes/control';
import dashboardRouter from './routes/dashboard';

const app = express();
app.use(express.json());

app.use('/', healthRouter);
app.use('/', gatewayRouter);
app.use('/', controlRouter);
app.use('/', dashboardRouter);

export default app;