# Consultorio Santa María

Proyecto inicial de gestión para consultorio médico unipersonal con Next.js App Router, TypeScript, Tailwind CSS y Supabase.

## Inicializar el proyecto

1. Instalar dependencias:

```bash
npm install
```

2. Copiar el archivo de ejemplo de variables de entorno:

```bash
copy .env.local
```

3. Completar las variables de entorno con tus credenciales de Supabase y Resend.

4. Ejecutar el servidor de desarrollo:

```bash
npm run dev
```

5. Abrir [http://localhost:3000](http://localhost:3000).

## Rutas principales

- `/` - Landing pública.
- `/turnos` - Solicitud de turno.
- `/login` - Autenticación con email y contraseña.
- `/panel` - Panel médico protegido.
- `/mi-cuenta` - Panel de paciente protegido.
- `/api/reminders` - Ruta de recordatorio diario preparada para cron.

