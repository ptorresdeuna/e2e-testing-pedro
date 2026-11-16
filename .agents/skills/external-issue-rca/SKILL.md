---
name: external-issue-rca
description: Determina con evidencia de CloudWatch si un test case fallido falla por un tercero externo (PSP, adquirente, banco, antifraude, sandbox del proveedor) o por código de DEUNA, y entrega un RCA con veredicto claro de responsable. Úsala siempre que alguien diga que un test falla "por el PSP", sospeche un external issue, pegue un error de pago (DP-xxxx, declined, rechazado, 422, INTERNAL_PAYMENT_PROVIDER_ERROR, code 05) de un spec, pase un transaction_id o trace_id para revisar en logs, pregunte "¿es nuestro o del proveedor?", o pida revisar payment-stg / payconnect-stg por un test case. Aplica aunque solo den el test case ID y haya que ejecutarlo para obtener el transaction_id.
---

# RCA de external issue: ¿falla el tercero o falla DEUNA?

El objetivo es una sola respuesta clara y demostrada: **quién causa el fallo**. QA usa
este veredicto para decidir si el test queda bloqueado por un proveedor (y se escala
fuera) o si hay un bug de DEUNA que reportar. Un veredicto ambiguo o sin evidencia no
sirve para ninguna de las dos cosas, así que cada afirmación del reporte debe apoyarse
en un log, una respuesta del proveedor o una comparación.

Este flujo es de **solo lectura**: no modifiques el spec, la data de prueba ni la
configuración del merchant. Cambiar la tarjeta o el PSP para que el test pase esconde
el problema y cambia lo que el caso de Zephyr verifica.

Para el mapa de log groups, los eventos de cada servicio y las consultas de Insights,
lee [`references/cloudwatch.md`](references/cloudwatch.md) cuando llegues al paso 3.

## Las consultas a CloudWatch cuestan dinero

CloudWatch cobra por los datos que escanea cada consulta. Lo que decide cuánto se
escanea es **el rango de tiempo y el log group**, no el texto del filtro: buscar un
`transaction_id` en 3 días de payconnect-stg escanea los 3 días completos aunque
devuelva 20 líneas. Por eso:

1. **Toda búsqueda puntual lleva filtro y ancla de tiempo.** Busca por `transaction_id` o `trace_id`, con `--at` y una ventana de ±3 min (`cw.py` exige `--at` y no pasa de 30 min sin `--force`). Si no conoces la hora, sácala antes de buscar: del trace, del reporte de Playwright o del `date -u` de la ejecución. Si el usuario te da un `transaction_id` de una corrida pasada **sin hora** (el UUID no la lleva), pídele la fecha y hora aproximadas de esa corrida, o el link del run de CI. No la adivines ampliando la ventana.
2. **Lo pesado es el histórico (paso 4).** Hazlo **una sola vez**, en un solo log group, empezando por 7 días (`--days 7`). Amplía a 14 solo si el corte no aparece en esos 7 días. Para fijar horas exactas (inicio del problema, recuperación), usa varios rangos `--from/--to` cortos alrededor de cada transición que ya identificaste, en lugar de volver a escanear todo el rango.
3. **No repitas consultas.** Guarda la salida de cada consulta de histórico en tu scratchpad y reutilízala; no la vuelvas a correr para ver otra columna.
4. **Reporta el costo.** `cw.py insights` imprime los GB escaneados. Súmalos y ponlos en el reporte, junto con cualquier `--force` y su motivo.

## Logs que todavía no llegaron

Los logs tardan entre segundos y un par de minutos en aparecer en CloudWatch. Si el
`transaction_id` es de la ejecución que acabas de hacer, o el usuario dice que es de
hace un momento, un resultado vacío **no** significa que la transacción no exista.
Busca con `cw.py find ... --wait 180`: reintenta cada 30 s con la misma ventana corta,
sin ampliarla. Solo si después de 3 minutos sigue vacío, revisa que la hora `--at` esté
en UTC y que el log group sea el correcto.

---

## Entradas

| Entrada                                           | Obligatoria | Si falta                                                                                                                                       |
| ------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Test case ID (p. ej. `PAYM-T2080`)                | Sí          | Pídelo                                                                                                                                         |
| Error de Playwright                               | No          | Sale de ejecutar el test                                                                                                                       |
| `transaction_id` (o `trace_id`) + hora aproximada | No          | Ejecuta el test (paso 1)                                                                                                                       |
| Credenciales AWS con lectura de CloudWatch        | Sí          | Ver abajo                                                                                                                                      |
| Log groups                                        | No          | Por defecto `/ecs/payment-stg` y `/ecs/payconnect-stg`; abre otros de staging según la evidencia (están en la referencia) y dilo en el reporte |

