import express from 'express';
import { 
  createSanitizationMiddleware, 
  createNormalizationMiddleware,
  DEFAULT_CONFIG 
} from '../src';

const app = express();

// Basic middleware setup
app.use(express.json());

// Apply sanitization middleware
app.use(createSanitizationMiddleware(DEFAULT_CONFIG.sanitization, {
  sanitizeBody: true,
  sanitizeQuery: true,
  sanitizeParams: true,
  onViolation: (violations, req) => {
    console.warn(`Sanitization violations on ${req.path}:`, violations);
  }
}));

// Apply normalization middleware
app.use(createNormalizationMiddleware(DEFAULT_CONFIG.normalization, {
  autoDetectPagination: true,
  extractRequestId: (req) => req.headers['x-request-id'] as string,
  onError: (error, req, res) => {
    console.error(`Normalization error on ${req.path}:`, error);
  }
}));

// Example routes
app.post('/api/users', (req, res) => {
  const userData = req.body;
  
  // Simulate user creation
  const user = {
    id: Math.floor(Math.random() * 1000),
    ...userData,
    createdAt: new Date().toISOString()
  };
  
  res.status(201).json(user);
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  
  const user = {
    id: parseInt(id),
    name: 'John Doe',
    email: 'john@example.com',
    bio: 'Software Developer'
  };
  
  res.json(user);
});

app.get('/api/users', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Simulate paginated response
  const users = Array.from({ length: limit }, (_, i) => ({
    id: (page - 1) * limit + i + 1,
    name: `User ${(page - 1) * limit + i + 1}`,
    email: `user${(page - 1) * limit + i + 1}@example.com`
  }));
  
  res.json({
    data: users,
    page,
    limit,
    total: 100,
    totalPages: Math.ceil(100 / limit),
    hasNext: page < Math.ceil(100 / limit),
    hasPrev: page > 1
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Resource not found'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', error);
  
  res.status(error.status || 500).json({
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});