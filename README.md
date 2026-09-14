# Ferreteria


## backend

```bash
npx tsc 
```
```bash
cd backend
```
```bash
npm install
```
```bash
npm run dev
```
## reload backend
```bash
npm run typescript
```

## frontend
```bash
cd frontend
```
```bash
npm install
```
```bash
ng serve --o
```
## deploy
```bash
ng build --configuration production
```

# Estructura del Backend

```bash
src/
├── config/           # Configuraciones (DB, variables de entorno)
├── controllers/      # Lógica de rutas (manejo req/res)
├── dtos/             # Data Transfer Objects
├── mappers/          # Mapeos de objetos
├── services/         # Lógica de negocio
├── models/           # Modelos de datos y DB
├── routes/           # Definición de endpoints
├── middlewares/      # Middlewares personalizados
├── dataAccess/       # Accesos a datos
├── utils/            # Utilidades/helpers
├── validations/      # Esquemas de validación
└── app.js            # Entrada principal

src/
├── config/
│   └── database.ts
├── controllers/
│   └── userController.ts
├── models/
│   └── userModel.ts
├── routes/
│   └── userRoutes.ts
├── services/
│   └── userService.ts
├── middlewares/
│   └── authMiddleware.ts
├── utils/
│   └── logger.ts
└── index.ts
```

https://blog.logrocket.com/node-js-project-architecture-best-practices/

example:


# CRUD de Categorías - TypeScript Express

## Estructura del proyecto

```
src/
├── config/
│   └── database.ts
├── controllers/
│   └── categoryController.ts
├── dtos/
│   ├── categoryDto.ts
│   └── responseDto.ts
├── mappers/
│   └── categoryMapper.ts
├── services/
│   └── categoryService.ts
├── models/
│   └── categoryModel.ts
├── routes/
│   └── categoryRoutes.ts
├── middlewares/
│   ├── errorHandler.ts
│   └── validationMiddleware.ts
├── dataAccess/
│   └── categoryRepository.ts
├── utils/
│   └── helpers.ts
├── validations/
│   └── categoryValidation.ts
└── app.ts
```

## 1. Configuración de base de datos

**src/config/database.ts**
```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'categories_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export default pool;
```

## 2. DTOs (Data Transfer Objects)

**src/dtos/categoryDto.ts**
```typescript
export interface CreateCategoryDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CategoryResponseDto {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**src/dtos/responseDto.ts**
```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## 3. Modelo de datos

**src/models/categoryModel.ts**
```typescript
export interface Category {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryFilters {
  name?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}
```

## 4. Validaciones

**src/validations/categoryValidation.ts**
```typescript
import Joi from 'joi';

export const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'El nombre es requerido',
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'string.max': 'El nombre no puede exceder 100 caracteres'
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'La descripción no puede exceder 500 caracteres'
  }),
  isActive: Joi.boolean().optional()
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'string.max': 'El nombre no puede exceder 100 caracteres'
  }),
  description: Joi.string().max(500).optional().messages({
    'string.max': 'La descripción no puede exceder 500 caracteres'
  }),
  isActive: Joi.boolean().optional()
});

export const getCategoriesSchema = Joi.object({
  name: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional()
});
```

## 5. Middlewares

**src/middlewares/validationMiddleware.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ApiResponse } from '../dtos/responseDto';

export const validateBody = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const response: ApiResponse<null> = {
        success: false,
        message: 'Error de validación',
        error: error.details[0].message
      };
      return res.status(400).json(response);
    }
    
    next();
  };
};

export const validateQuery = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const response: ApiResponse<null> = {
        success: false,
        message: 'Error de validación en parámetros',
        error: error.details[0].message
      };
      return res.status(400).json(response);
    }
    
    next();
  };
};
```

**src/middlewares/errorHandler.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../dtos/responseDto';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Error interno del servidor';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  console.error('Error:', err);

  const response: ApiResponse<null> = {
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  };

  res.status(statusCode).json(response);
};
```

## 6. Acceso a datos