Alcance: **staging** (`api.stg.deuna.io`, cuenta `790714449507`, `us-east-2`).

Verifica el acceso antes de nada:

```bash
aws sts get-caller-identity && aws configure get region
```

Si falla o la sesión SSO expiró, pide al usuario que corra `! aws sso login` (o el perfil
que use) y espera. No sigas sin acceso: el veredicto depende de los logs.

Scripts de la skill (rutas relativas a esta carpeta, `.claude/skills/external-issue-rca/`):

- `scripts/cw.py find|show|insights`: búsqueda en CloudWatch con ventana corta, salida compacta y secretos redactados.
- `scripts/trace_purchase.py <trace.zip>`: extrae del trace el purchase, el `transaction_id` y el estado devuelto.

---

## Paso 0: Leer el spec

Ubica el archivo (`find playwright/tests -name '<ID>.spec.ts'`) y anota:

- PSP / `processor_name`, país, método (tarjeta, PSE, PIX…) y **qué tarjeta o dato de prueba** usa (síguelo hasta `playwright/support/interfaces/`).
- Si el pago va por **UI** (widget, popup, checkout) o por **API** (`paymentService.purchaseV2`, `emaService`…). Esto decide de dónde sale el `transaction_id`.
- Anotaciones (`annotation: { type: 'bug' }`) y comentarios (franjas horarias, sandbox inestable): son pistas de fallos previos.

## Paso 1: Obtener el `transaction_id` y la hora

Si el usuario lo dio, úsalo y salta al paso 2.

Si no, ejecuta el test una vez, sin reintentos y con trace:

```bash
date -u +%FT%TZ
npx playwright test <ID> --project=chromium --trace=on --retries=0 --reporter=line 2>&1 | tail -60
date -u +%FT%TZ
```

**Copia el `trace.zip` en cuanto termine**: la siguiente corrida de cualquier test vacía
`playwright/test-results/`. Playwright acorta el nombre de la carpeta, así que no la
busques por el ID:

```bash
find playwright/test-results -name trace.zip -mmin -15 -exec cp {} <scratchpad>/<ID>-trace.zip \;
```

- **Flujo por UI**: `python3 scripts/trace_purchase.py <copia>/trace.zip` te da el `transaction_id`, el estado que DEUNA devolvió al frontend y campos de alerta (`external_status`, `redirect_url`).
- **Flujo por API** (axios no queda en el trace): busca en el stdout el `merchantId` / `orderToken` impresos o el mensaje del error, y luego encuéntralo en payment-stg con la ventana de la corrida:
  `python3 scripts/cw.py find /ecs/payment-stg <orderToken|merchantId> --at <hora-de-la-corrida>`.

### Si el test pasa

El fallo no se reproduce ahora. Dilo así, sin rodeos, y sigue este camino:

1. Analiza igualmente tu transacción sana (pasos 2 y 3). Así sabes qué eventos, PSP y tarjeta usa el flujo real, y tendrás el lado sano del A/B.
2. Corre el histórico **una vez** (paso 4), filtrando por la tarjeta o el método del spec, y busca los fallos de ese flujo en los últimos 7 días.
3. Si encuentras fallos del tercero, haz el A/B con uno de ellos (paso 5). Eso explica _un_ fallo posible, pero no prueba que sea el fallo que vio el usuario: el veredicto queda en **Probable** como máximo.
4. Pide al usuario el link del run de CI o el `transaction_id` y la hora de una corrida fallida. Solo con eso puedes confirmar.

Usa la variante "No reproducido" del reporte (paso 7).

## Paso 2: payment-stg, el orquestador

```bash
python3 scripts/cw.py find /ecs/payment-stg <transaction_id> --at <hora UTC>
# si la transacción es de hace segundos (la acabas de generar):
python3 scripts/cw.py find /ecs/payment-stg <transaction_id> --at <hora UTC> --wait 180
```

Obtén el **`trace_id`** y responde:

- ¿Llegó a enrutar al PSP esperado (`tl_routing_generated`)?
- ¿Se cortó **antes** del PSP (fraude, vault, routing, validación)? Entonces el tercero ni intervino: abre el log group del servicio que cortó (guard, vault, pay-routing, ema).
- ¿El error es propio o traduce lo que devolvió payconnect (`response_error_handle`, `tl_payment_status_updated` con `error_code` del PSP)?

## Paso 3: payconnect-stg, la frontera con el tercero

```bash
python3 scripts/cw.py find /ecs/payconnect-stg <trace_id> --at <hora UTC>
python3 scripts/cw.py show /ecs/payconnect-stg <trace_id> --at <hora UTC> \
  --messages config_file_loaded_successfully,resulting_curl,response_information,matched_result_map,status_matched
```

