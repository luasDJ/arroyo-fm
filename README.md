# Arroyo FM — Web de radio

## Incluye
- Página pública con diseño oscuro moderno.
- Reproductor Caster.fm usando el código facilitado.
- Selector de GoCast mediante URL externa o iframe.
- Panel sin login que lee y guarda la configuración en Supabase.

## Publicación y Supabase
1. Ejecuta `supabase.sql` en el SQL Editor de tu proyecto Supabase.
2. Publica los archivos de este repositorio desde la raíz en GitHub Pages.
3. Configura la URL del proyecto y su Publishable key en los bloques de configuración de `index.html` y `admin.html`.

La Publishable key está diseñada para uso en el navegador. Nunca la sustituyas por una `SUPABASE_SECRET_KEY` ni publiques el archivo `.env`. Anuncios y eventos empiezan vacíos y se leen desde Supabase, por lo que se comparten entre navegadores.

## Seguridad
El panel solicita el código `1234567` cada vez que se abre. Este código está en `admin.js`, por lo que no es una medida de seguridad real en GitHub Pages; para producción debe sustituirse por autenticación de Supabase o un backend.

El SQL de esta versión permite lectura y escritura anónimas para que el panel estático funcione. Cualquier persona puede cambiar la emisión o publicar/eliminar contenido aunque el panel pida un código. Para producción, protege las escrituras con autenticación de administrador y políticas RLS; conserva la lectura pública con la Publishable key.

El SQL crea una fila de configuración inicial con el reproductor Caster.fm. Los eventos y anuncios no contienen datos de demostración.
