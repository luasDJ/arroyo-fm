# Arroyo FM — Web de radio

## Incluye
- Página pública con diseño oscuro moderno.
- Reproductor Caster.fm usando el código facilitado.
- Selector de GoCast mediante URL externa o iframe.
- Panel sin login que lee y guarda la configuración en Supabase.

## Importante
La clave incluida en `app.js` y `admin.js` es la Publishable key de Supabase y puede estar en el navegador. Nunca debe sustituirse por una `SUPABASE_SECRET_KEY`.

El panel incluye un código básico de acceso inicial: `arroyo-fm`. Este código está en `admin.js`, por lo que no es una medida de seguridad real en GitHub Pages; para producción debe sustituirse por autenticación de Supabase o un backend.

El panel no tiene autenticación en esta versión. Por ello, una política RLS que permita `UPDATE` anónimo sobre `public.radio_config` deja que cualquier persona que conozca el panel pueda cambiar la emisión. Para un entorno real, usa autenticación de administrador o una función/endpoint server-side que valide la operación. La lectura pública debe permanecer permitida con la Publishable key.

La tabla `public.radio_config` debe tener una fila con `id = 1` y las columnas `mode`, `gocast_url`, `gocast_type` y `updated_at`. Los valores esperados son `caster`/`gocast` y `link`/`iframe`.

## Publicar en GitHub Pages
1. Crea un repositorio en GitHub.
2. Sube todos los archivos de esta carpeta a la rama principal.
3. Ve a Settings > Pages.
4. Selecciona Deploy from a branch.
5. Elige la rama principal y la carpeta `/root`.
6. Guarda y abre la URL que GitHub Pages te indique.

- `logo.png` — Logo proporcionado para Arroyo FM.
