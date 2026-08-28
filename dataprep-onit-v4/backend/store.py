import pandas as pd
from typing import Optional

# In-memory store: job_id -> { df, meta }
_jobs: dict = {}

def save(job_id: str, df: pd.DataFrame, meta: dict):
    _jobs[job_id] = {"df": df, "meta": meta}

def get(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id)

def get_df(job_id: str) -> Optional[pd.DataFrame]:
    job = _jobs.get(job_id)
    return job["df"] if job else None

def all_jobs():
    return _jobs