Según el PSP, la interpretación de DEUNA aparece como `matched_result_map` (p. ej. PayU)
o como `status_matched` (p. ej. Getnet).

Lee los cuatro eventos en orden. Son el corazón del análisis:

1. **Qué se envió** (`resulting_curl`): ¿el body es correcto para el caso? Monto, moneda, marca, vencimiento, documento, URLs de retorno y webhook. Un campo vacío, mal formado o con un placeholder (`<no value>`) apunta a DEUNA.
2. **Qué respondió el tercero** (`response_information`): status HTTP y body crudo. Distingue:
   - _Procesó y rechazó_: `DENIED`/`DECLINED` con código de emisor (`05`, `51`…) y `acquirer_transaction_id`.
   - _Falló internamente_: excepciones, `INTERNAL_PAYMENT_PROVIDER_ERROR`, `SecurityFault`, 5xx, HTML de Cloudflare.
   - _Nunca respondió_: timeout o error de red, sin `response_information`.
   - _Rechazó el request_: 4xx con error de validación. Revisa si el request de DEUNA era válido antes de culpar al tercero.
3. **Cómo lo interpretó DEUNA** (`matched_result_map` / `status_matched` y los WARN/ERROR como `failed_to_unmarshal_*`): ¿el estado final coincide con lo que dijo el tercero? Antes de marcar un WARN como bug, comprueba si también aparece en los casos sanos y en qué paso ocurre. Por ejemplo, `failed_to_unmarshal_request_body_for_tv` en un paso OAuth (body form-urlencoded) solo afecta a la visibilidad y es ruido.
4. **La versión del mapping** (`config_file_loaded_successfully` → `path`): la necesitas para el A/B.

## Paso 4: Histórico, ¿desde cuándo y a quién afecta?

Una sola transacción no basta para culpar a nadie. Este es el paso caro, así que hazlo
una vez y bien: con Logs Insights sobre 7 días (consulta **a** de la referencia), agrupa
las respuestas del PSP por día y por estado, código y marca:

```bash
python3 scripts/cw.py insights /ecs/payconnect-stg --days 7 --query-file <consulta.txt> | tee <scratchpad>/historico.txt
```

Si en 7 días todo está fallando y no ves el último caso sano, amplía a 14. Para la hora
exacta del corte (consulta **b**), limita el rango a ese día con `--from/--to`.

Busca:

- **El corte**: último caso sano y primer caso con el error (consulta **b** para la hora exacta).
- **El alcance**: ¿solo esta tarjeta o marca, este merchant o `seller_id`, o todo el tráfico del PSP? Si otra marca o método del mismo PSP sigue sano en las mismas horas, eso acota el problema.
- **Episodios previos**: si ya pasó y se recuperó solo, es señal de inestabilidad del proveedor.
- **¿Sigue roto ahora?** Mira hasta el momento actual, no solo hasta tu transacción. Si el tercero ya se recuperó, la acción cambia de "bloquear y escalar" a "volver a ejecutar".

## Paso 5: A/B, la prueba que decide

Toma el **último caso sano** y el **primero fallido** (o el tuyo) y compara con `cw.py show`
(los dos con su `transaction_id`/`trace_id` y su `--at`, que salen de la consulta **b**):
el body del `resulting_curl` (sin IDs por transacción), el endpoint, los headers y la
versión del mapping.

- **Request igual y respuesta distinta**: cambió el tercero → **external** confirmado.
- **Request distinto** (campo nuevo o faltante, otra versión del mapping, otro endpoint): DEUNA cambió algo en ese intervalo. Busca qué (versión de `config_file_loaded_successfully`, `service_version` en payment). Es **DEUNA** hasta que se demuestre lo contrario.
- **Sin caso sano reciente** con el que comparar: el veredicto queda como _probable_, no _confirmado_. Dilo así.

## Paso 6: Veredicto

Clasifica en **una** de estas categorías y asigna el grado de certeza:

| Veredicto                  | Cuándo                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **External (PSP/tercero)** | Request de DEUNA correcto y estable (A/B) y el tercero cambió su respuesta, falla internamente o no responde. Afecta a todo el tráfico de ese PSP/BIN, no solo al test   |
| **DEUNA**                  | Request mal formado, mapping que interpreta mal la respuesta, corte antes del PSP por un servicio de DEUNA, o regresión que coincide con un cambio de versión de DEUNA   |
| **Test / data de prueba**  | El sistema hizo lo correcto con lo que el test le dio: tarjeta que no es de prueba de ese PSP, monto o país inconsistente, merchant mal configurado por el test          |
| **Mixto**                  | Causa principal en un lado y un defecto real en el otro (p. ej. el PSP rechaza y DEUNA traduce mal el rechazo). Nombra al **principal** y al **secundario** por separado |