**src/dataAccess/categoryRepository.ts**
```typescript
import pool from '../config/database';
import { Category, CategoryFilters } from '../models/categoryModel';
import { CreateCategoryDto, UpdateCategoryDto } from '../dtos/categoryDto';

export class CategoryRepository {
  
  async create(categoryData: CreateCategoryDto): Promise<Category> {
    const query = `
      INSERT INTO categories (name, description, is_active)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [
      categoryData.name,
      categoryData.description || null,
      categoryData.isActive ?? true
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findById(id: number): Promise<Category | null> {
    const query = 'SELECT * FROM categories WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAll(filters: CategoryFilters): Promise<{ categories: Category[], total: number }> {
    let query = 'SELECT * FROM categories WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM categories WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    // Aplicar filtros
    if (filters.name) {
      query += ` AND name ILIKE $${paramIndex}`;
      countQuery += ` AND name ILIKE $${paramIndex}`;
      values.push(`%${filters.name}%`);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      countQuery += ` AND is_active = $${paramIndex}`;
      values.push(filters.isActive);
      paramIndex++;
    }

    // Ordenar y paginar
    query += ' ORDER BY created_at DESC';
    
    const limit = filters.limit || 10;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;
    
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const [categoriesResult, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2)) // Remover limit y offset para el count
    ]);

    return {
      categories: categoriesResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async update(id: number, categoryData: UpdateCategoryDto): Promise<Category | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (categoryData.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(categoryData.name);
      paramIndex++;
    }

    if (categoryData.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(categoryData.description);
      paramIndex++;
    }

    if (categoryData.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(categoryData.isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramIndex}`);
    values.push(new Date());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE categories 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM categories WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  async findByName(name: string, excludeId?: number): Promise<Category | null> {
    let query = 'SELECT * FROM categories WHERE LOWER(name) = LOWER($1)';
    const values: any[] = [name];

    if (excludeId) {
      query += ' AND id != $2';
      values.push(excludeId);
    }

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }
}
```

## 7. Mappers

**src/mappers/categoryMapper.ts**
```typescript
import { Category } from '../models/categoryModel';
import { CategoryResponseDto } from '../dtos/categoryDto';

export class CategoryMapper {
  
  static toResponseDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      isActive: category.is_active,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    };
  }

  static toResponseDtoArray(categories: Category[]): CategoryResponseDto[] {
    return categories.map(category => this.toResponseDto(category));
  }
}
```

## 8. Servicios

**src/services/categoryService.ts**
```typescript
import { CategoryRepository } from '../dataAccess/categoryRepository';
import { CategoryMapper } from '../mappers/categoryMapper';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from '../dtos/categoryDto';
import { CategoryFilters } from '../models/categoryModel';
import { AppError } from '../middlewares/errorHandler';

export class CategoryService {
  private categoryRepository: CategoryRepository;

  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  async createCategory(categoryData: CreateCategoryDto): Promise<CategoryResponseDto> {
    // Verificar si ya existe una categoría con el mismo nombre
    const existingCategory = await this.categoryRepository.findByName(categoryData.name);
    if (existingCategory) {
      throw new AppError('Ya existe una categoría con este nombre', 409);
    }

    const category = await this.categoryRepository.create(categoryData);
    return CategoryMapper.toResponseDto(category);
  }

  async getCategoryById(id: number): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new AppError('Categoría no encontrada', 404);
    }
    return CategoryMapper.toResponseDto(category);
  }

  async getCategories(filters: CategoryFilters) {
    const { categories, total } = await this.categoryRepository.findAll(filters);
    const limit = filters.limit || 10;
    const page = filters.page || 1;
    
    return {
      categories: CategoryMapper.toResponseDtoArray(categories),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async updateCategory(id: number, categoryData: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const existingCategory = await this.categoryRepository.findById(id);
    if (!existingCategory) {
      throw new AppError('Categoría no encontrada', 404);
    }

    // Verificar si el nuevo nombre ya existe (excluyendo la categoría actual)
    if (categoryData.name) {
      const duplicateCategory = await this.categoryRepository.findByName(categoryData.name, id);
      if (duplicateCategory) {
        throw new AppError('Ya existe una categoría con este nombre', 409);
      }
    }

    const updatedCategory = await this.categoryRepository.update(id, categoryData);
    if (!updatedCategory) {
      throw new AppError('Error al actualizar la categoría', 500);
    }

    return CategoryMapper.toResponseDto(updatedCategory);
  }

  async deleteCategory(id: number): Promise<void> {
    const existingCategory = await this.categoryRepository.findById(id);
    if (!existingCategory) {
      throw new AppError('Categoría no encontrada', 404);
    }

    const deleted = await this.categoryRepository.delete(id);
    if (!deleted) {
      throw new AppError('Error al eliminar la categoría', 500);
    }
  }
}
```

## 9. Utilidades

**src/utils/helpers.ts**
```typescript
export const parseBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
};

export const parseNumber = (value: any, defaultValue: number = 0): number => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};
```

## 10. Controladores

**src/controllers/categoryController.ts**
```typescript
import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/categoryService';
import { ApiResponse, PaginatedResponse } from '../dtos/responseDto';
import { CategoryResponseDto } from '../dtos/categoryDto';
import { parseBoolean, parseNumber } from '../utils/helpers';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.categoryService.createCategory(req.body);
      
      const response: ApiResponse<CategoryResponseDto> = {
        success: true,
        message: 'Categoría creada exitosamente',
        data: category
      };
      
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      const category = await this.categoryService.getCategoryById(id);
      
      const response: ApiResponse<CategoryResponseDto> = {
        success: true,
        message: 'Categoría obtenida exitosamente',
        data: category
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        name: req.query.name as string,
        isActive: req.query.isActive ? parseBoolean(req.query.isActive) : undefined,
        page: parseNumber(req.query.page, 1),
        limit: parseNumber(req.query.limit, 10)
      };

      const result = await this.categoryService.getCategories(filters);
      
      const response: PaginatedResponse<CategoryResponseDto> = {
        success: true,
        message: 'Categorías obtenidas exitosamente',
        data: result.categories,
        pagination: result.pagination
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      const category = await this.categoryService.updateCategory(id, req.body);
      
      const response: ApiResponse<CategoryResponseDto> = {
        success: true,
        message: 'Categoría actualizada exitosamente',
        data: category
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      await this.categoryService.deleteCategory(id);
      
      const response: ApiResponse<null> = {
        success: true,
        message: 'Categoría eliminada exitosamente'
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}
```

## 11. Rutas

**src/routes/categoryRoutes.ts**
```typescript
import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { validateBody, validateQuery } from '../middlewares/validationMiddleware';
import { 
  createCategorySchema, 
  updateCategorySchema, 
  getCategoriesSchema 
} from '../validations/categoryValidation';

const router = Router();
const categoryController = new CategoryController();

// Crear categoría
router.post('/', 
  validateBody(createCategorySchema),
  categoryController.createCategory
);

// Obtener todas las categorías con filtros
router.get('/',
  validateQuery(getCategoriesSchema),
  categoryController.getCategories
);

// Obtener categoría por ID
router.get('/:id', categoryController.getCategoryById);

// Actualizar categoría
router.put('/:id',
  validateBody(updateCategorySchema),
  categoryController.updateCategory
);

// Eliminar categoría
router.delete('/:id', categoryController.deleteCategory);

export default router;
```

## 12. Aplicación principal

**src/app.ts**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import categoryRoutes from './routes/categoryRoutes';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/categories', categoryRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manejo de errores
app.use(errorHandler);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

export default app;
```

## 13. SQL para crear la tabla

```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_categories_is_active ON categories(is_active);
CREATE INDEX idx_categories_created_at ON categories(created_at);
```

## 14. package.json

```json
{
  "name": "category-crud-api",
  "version": "1.0.0",
  "description": "CRUD API para categorías con TypeScript y Express",
  "main": "dist/app.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
    "lint": "eslint src/**/*.ts",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "joi": "^17.9.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.1.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.3.1",
    "@types/pg": "^8.10.2",
    "@types/cors": "^2.8.13",
    "@types/morgan": "^1.9.4",
    "typescript": "^5.1.3",
    "ts-node-dev": "^2.0.0"
  }
}
```

## 15. Variables de entorno (.env)

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=categories_db
DB_USER=postgres
DB_PASSWORD=password
```

## 16. Configuración de TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Endpoints disponibles:

- **POST** `/api/categories` - Crear categoría
- **GET** `/api/categories` - Obtener todas las categorías (con filtros y paginación)
- **GET** `/api/categories/:id` - Obtener categoría por ID
- **PUT** `/api/categories/:id` - Actualizar categoría
- **DELETE** `/api/categories/:id` - Eliminar categoría

## Características implementadas:

- ✅ Arquitectura modular y escalable
- ✅ Validación de datos con Joi
- ✅ Manejo de errores centralizado
- ✅ Paginación y filtros
- ✅ Mappers para transformar datos
- ✅ Repository pattern para acceso a datos
- ✅ DTOs para transferencia de datos
- ✅ Middlewares de validación
- ✅ Tipado estricto con TypeScript
- ✅ Consultas SQL optimizadas
- ✅ Manejo de duplicados
- ✅ Respuestas consistentes de API