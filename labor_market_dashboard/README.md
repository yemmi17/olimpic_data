# Labor Market Dashboard

Прототип Streamlit + Plotly для исследования рынка труда региона по данным вакансий.

## Запуск

```powershell
python -m pip install -r requirements-labor-market.txt
python -m streamlit run labor_market_dashboard/app.py
```

Production/Docker Compose instructions are in:

```text
labor_market_dashboard/DEPLOYMENT.md
```

Non-technical user documentation is in:

```text
labor_market_dashboard/USER_GUIDE.md
```

По умолчанию приложение использует небольшой локальный sample:

```text
labor_market_dashboard/sample_vacancies.csv
```

Для полного датасета скачайте CSV «Работа России» и положите его сюда:

```text
data/vacancy.csv
```

Файл `data/vacancy.csv` исключен из git, потому что он может быть большим и регулярно обновляться.

## Что анализируется

- вакансии без опыта по отраслям;
- пропорции спроса на начинающих специалистов;
- динамика публикации вакансий;
- распределение зарплат;
- возможный отток кадров в другие регионы по профессиям;
- gap между выпускниками вузов и спросом работодателей через загружаемую CSV-таблицу.

## Формат данных выпускников

Для блока диспропорций можно загрузить CSV с колонками:

```text
specialty,graduates
```

Например:

```csv
specialty,graduates
Junior analyst,120
Process engineer,80
Teacher,160
```