Certeza: **Confirmado** (A/B + histórico lo demuestran) o **Probable** (consistente pero
sin prueba decisiva; di qué falta para confirmarlo). No presentes como confirmado lo que
es probable: QA va a decidir con esto si escala fuera o abre un bug interno.

## Paso 7: Reporte

Entrégalo **en el chat** y guárdalo en `reports/rca/<ID>-<YYYYMMDD>.md`, donde la fecha es
la de la **transacción fallida**, o la de tu ejecución si el fallo no se reprodujo
(`reports/` está ignorada por git; crea `rca/` si no existe).

**Variante "No reproducido"**: en "Veredicto" empieza con _"No reproducido el <fecha>.
Causa probable: <…>"_, añade una fila "Fallos encontrados en el histórico" a la evidencia
y termina con la pregunta concreta al usuario (link del run de CI o `transaction_id` + hora). Responde en el idioma del usuario. Usa esta plantilla:

```markdown
# RCA <ID>: <título corto del caso>

## Veredicto

**Responsable: <External (<nombre del tercero>) | DEUNA (<servicio>) | Test | Mixto>. <Confirmado | Probable>.**
<Una frase sin jerga: qué falla y dónde.>

## Responsables

- **Principal: <quién>** (<confirmado/probable>). <Por qué, en 1-2 líneas.> **Acción:** <qué hacer y con quién>.
- **Secundario: <quién>** (<confirmado/probable>), solo si existe. <Qué agrava o enmascara.> **Acción:** <…>.
- **No responsable: <quién>.** <Por qué se descarta.>

## Evidencia

| Qué                         | Dato                                                                      |
| --------------------------- | ------------------------------------------------------------------------- |
| Ejecución                   | <fecha/hora UTC, resultado, error de Playwright>                          |
| transaction_id / trace_id   | <…> / <…>                                                                 |
| Request de DEUNA al tercero | <endpoint + campos relevantes; correcto o no>                             |
| Respuesta del tercero       | <HTTP, estado, código, mensaje literal>                                   |
| Interpretación de DEUNA     | <estado mapeado, warnings>                                                |
| Histórico                   | <último sano / primer fallo / alcance / episodios previos>                |
| A/B                         | <qué se comparó y resultado>                                              |
| Costo CloudWatch            | <GB escaneados en Insights, rangos usados, cualquier --force y su motivo> |

## Para escalar

<IDs del lado del tercero: acquirer_transaction_id, orderId, seller_id, merchant del PSP, mensaje literal, inicio del problema en UTC.>

## Qué hacer con el test

<Bloquearlo por external issue (y ligar el ticket) o abrir un bug de DEUNA. No cambiar la data de prueba para que pase.>
```

---

## Cuidado con los datos sensibles

- Nunca copies al reporte API keys, tokens, headers `Authorization`, PAN completos ni CVV. `cw.py` redacta lo que reconoce, pero revisa lo que pegues.
- Si encuentras credenciales **sin enmascarar en los logs** (por ejemplo, un `Authorization: Basic …` en `transaction_visibility`), repórtalo como hallazgo de seguridad aparte, sin reproducir el valor.

## Ejemplos reales

**PAYM-T2080 (Getnet BR, Visa): External, confirmado (episodio ya cerrado).** payconnect
envió a Getnet un request correcto. Getnet respondió HTTP 200 `DENIED 05` con issuer
"Visa Production Support Client Bid 1" y un `acquirer_transaction_id`. Histórico: Visa
`…1112` aprobaba hasta el 27-oct 14:54Z, se rechazó en todos los intentos del 28-oct
03:54Z al 29-oct 14:23Z y volvió a aprobar el 29-oct 21:09Z. Mastercard aprobó durante
todo el episodio. El A/B de tres puntos (último sano antes, el fallido y el primero
sano después) dio body, mapping (`v1.0.30`), endpoint y headers idénticos. Conclusión:
el simulador del emisor Visa del sandbox de Getnet tuvo un episodio. Acción: volver a
ejecutar el test, no bloquearlo.

**ENTP1-T2043 (PayU PSE): Mixto, principal External.** El popup de PSE se cerraba
("Target page… has been closed"). PayU respondió `DECLINED`,
`INTERNAL_PAYMENT_PROVIDER_ERROR`, `SecurityFault: An invalid security token was
provided` (su certificado con PSE/ACH). Histórico: ninguna respuesta sana desde el
20-oct 16:56Z. Secundario, **DEUNA** (probable): payconnect registró
`failed_to_unmarshal_error_mapping_str` y devolvió `pending` con
`redirect_url: "<no value>"` en vez del rechazo. Eso no causa el fallo, pero lo
enmascara.
