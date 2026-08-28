import pandas as pd
import json
import sqlite3
import io

ALLOWED = {'csv', 'xlsx', 'xls', 'json'}

def allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED

def load_file(file, filename=None) -> pd.DataFrame:
    name = filename or file.filename
    ext = name.rsplit('.', 1)[1].lower()
    if ext == 'csv':
        return pd.read_csv(file)
    elif ext in ('xlsx', 'xls'):
        return pd.read_excel(file, engine='openpyxl')
    elif ext == 'json':
        data = json.load(file)
        if isinstance(data, list):
            return pd.DataFrame(data)
        return pd.DataFrame([data])
    raise ValueError(f"Unsupported format: {ext}")

def load_sql(path: str, query: str) -> pd.DataFrame:
    conn = sqlite3.connect(path)
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def export_bytes(df: pd.DataFrame, fmt: str) -> tuple[bytes, str, str]:
    if fmt == 'csv':
        return df.to_csv(index=False).encode(), 'text/csv', 'csv'
    elif fmt == 'excel':
        buf = io.BytesIO()
        df.to_excel(buf, index=False, engine='openpyxl')
        return buf.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'
    elif fmt == 'json':
        return df.to_json(orient='records', indent=2).encode(), 'application/json', 'json'
    raise ValueError(f"Unsupported export format: {fmt}")

def df_preview(df: pd.DataFrame) -> dict:
    return {
        "preview": df.head(10).fillna("").astype(str).to_dict(orient='records'),
        "columns": list(df.columns),
        "dtypes": {c: str(t) for c, t in df.dtypes.items()},
        "shape": {"rows": len(df), "cols": len(df.columns)}
    }
