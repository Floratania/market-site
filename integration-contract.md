# Контракт залишків і заявок

## Read-only inventory endpoint

`GET <INVENTORY_API_URL>?skus=SKU-1,SKU-2`

```json
{
  "items": [
    { "sku": "SKU-1", "location": "mamaivtsi", "quantity": 12, "updatedAt": "2026-10-07T12:00:00Z" },
    { "sku": "SKU-1", "location": "magala", "quantity": 3, "updatedAt": "2026-10-07T12:00:00Z" }
  ]
}
```

`quantity` має означати вільний до продажу залишок у одиницях відповідного SKU. Фізичний залишок, резерви, замовлення постачальникам і доступність під замовлення не можна змішувати. Точне правило визначається після перевірки регістрів 1С. Посилання складських підрозділів 1С ще не зіставлені з `mamaivtsi` та `magala`.

Endpoint має повертати лише дані запитаних SKU й не розкривати внутрішні ціни, контрагентів або реквізити БД. Токен bridge не передається браузеру.

Сайт приймає залишки лише з коректним `updatedAt`, за замовчуванням не старші за 120 секунд. Порожній перелік означає відсутність доступного залишку для запитаних SKU. За помилки bridge або застарілих даних самовивіз не підтверджується.

## Manager webhook

`POST <MANAGER_WEBHOOK_URL>` із JSON. Сервер передає `Idempotency-Key` та, за налаштуванням, `Authorization: Bearer <secret>`.

```json
{
  "id": "uuid",
  "createdAt": "ISO timestamp",
  "channel": "website",
  "customer": { "name": "Ім’я", "phone": "+380…" },
  "delivery": "pickup",
  "location": "mamaivtsi",
  "comment": "",
  "lines": [{ "sku": "SKU-1", "quantity": 2, "name": "Назва", "variantName": "Варіант", "unitPrice": 150, "currency": "UAH" }]
}
```

Для узгодження отримання з менеджером `delivery=manager`, `location=null`. Відповідь HTTP 2xx повинна означати, що заявка надійно збережена для менеджера. Сайт не створює резерв у 1С і не обіцяє покупцю підтверджене замовлення; це наступний крок менеджера.
