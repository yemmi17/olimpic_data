from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterable

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FULL_DATASET = PROJECT_ROOT / "data" / "vacancy.csv"
DEFAULT_SAMPLE_DATASET = Path(__file__).resolve().with_name("sample_vacancies.csv")


@dataclass(frozen=True)
class ColumnMap:
    region: str
    industry: str
    profession: str
    experience: str
    salary_min: str | None
    salary_max: str | None
    salary_text: str | None
    published_at: str
    company: str | None


COLUMN_CANDIDATES = {
    "region": ("region", "regionName", "region_name", "area", "area_name", "subject", "subject_rf"),
    "industry": (
        "industry",
        "industryName",
        "industry_name",
        "professionalSphereName",
        "company_business_size",
        "category",
        "professionalSphere",
        "professional_sphere",
        "industryBranchName",
    ),
    "profession": (
        "profession",
        "job-name",
        "job_name",
        "name",
        "vacancyName",
        "vacancy_name",
        "position",
        "specialisation",
        "typicalPosition",
    ),
    "experience": ("experience", "required_experience", "experienceRequirements", "experience_requirements"),
    "salary_min": ("salary_min", "salary_from", "payment_from", "min_salary", "salaryMin"),
    "salary_max": ("salary_max", "salary_to", "payment_to", "max_salary", "salaryMax"),
    "salary_text": ("salary", "salary_text", "payment", "compensation"),
    "published_at": (
        "published_at",
        "datePublished",
        "creation-date",
        "creation_date",
        "date",
        "published",
        "date_publish",
        "creationDate",
    ),
    "company": ("fullCompanyName", "company", "company_name", "employer", "employer_name", "organization"),
}


def available_dataset_path() -> Path:
    return DEFAULT_FULL_DATASET if DEFAULT_FULL_DATASET.exists() else DEFAULT_SAMPLE_DATASET


def load_vacancies(csv_path: Path | str | BinaryIO | None = None) -> pd.DataFrame:
    source = Path(csv_path) if isinstance(csv_path, str) else csv_path

    if isinstance(source, Path) or source is None:
        path = source or available_dataset_path()
        delimiter = detect_delimiter(path)
        header = pd.read_csv(path, sep=delimiter, nrows=0, encoding="utf-8")
        column_map = infer_columns(header.columns)
        df = pd.read_csv(
            path,
            sep=delimiter,
            usecols=selected_columns(column_map),
            encoding="utf-8",
            low_memory=False,
        )
    else:
        df = pd.read_csv(source, sep=None, engine="python")
        column_map = infer_columns(df.columns)

    return clean_vacancies(df, column_map)


def infer_columns(columns: Iterable[str]) -> ColumnMap:
    normalized = {normalize_column(column): column for column in columns}

    def pick(key: str, required: bool = True) -> str | None:
        for candidate in COLUMN_CANDIDATES[key]:
            match = normalized.get(normalize_column(candidate))
            if match:
                return match
        if required:
            expected = ", ".join(COLUMN_CANDIDATES[key])
            raise ValueError(f"Не найдена обязательная колонка '{key}'. Ожидались варианты: {expected}")
        return None

    return ColumnMap(
        region=pick("region"),
        industry=pick("industry"),
        profession=pick("profession"),
        experience=pick("experience"),
        salary_min=pick("salary_min", required=False),
        salary_max=pick("salary_max", required=False),
        salary_text=pick("salary_text", required=False),
        published_at=pick("published_at"),
        company=pick("company", required=False),
    )


def clean_vacancies(df: pd.DataFrame, column_map: ColumnMap) -> pd.DataFrame:
    cleaned = pd.DataFrame(
        {
            "region": normalize_text_series(df[column_map.region]),
            "industry": normalize_text_series(df[column_map.industry]).fillna("Не указана"),
            "profession": normalize_text_series(df[column_map.profession]).fillna("Не указана"),
            "experience": normalize_experience(df[column_map.experience]),
            "published_at": parse_dates(df[column_map.published_at]),
        }
    )

    cleaned["company"] = (
        normalize_text_series(df[column_map.company]).fillna("Не указана") if column_map.company else "Не указана"
    )

    salary_min = parse_numeric_salary(df[column_map.salary_min]) if column_map.salary_min else pd.Series(pd.NA, index=df.index)
    salary_max = parse_numeric_salary(df[column_map.salary_max]) if column_map.salary_max else pd.Series(pd.NA, index=df.index)

    if column_map.salary_text and salary_min.isna().all() and salary_max.isna().all():
        salary_min, salary_max = parse_salary_range(df[column_map.salary_text])

    cleaned["salary_min"] = salary_min
    cleaned["salary_max"] = salary_max
    cleaned["salary_avg"] = cleaned[["salary_min", "salary_max"]].mean(axis=1, skipna=True)
    cleaned["salary_avg"] = cleaned["salary_avg"].where(cleaned["salary_avg"].notna(), cleaned["salary_min"])
    cleaned["is_no_experience"] = cleaned["experience"].eq("Без опыта")
    cleaned["month"] = cleaned["published_at"].dt.to_period("M").astype("string")

    return cleaned.dropna(subset=["region", "published_at"]).reset_index(drop=True)


