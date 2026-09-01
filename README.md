# FarmFlow Pro

Prompt para Lovable

Crea una aplicación web de gestión agrícola para el control de tareas, horas de trabajadores y compras de insumos/materiales en varias fincas.

Fincas a gestionar

Pai mango (mango)

Avoclan Casa (mango)

Avoclan Fortaleza (mango)

Loma Mesías (aguacate)

Río Seco (aguacate)

Frunet (aguacate)

Cada finca debe tener su propio espacio de datos, pero un usuario con permisos debe poder ver el conjunto de todas las fincas.

Funcionalidades principales

1. Registro de horas de trabajadores (entrada manual-mediante voz.)

Formulario para que el encargado de cada finca registre, por trabajador y por día: nombre del trabajador, finca, fecha, horas trabajadas, tipo de tarea realizada (ej. poda, riego, fumigación, cosecha, mantenimiento) y observaciones opcionales.

Debe permitir editar o eliminar registros del mismo día/mes.

Listado de trabajadores por finca, para no tener que escribir el nombre cada vez (selector desplegable).

2. Registro de compras de insumos y materiales (entrada manual)

Pestaña separada para registrar compras: finca, fecha, insumo/material comprado, cantidad, unidad de medida, coste, proveedor (opcional) y factura/nota adjunta (opcional, si es posible subir una imagen o PDF).

Categorías de insumos: fertilizantes, fitosanitarios, herramientas, combustible, otros (que se puedan añadir más categorías después).

3. Panel de tareas de campo

Pestaña para planificar y marcar tareas por finca (pendiente / en curso / completada), con fecha y responsable asignado.

4. Chatbot conversacional para consultas e informes

Un chat donde el encargado pueda preguntar en lenguaje natural, por ejemplo:

"¿Cuántas horas ha trabajado [nombre] este mes en Paimango?"

"¿Cuánto hemos gastado en fitosanitarios en Aboplan Fortaleza en agosto?"

"Dame un resumen de las tareas completadas esta semana en Río Seco"

"Compara el gasto en insumos entre las tres fincas de mango este mes"

El chatbot debe responder basándose en los datos reales introducidos en la app (horas, compras, tareas), no información inventada.

Debe poder generar informes/resúmenes mensuales por finca y consolidados de todas las fincas.

5. Informes y resúmenes

Vista de dashboard con totales por finca: horas trabajadas del mes, gasto total en insumos del mes, tareas completadas vs pendientes.

Posibilidad de exportar un resumen mensual (PDF o similar) por finca.

Gráficos simples comparando fincas (horas trabajadas, gasto en insumos) por mes.

Usuarios y accesos

Login con email/contraseña.

Cada finca tiene un encargado que solo ve/edita los datos de su finca.

Un rol de "administrador" que ve todas las fincas y puede usar el chatbot para consultas globales.

Estilo visual

Diseño limpio, profesional, fácil de usar desde móvil en el campo (el encargado probablemente lo usará desde el teléfono).

Colores neutros con un verde como color principal (tema agrícola).

Navegación simple por pestañas: Horas, Compras, Tareas, Informes, Chat.

Base de datos

Usa Supabase para guardar de forma persistente: fincas, trabajadores, registros de horas, registros de compras, tareas y usuarios.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8e114663-4d21-4e0b-b1e5-9b5495a2920d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
