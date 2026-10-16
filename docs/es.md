# Atmo France

## Presentación

Esta integración trae a Gladys el **índice oficial francés de calidad del aire ATMO**, para uno a tres municipios: el índice de hoy y de mañana, los subíndices de los cinco contaminantes (NO₂, O₃, PM10, PM2,5, SO₂), los **episodios de contaminación** anunciados para el departamento y, si lo desea, el **riesgo de alergia al polen**. Cada municipio se convierte en un dispositivo que puede mostrar en un panel y usar en escenas.

Los datos proceden de **Atmo Data**, el servicio de datos abiertos de la Fédération Atmo France y de las asociaciones regionales de vigilancia de la calidad del aire (AASQA). Se publican una vez al día, a primera hora de la tarde. La integración los lee dos veces al día (hacia las 07:30 y las 15:30, hora de París) y los conserva, de modo que un reinicio no cuesta ninguna petición.

Es una integración **en la nube**: contacta con `admindata.atmo-france.org` con su cuenta, y con `geo.api.gouv.fr` (el servicio abierto de municipios del Estado francés) para encontrar el municipio de su casa.

## Requisitos previos

- Gladys Assistant 5.2.0 o posterior.
- Una cuenta gratuita de Atmo Data. Solicítela en <https://admindata.atmo-france.org/inscription-api>: Atmo France valida la solicitud por correo, normalmente en unos días, y después elige su contraseña.
- La ubicación de su casa en Gladys (Ajustes > Casas), o el nombre del municipio que seguir. Están cubiertos los municipios de la Francia continental, Córcega y ultramar.

## Configuración

| Campo                | Qué introducir                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Usuario, Contraseña  | La cuenta de Atmo Data.                                                                          |
| Casa                 | Una casa de Gladys: su ubicación da el municipio.                                                |
| O un municipio       | «Mâcon», «71000», «Saint-Denis 93200» o el código INSEE. Si se rellena, prevalece sobre la casa. |
| Lugar 2, Lugar 3     | Otros municipios (segunda residencia, trabajo, colegio). Opcional.                               |
| Polen                | Leer también el riesgo de polen. Cambiarlo añade o quita funciones: actualice los dispositivos.  |
| Idioma de los textos | Nombres de los dispositivos, calidad del aire en texto y resúmenes de las escenas.               |

Guarde: el estado en la parte superior de la página muestra los municipios encontrados, la calidad del aire de hoy y la hora de la próxima lectura. **Leer ahora** vuelve a leer de inmediato (como mucho cada 10 minutos).

## Uso

### Dispositivos

En la pestaña **Descubrir**, cree el dispositivo «Calidad del aire …» de cada municipio. Contiene:

- el índice ATMO de hoy y de mañana, de 1 (buena) a 6 (extremadamente mala), y la calidad del aire en texto;
- el subíndice de cada contaminante hoy, de 1 a 6: un nivel, no una concentración en µg/m³;
- el episodio de contaminación del departamento hoy y mañana: 0 ninguno, 1 información y recomendaciones, 2 alerta por persistencia, 3 alerta (mostrado por Gladys como riesgo nulo, bajo, medio o alto);
- con el polen: el índice de polen de hoy y de mañana, el polen principal y el nivel de ambrosía, artemisa, aliso, abedul, gramíneas y olivo hoy.

Cuando Atmo France no tiene valor para un día, o anuncia un evento especial (un incendio), no se publica nada. La insignia del índice se queda en verde en Gladys sea cual sea su valor (Gladys la colorea según la escala estadounidense, de 0 a 500): use los widgets para ver los colores correctos. Las funciones de «mañana» conservan la previsión anterior entre la medianoche y la lectura de la tarde.

### Widgets del panel

![El widget Calidad del aire para Bordeaux (subíndices, hoy y mañana, episodios, polen) y el widget Polen (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-atmo-france/main/docs/assets/widgets.es.png)

- **Calidad del aire**: los subíndices de hoy, una tarjeta para hoy y otra para mañana (tóquela para ver el detalle), los episodios, el polen, la fuente y la hora de actualización.
- **Polen**: el riesgo hoy y mañana y el nivel de cada taxón.

Elija el municipio en los ajustes del widget (vacío: el primero).

### Escenas

Disparadores, una vez por cambio y nunca dos veces para el mismo día:

- **Atmo: calidad del aire degradada**: el índice de hoy o de mañana llega a «Moderada» o peor, o empeora de nuevo.
- **Atmo: episodio de contaminación**: se anuncia un procedimiento de información o alerta, o sube de nivel.
- **Atmo: riesgo de polen**: el riesgo de polen llega a «Moderado» o más, o sube.
- **Atmo: previsión de mañana**: publicada una vez al día, por la tarde.

Cada uno ofrece una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (nivel, contaminantes, polen…). La acción **Atmo: leer la calidad del aire** devuelve los mismos valores para hoy o mañana, para un mensaje o una condición.

Ejemplos:

- Cuando se anuncia un episodio de alerta para mañana → enviar el resumen a la familia.
- Cuando se publica la previsión de mañana → enviarla cada tarde.
- Cuando las gramíneas están altas → cerrar las persianas del dormitorio.

### Transporte

Solo nube: los datos vienen de Internet (Atmo Data y geo.api.gouv.fr). Solo su cuenta, las coordenadas de la casa elegida y los municipios salen de su red.

## Solución de problemas

- **«rechazó el usuario o la contraseña»**: compruébelos y que Atmo France haya validado su cuenta (correo de validación). Una contraseña rechazada no se vuelve a probar antes de la lectura siguiente.
- **«Municipio no encontrado»**: la casa no tiene ubicación, o el nombre es ambiguo: escriba «nombre código postal» o el código INSEE.
- **Sin valor para un municipio**: algunas regiones solo publican por mancomunidad, que la integración lee entonces en su lugar; un valor puede faltar unas horas alrededor de la actualización diaria.
- **«demasiadas peticiones»**: Atmo Data pidió esperar; la integración espera el tiempo indicado.
- **Para informar de un problema**: pulse **Diagnóstico** y copie las líneas que empiezan por «Atmo diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración. No contienen ni su usuario ni su contraseña.
