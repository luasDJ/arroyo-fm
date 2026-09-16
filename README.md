# Arroyo FM — Web de radio

## Incluye
- Página pública con diseño oscuro moderno.
- Reproductor Caster.fm usando el código facilitado.
- Selector de GoCast mediante URL externa o iframe.
- Panel de demostración que guarda la configuración en `localStorage`.

## Importante
Esta versión es un prototipo estático. La contraseña está dentro del JavaScript y no ofrece seguridad real. Además, los cambios se guardan solo en el navegador donde se realizan.

Para que el cambio de reproductor se aplique a todos los oyentes, hay que conectar el panel a un backend/autenticación, por ejemplo Supabase o Firebase, y proteger las credenciales mediante reglas de seguridad.

## Publicar en GitHub Pages
1. Crea un repositorio en GitHub.
2. Sube todos los archivos de esta carpeta a la rama principal.
3. Ve a Settings > Pages.
4. Selecciona Deploy from a branch.
5. Elige la rama principal y la carpeta `/root`.
6. Guarda y abre la URL que GitHub Pages te indique.

- `logo.png` — Logo proporcionado para Arroyo FM.
