# CloudWatch — mapa de logs y consultas

Cuenta de staging `790714449507`, región `us-east-2`. Acceso de solo lectura.

## Contenido

1. Log groups de staging y cuándo abrir cada uno
2. Eventos clave de payment-stg
3. Eventos clave de payconnect-stg
4. Consultas de Logs Insights para el histórico
5. Trampas conocidas

---

## 1. Log groups de staging

| Log group                                | Qué contiene                                                                   | Cuándo abrirlo                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `/ecs/payment-stg`                       | Orquestador del pago: contexto, routing, invoice, estado final, webhook        | **Siempre.** Da el `trace_id`                                          |
| `/ecs/payconnect-stg`                    | Conector con el PSP: request real (`resulting_curl`), respuesta cruda, mapping | **Siempre.** Es donde se ve al tercero                                 |
| `/ecs/payconnect-hub-stg`                | Integration Hub (templates de algunos PSP)                                     | payconnect delega al hub o no hay `resulting_curl`                     |
| `/ecs/guard-stg`                         | Antifraude (Sift, Signifyd, Clearsale, Cybersource DM)                         | El pago cae en fraude o `tl_fraud_analysis` no es `automatic_decision` |
| `/ecs/vault-stg`, `/ecs/vault-proxy-stg` | Tokenización de tarjeta                                                        | Errores de card token / vault antes de llegar al PSP                   |
| `/ecs/pay-routing-stg`                   | Reglas de routing                                                              | El PSP elegido no es el esperado                                       |
| `/ecs/ema-stg`                           | Órdenes (tokenize, estado de orden)                                            | Falla antes del purchase (tokenize, order)                             |
| `/ecs/webhooks-stg`                      | Webhooks salientes al merchant                                                 | El pago está bien pero el merchant/test no se entera                   |
| `/ecs/payment-worker-stg`                | Jobs asíncronos (polling, void async)                                          | Estado que cambia minutos después                                      |

Lista completa: `aws logs describe-log-groups --log-group-name-prefix /ecs/ --query 'logGroups[].logGroupName'`.

## 2. Eventos clave de payment-stg (campo `message`)

| Evento                                                                  | Qué dice                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `purchase_context`                                                      | Monto, tarjeta enmascarada, store. Trae `trace_id`                                     |
| `tl_routing_generated`                                                  | PSP elegido (`payment_processor_name`)                                                 |
| `building_purchase_transaction_request`                                 | Payload que payment manda a payconnect (incluye `BinData`: banco y país de la tarjeta) |
| `response_error_handle` / `credit_card_payconnect_authorize_response`   | Lo que payconnect devolvió, con `gateway_response`                                     |
| `tl_payment_status_updated`                                             | Cada cambio de estado con `error_code` / `error_message` del PSP                       |
| `payment_processor_error_found`                                         | Código del PSP mapeado a un error DEUNA                                                |
| `webhook_payconnect_request_dump` / `payconnect_handle_webhook_request` | Webhook del PSP (flujos asíncronos: PSE, PIX, OXXO…)                                   |
| `invoice_status_denied_and_no_deuna_error_object`                       | Denegado sin objeto de error DEUNA; trae `raw_response` del PSP                        |

Las líneas que empiezan con `[0m[33m[...ms]` son SQL de GORM (INSERT/UPDATE de `invoices`). El
`UPDATE` final trae `raw_response` y `error` completos: útil cuando el resto viene truncado.

## 3. Eventos clave de payconnect-stg

| Evento                                  | Qué dice                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `canonical_request`                     | Request canónico que llegó de payment                                                                                      |
| `config_file_loaded_successfully`       | `path` = PSP y **versión del mapping** (`.../getnet/v1.0.30/config/config.json`)                                           |
| `resulting_curl`                        | **Request literal enviado al PSP** (URL, headers, body con secretos redactados). Un paso por evento (OAuth, autorización…) |
| `response_information`                  | **Respuesta literal del PSP**: `status_code` y `body`                                                                      |
| `transaction_visibility`                | Mismo request/respuesta con `time_request` (latencia del PSP en ms)                                                        |
| `matched_result_map` / `status_matched` | Cómo DEUNA interpretó la respuesta (`result: pending/approved/declined`)                                                   |
| `failed_to_unmarshal_*` (WARN)          | El mapping de DEUNA no pudo leer algo. Candidato a bug DEUNA                                                               |
| `canonical_log_line`                    | Resumen final                                                                                                              |

