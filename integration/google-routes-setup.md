# Google Maps: найближча точка за маршрутом

1. У Google Cloud Console створіть або оберіть проєкт, підключіть billing і ввімкніть **Routes API**.
2. Створіть ключ API. У **API restrictions** залиште лише Routes API. Для серверних запитів задайте **IP addresses** з публічною вихідною IP-адресою сервера (для локальної перевірки — поточною зовнішньою IP цього комп’ютера). Обмеження Website referrers тут не підходить: запити надсилає Node-сервер.
3. Задайте денну квоту Routes API й сповіщення про бюджет у Google Cloud. Сповіщення про бюджет саме по собі не блокує витрати.
4. Відкрийте `C:\market bot\storefront\integration\routing.local.json` і локально впишіть ключ у `googleApiKey`. `provider` уже дорівнює `google`.
5. Оновіть сайт і натисніть «Знайти найближчу за маршрутом». Дозвольте геолокацію. Сайт порівняє довжини автомобільних маршрутів до Мамаївців і Буди; час орієнтовний, без поточних заторів.

На Linux можна передати ключ змінною `GOOGLE_ROUTES_API_KEY` замість файла. Ключ не віддається браузеру. Координати надсилаються Google тільки після натискання кнопки; на сайті не зберігаються.

Налаштування Google: https://developers.google.com/maps/documentation/routes/get-api-key

Квоти й billing: https://developers.google.com/maps/documentation/routes/usage-and-billing

Метод для порівняння: https://developers.google.com/maps/documentation/routes/compute_route_matrix
