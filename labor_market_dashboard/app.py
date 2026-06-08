from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

from data_loader import DEFAULT_FULL_DATASET, available_dataset_path, build_graduate_gap, load_vacancies


st.set_page_config(page_title="Рынок труда региона", layout="wide")

@st.cache_data(show_spinner=False)
def cached_load(path: str) -> pd.DataFrame:
    return load_vacancies(path)


def main() -> None:
    st.title("Рынок труда и востребованность кадров региона")
    st.caption("Прототип Streamlit + Plotly: очистка зарплат, опыта и дат, фильтры, графики и сводная таблица.")

    dataset_path = available_dataset_path()
    uploaded = st.sidebar.file_uploader("CSV вакансий", type=["csv"])
    vacancies = load_vacancies(uploaded) if uploaded else cached_load(str(dataset_path))
    source_label = uploaded.name if uploaded else str(dataset_path)
    st.sidebar.info(f"Источник данных: {source_label}")
    if not uploaded and dataset_path != DEFAULT_FULL_DATASET:
        st.sidebar.warning("Используется sample. Для полного анализа положите data/vacancy.csv или загрузите CSV.")

    filtered = render_filters(vacancies)
    render_kpis(filtered)
    render_charts(filtered)
    render_pivot(filtered)
    render_outflow(filtered)
    render_graduate_gap(filtered)


def render_filters(vacancies: pd.DataFrame) -> pd.DataFrame:
    st.sidebar.header("Фильтры")

    regions = sorted(vacancies["region"].dropna().unique())
    default_region = [region for region in regions if "vladimir" in region.lower() or "владимир" in region.lower()]
    selected_regions = st.sidebar.multiselect("Регион", regions, default=default_region or regions[:1])

    industries = sorted(vacancies["industry"].dropna().unique())
    selected_industries = st.sidebar.multiselect("Отрасль", industries, default=industries)

    experiences = sorted(vacancies["experience"].dropna().unique())
    selected_experience = st.sidebar.multiselect("Опыт", experiences, default=experiences)

    keyword = st.sidebar.text_input("Профессия содержит")

    min_salary = int(vacancies["salary_avg"].dropna().min()) if vacancies["salary_avg"].notna().any() else 0
    max_salary = int(vacancies["salary_avg"].dropna().max()) if vacancies["salary_avg"].notna().any() else 0
    salary_range = st.sidebar.slider("Средняя зарплата", min_salary, max_salary, (min_salary, max_salary), step=5000)

    min_date = vacancies["published_at"].min().date()
    max_date = vacancies["published_at"].max().date()
    date_range = st.sidebar.date_input("Дата публикации", value=(min_date, max_date), min_value=min_date, max_value=max_date)

    filtered = vacancies[
        vacancies["region"].isin(selected_regions)
        & vacancies["industry"].isin(selected_industries)
        & vacancies["experience"].isin(selected_experience)
        & vacancies["salary_avg"].between(salary_range[0], salary_range[1], inclusive="both")
    ].copy()

    if len(date_range) == 2:
        start_date, end_date = pd.to_datetime(date_range[0]), pd.to_datetime(date_range[1])
        filtered = filtered[filtered["published_at"].between(start_date, end_date)]

    if keyword:
        filtered = filtered[filtered["profession"].str.contains(keyword, case=False, na=False)]

    return filtered


def render_kpis(vacancies: pd.DataFrame) -> None:
    total = len(vacancies)
    no_exp = int(vacancies["is_no_experience"].sum())
    median_salary = vacancies["salary_avg"].median()

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Вакансий", f"{total:,}".replace(",", " "))
    col2.metric("Без опыта", f"{no_exp:,}".replace(",", " "))
    col3.metric("Доля без опыта", f"{no_exp / total:.1%}" if total else "0%")
    col4.metric("Медианная зарплата", f"{median_salary:,.0f} ₽".replace(",", " ") if pd.notna(median_salary) else "н/д")


