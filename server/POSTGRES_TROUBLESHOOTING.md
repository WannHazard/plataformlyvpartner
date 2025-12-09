# PostgreSQL Connection Troubleshooting

## Current Issue
La conexión a PostgreSQL está siendo rechazada con el error `ECONNREFUSED`. Esto significa que no podemos conectarnos a la base de datos desde la máquina local.

## Credenciales Proporcionadas
- **Host**: 35.214.221.252
- **Puerto**: 5432 (por defecto)
- **Base de datos**: dbolsqtjszs2bl
- **Usuario**: usr1wx4ig8ekg
- **Contraseña**: z#>B(#d12^d{

## Posibles Causas

### 1. Whitelist de IP
La base de datos PostgreSQL puede estar configurada para aceptar solo conexiones desde IPs específicas. Necesitas:
- Acceder al panel de SiteGround
- Buscar la sección de PostgreSQL
- Agregar tu IP pública a la whitelist de IPs permitidas

### 2. Conexión Solo Local
La base de datos puede estar configurada para aceptar solo conexiones locales (desde el mismo servidor de hosting). En este caso:
- Solo podrás usar la base de datos cuando despliegues la aplicación
- Para desarrollo local, necesitarás usar SQLite o una base de datos PostgreSQL local

### 3. Puerto Incorrecto
Aunque 5432 es el puerto por defecto, verifica en el panel de SiteGround el puerto exacto.

### 4. SSL/TLS Requerido
Algunos proveedores requieren configuraciones SSL específicas.

## Soluciones Propuestas

### Opción A: Configurar Acceso Remoto (Recomendado para Desarrollo)
1. Accede al panel de SiteGround
2. Ve a la sección de PostgreSQL
3. Busca "Acceso Remoto" o "Remote MySQL/PostgreSQL"
4. Agrega tu IP pública a la whitelist
5. Guarda los cambios y vuelve a intentar

### Opción B: Desarrollo Local con SQLite + Producción con PostgreSQL
1. Mantener SQLite para desarrollo local
2. Usar PostgreSQL solo en producción (Render/SiteGround)
3. Usar variables de entorno para cambiar entre bases de datos

### Opción C: Usar PostgreSQL Local para Desarrollo
1. Instalar PostgreSQL localmente
2. Crear una base de datos local para desarrollo
3. Usar PostgreSQL de SiteGround solo para producción

### Opción D: Desplegar Directamente y Probar en Producción
1. Desplegar la aplicación actualizada en Render
2. Configurar las variables de entorno de PostgreSQL
3. Probar la conexión desde el servidor desplegado

## Próximos Pasos
Por favor, revisa el panel de SiteGround y confirma:
1. ¿Hay una opción de whitelist de IPs?
2. ¿La base de datos permite conexiones remotas?
3. ¿Cuál es el puerto exacto?

O si prefieres, podemos proceder directamente a desplegar en producción y probar allí.