Campos filtrables directos en Insights: `gateway` / `processor_name`, `transaction_id`, `merchant_id`,
`card_number` (enmascarado, últimos 4), `message`, `body`.

## 4. Consultas de Logs Insights

Guarda la consulta en un archivo y córrela con `cw.py insights <group> --days 7 --query-file q.txt`
(o `--from/--to` para un rango concreto). El costo es por GB escaneado en el rango: un solo log group,
7 días de entrada, y reutiliza la salida en vez de repetir la consulta.

**a) Salud diaria del PSP** (¿desde cuándo? ¿solo una marca?). Cambia `getnet` por el `gateway` del caso
y ajusta los `parse` a los campos del body de ese PSP (mira primero un `response_information`):

```
fields @timestamp
| filter message = "response_information" and gateway = "getnet" and body not like /access_token/
| parse body /"brand":"(?<brand>[A-Z]+)"/
| parse body /"status":"(?<st>[A-Z_]+)"/
| parse body /"reason_code":"(?<rc>[^"]*)"/
| stats count(*) as n, min(@timestamp) as first, max(@timestamp) as last by datefloor(@timestamp, 1d) as day, action, status_code, brand, st, rc
| sort day asc
```

Agrupa siempre por `status_code` (HTTP) y `action` (authorize, capture…), no solo por el estado
del body: los fallos más importantes del tercero (5xx, cortes de conexión) suelen venir sin
`status` ni `brand` en el body, y un filtro por esos campos los esconde. Por ejemplo, el
`HTTP 500 GetnetInternalError: Connection prematurely closed` de Getnet solo trae `status_code`.
Para limitar a la tarjeta del spec, añade `and card_number like /1112$/` (últimos 4).

**b) Lista de transacciones alrededor del corte** (para fijar la hora exacta y elegir el par A/B):

```
fields @timestamp, card_number, merchant_name, transaction_id
| filter message = "response_information" and gateway = "getnet" and body like /VISA/
| parse body /"status":"(?<st>[A-Z_]+)"/
| parse body /"reason_code":"(?<rc>[^"]*)"/
| sort @timestamp asc
| limit 200
```

**c) ¿El mapping de DEUNA falla siempre o solo ahora?**

```
fields @timestamp
| filter gateway = "payu_pse" and message like /failed_to_unmarshal/
| stats count(*) by datefloor(@timestamp, 1d)
```

## 5. Trampas conocidas

- **Ventanas anchas son lentas y caras.** El costo depende del rango escaneado, no del filtro.
  `filter-log-events` sobre 3 días en payconnect-stg supera 5 min. Ubica primero la hora (del
  trace, del reporte o de payment-stg) y busca ±3 min.
- **Ingesta con retraso.** Una transacción de hace segundos puede no estar todavía. Reintenta
  con `--wait 180` en la misma ventana; no amplíes el rango para compensar.
- En payconnect el `transaction_id` no está en todos los eventos: filtra por `trace_id`.
- `response_information` sin `gateway` en el filtro mezcla todos los PSP.
- Sin `datefloor` las stats salen sin tendencia; sin `min/max(@timestamp)` no ves el corte.
- `response_information` incluye también los pasos de OAuth/token del PSP. Exclúyelos con
  `body not like /access_token/`, **no** con `body like /"status"/`: ese filtro también oculta
  los 5xx del tercero, que no traen `status`.
- **Shell:** la Bash del usuario es zsh. Un glob sin coincidencias aborta el comando ("no matches
  found") y `set -- $var` no separa por palabras. Para bucles, usa `bash -c '...'`.
- payment-stg registra en `credit_card_payconnect_authorize_response` los headers `Authorization`
  de Getnet sin enmascarar (formato protobuf `StringValue`). `cw.py` los redacta; si consultas con
  la CLI directa, no copies esa salida.
- Fechas del PSP pueden venir en hora local (Getnet `authorized_at` en UTC-3, PayU `operation_date` en COT).