def render_charts(vacancies: pd.DataFrame) -> None:
    st.subheader("Спрос на начинающих специалистов")
    no_exp = vacancies[vacancies["is_no_experience"]]

    col1, col2 = st.columns(2)
    industry_counts = no_exp["industry"].value_counts().head(15).reset_index()
    industry_counts.columns = ["industry", "vacancies"]
    col1.plotly_chart(
        px.bar(industry_counts, x="vacancies", y="industry", orientation="h", title="Вакансии без опыта по отраслям"),
        use_container_width=True,
    )

    exp_counts = vacancies["experience"].value_counts().reset_index()
    exp_counts.columns = ["experience", "vacancies"]
    col2.plotly_chart(
        px.pie(exp_counts, names="experience", values="vacancies", hole=0.45, title="Пропорции по требуемому опыту"),
        use_container_width=True,
    )

    col3, col4 = st.columns(2)
    monthly = vacancies.groupby("month", as_index=False).size().rename(columns={"size": "vacancies"})
    col3.plotly_chart(px.line(monthly, x="month", y="vacancies", markers=True, title="Динамика публикации вакансий"), use_container_width=True)

    salary_df = vacancies.dropna(subset=["salary_avg"])
    col4.plotly_chart(px.box(salary_df, x="experience", y="salary_avg", color="experience", title="Зарплаты по опыту"), use_container_width=True)


def render_pivot(vacancies: pd.DataFrame) -> None:
    st.subheader("Сводная таблица")
    pivot = pd.pivot_table(
        vacancies,
        index="industry",
        columns="experience",
        values="profession",
        aggfunc="count",
        fill_value=0,
        margins=True,
        margins_name="Итого",
    )
    st.dataframe(pivot, use_container_width=True)


def render_outflow(vacancies: pd.DataFrame) -> None:
    st.subheader("Гипотеза оттока кадров в другие регионы")
    home_regions = [region for region in vacancies["region"].unique() if "vladimir" in region.lower() or "владимир" in region.lower()]
    if not home_regions:
        st.info("В текущем срезе нет Владимирской области. Выберите ее в фильтрах или загрузите полный CSV.")
        return

    home = vacancies[vacancies["region"].isin(home_regions)]
    outside = vacancies[~vacancies["region"].isin(home_regions)]
    home_salary = home.groupby("profession", as_index=False).agg(home_median_salary=("salary_avg", "median"))
    outside_salary = outside.groupby("profession", as_index=False).agg(outside_median_salary=("salary_avg", "median"), outside_vacancies=("profession", "size"))
    comparison = outside_salary.merge(home_salary, on="profession", how="left")
    comparison["salary_delta"] = comparison["outside_median_salary"] - comparison["home_median_salary"]
    comparison = comparison.dropna(subset=["salary_delta"]).sort_values(["salary_delta", "outside_vacancies"], ascending=False).head(15)

    st.dataframe(comparison, use_container_width=True)
    if not comparison.empty:
        st.plotly_chart(
            px.bar(comparison, x="salary_delta", y="profession", orientation="h", title="Профессии с более высокой медианной зарплатой вне региона"),
            use_container_width=True,
        )


def render_graduate_gap(vacancies: pd.DataFrame) -> None:
    st.subheader("Вузы: кого выпускаем и кто нужен")
    uploaded = st.file_uploader("CSV выпускников: specialty, graduates", type=["csv"], key="graduates")
    if not uploaded:
        st.caption("Загрузите CSV выпускников, чтобы посчитать диспропорции между выпуском и спросом работодателей.")
        return

    graduates = pd.read_csv(uploaded)
    gap = build_graduate_gap(vacancies, graduates)
    st.dataframe(gap, use_container_width=True)
    st.plotly_chart(
        px.bar(
            gap.head(20),
            x="gap_vacancies_minus_graduates",
            y="specialty",
            orientation="h",
            title="Разрыв: вакансии минус выпускники",
        ),
        use_container_width=True,
    )


if __name__ == "__main__":
    main()
