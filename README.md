# Arroyo FM — Web de radio

## Incluye
- Página pública con diseño oscuro moderno.
- Reproductor Caster.fm usando el código facilitado.
- Selector de GoCast mediante URL externa o iframe.
- Panel protegido por inicio de sesión de Supabase.

## Publicación y Supabase
1. Ejecuta `supabase.sql` en el SQL Editor de tu proyecto Supabase.
2. Publica los archivos de este repositorio desde la raíz en GitHub Pages.
3. Configura la URL del proyecto y su Publishable key en los bloques de configuración de `index.html` y `admin.html`.

La Publishable key está diseñada para uso en el navegador. Nunca la sustituyas por una `SUPABASE_SECRET_KEY` ni publiques el archivo `.env`. Anuncios y eventos empiezan vacíos y se leen desde Supabase, por lo que se comparten entre navegadores.

## Seguridad
La Publishable key y la URL de Supabase son públicas por diseño y pueden aparecer en el código fuente. La seguridad depende de RLS: el SQL conserva lectura pública y permite escrituras solo a usuarios autenticados cuyo `app_metadata.role` sea `admin`. Nunca publiques una Secret/service-role key.

Para configurar el administrador:
1. Ejecuta de nuevo `supabase.sql` en el SQL Editor de Supabase para eliminar las escrituras anónimas y aplicar las políticas nuevas.
2. En Authentication, crea/invita al usuario que administrará el panel y confirma su correo si es necesario.
3. Desde una herramienta de administración de confianza (por ejemplo, el editor de usuarios del Dashboard o un backend seguro), asigna al usuario el `app_metadata` `{"role":"admin"}`. No uses `user_metadata` para autorizar escrituras: el propio usuario puede modificarlo.
4. Inicia sesión en `admin.html` con ese usuario. Otros usuarios autenticados podrán leer el contenido, pero no modificarlo.

El rol debe asignarse mediante Supabase Dashboard o un backend protegido; nunca incluyas una Secret/service-role key en los archivos publicados.

El SQL crea una fila de configuración inicial con el reproductor Caster.fm. Los eventos y anuncios no contienen datos de demostración.


## Informacion 
