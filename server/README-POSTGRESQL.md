# Time Tracking Application - PostgreSQL Setup

## Configuración de Variables de Entorno

### Archivo `.env` (Local/Desarrollo)
Crea o actualiza el archivo `server/.env` con:

```env
PORT=3000
DATABASE_URL=postgresql://usr1wx4ig8ekg:z#>B(#d12^d{@35.214.221.252:443/dbolsqtjszs2bl
```

**IMPORTANTE**: El puerto es **443**, no el estándar 5432.

### Variables para Render (Producción)

Cuando despliegues en Render, configura estas variables de entorno:

- `DATABASE_URL`: `postgresql://usr1wx4ig8ekg:z#>B(#d12^d{@35.214.221.252:443/dbolsqtjszs2bl`
- `NODE_ENV`: `production`

## Instalación y Ejecución

### 1. Instalar Dependencias
```bash
cd server
npm install
```

### 2. Ejecutar Localmente
```bash
npm start
```

O para desarrollo con auto-restart:
```bash
npm run dev
```

### 3. Verificar Conexión
El servidor debería mostrar:
- "Connected to PostgreSQL database"
- "Seeded admin user" (primera vez)
- "Database initialized successfully"
- "Server running on http://localhost:3000"

## Credenciales por Defecto

### Usuario Admin
- Username: `admin`
- Password: `admin123`

### Usuario Worker (testing)
- Username: `worker`
- Password: `worker123`

## Estructura de Base de Datos

### Tablas Creadas Automáticamente:
1. **users** - Usuarios del sistema (admin/worker)
2. **locations** - Ubicaciones de trabajo
3. **time_logs** - Registros de entrada/salida y reportes
4. **worker_assignments** - Asignaciones de trabajadores a ubicaciones

## Deployment en Render

### Paso 1: Conectar Repositorio
1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Conecta tu repositorio de GitHub

### Paso 2: Configurar Build
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && npm start`
- **Environment**: Node

### Paso 3: Configurar Variables de Entorno
Agrega la variable:
```
DATABASE_URL=postgresql://usr1wx4ig8ekg:z#>B(#d12^d{@35.214.221.252:443/dbolsqtjszs2bl
NODE_ENV=production
```

### Paso 4: Deploy
Click "Create Web Service" y espera a que se complete el deployment.

## Frontend Configuration

### Archivo `.env` (Local)
```env
VITE_SERVER_URL=http://localhost:3000
```

### Archivo `.env.production` (Producción)
```env
VITE_SERVER_URL=https://tu-backend-url.onrender.com
```

Actualiza la URL con la URL real del backend desplegado en Render.

## Troubleshooting

### Error: ECONNREFUSED
- Verifica que el puerto en DATABASE_URL sea **443**
- Verifica que el archivo `.env` exista y esté correctamente formateado
- Asegúrate de que no haya espacios extras en la URL

### Error: SSL Connection
- La configuración está habilitada con `rejectUnauthorized: false`
- Si persiste, contacta a SiteGround para verificar configuración SSL

### Error: Authentication Failed
- Verifica que las credenciales sean correctas
- Verifica que no haya caracteres especiales mal escapados en la contraseña

## Migración desde SQLite

Si tenías datos en SQLite y quieres migrarlos:

1. Las tablas se crean automáticamente al iniciar el servidor
2. Los usuarios admin y worker se crean automáticamente si no existen
3. Para otros datos, necesitarás exportar desde SQLite e importar a PostgreSQL manualmente

## Notas de Seguridad

⚠️ **IMPORTANTE**: 
- El archivo `.env` está en `.gitignore` - NUNCA lo subas a GitHub
- Cambia las contraseñas por defecto (admin123, worker123) en producción
- Considera rotar las credenciales de PostgreSQL periódicamente