def normalize_column(value: str) -> str:
    return "".join(char for char in str(value).lower() if char.isalnum())


def normalize_text_series(series: pd.Series) -> pd.Series:
    return series.astype("string").str.strip().replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})


def normalize_experience(series: pd.Series) -> pd.Series:
    values = normalize_text_series(series).str.lower()

    def normalize(value: str | pd.NA) -> str:
        if pd.isna(value):
            return "Не указан"
        text = str(value)
        if text in {"0", "0.0"} or "без" in text or "no experience" in text or "doesnt matter" in text:
            return "Без опыта"
        if text in {"1", "2", "3"} or ("1" in text and "3" in text):
            return "1-3 года"
        if text in {"4", "5", "6"} or ("3" in text and ("6" in text or "лет" in text)):
            return "3-6 лет"
        if text.isdigit() and int(text) > 6 or "6" in text or "more" in text:
            return "6+ лет"
        return str(value).strip().capitalize()

    return values.map(normalize).astype("string")


def parse_numeric_salary(series: pd.Series) -> pd.Series:
    values = (
        series.astype("string")
        .str.replace(r"[^\d,.-]", "", regex=True)
        .str.replace(",", ".", regex=False)
        .replace({"": pd.NA})
    )
    return pd.to_numeric(values, errors="coerce")


def detect_delimiter(path: Path) -> str:
    first_line = path.open("r", encoding="utf-8", errors="ignore").readline()
    return "|" if first_line.count("|") > first_line.count(",") else ","


def selected_columns(column_map: ColumnMap) -> list[str]:
    return list(dict.fromkeys(column for column in column_map.__dict__.values() if column))


def parse_dates(series: pd.Series) -> pd.Series:
    try:
        parsed = pd.to_datetime(series, errors="coerce", format="mixed", dayfirst=True)
    except TypeError:
        parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)

    if getattr(parsed.dt, "tz", None) is not None:
        return parsed.dt.tz_localize(None)
    return parsed


def parse_salary_range(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    extracted = series.astype("string").str.extractall(r"(\d[\d\s]*(?:[,.]\d+)?)")[0]
    extracted = extracted.str.replace(" ", "", regex=False).str.replace(",", ".", regex=False)
    numbers = pd.to_numeric(extracted, errors="coerce").groupby(level=0).agg(list)

    salary_min = pd.Series(pd.NA, index=series.index, dtype="Float64")
    salary_max = pd.Series(pd.NA, index=series.index, dtype="Float64")
    for idx, values in numbers.items():
        if not values:
            continue
        salary_min.loc[idx] = min(values)
        salary_max.loc[idx] = max(values)
    return salary_min, salary_max


def build_graduate_gap(vacancies: pd.DataFrame, graduates: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"specialty", "graduates"}
    missing = required_columns.difference(graduates.columns)
    if missing:
        raise ValueError(f"В CSV выпускников нет колонок: {', '.join(sorted(missing))}")

    demand = (
        vacancies.groupby("profession", as_index=False)
        .agg(vacancies=("profession", "size"), median_salary=("salary_avg", "median"))
        .rename(columns={"profession": "specialty"})
    )
    supply = graduates.copy()
    supply["specialty"] = supply["specialty"].astype("string").str.strip()
    supply["graduates"] = pd.to_numeric(supply["graduates"], errors="coerce").fillna(0).astype(int)

    result = supply.merge(demand, on="specialty", how="outer").fillna({"graduates": 0, "vacancies": 0})
    result["gap_vacancies_minus_graduates"] = result["vacancies"] - result["graduates"]
    return result.sort_values("gap_vacancies_minus_graduates", ascending=False)
