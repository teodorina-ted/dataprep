from flask import Blueprint, request, jsonify, send_file
import uuid, io
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer
from utils import allowed, load_file, export_bytes, df_preview
from store import save, get

bp = Blueprint('impute', __name__)

# -- methods --

def impute_basic(df, strategy):
    report = []
    for col in df.columns:
        n = int(df[col].isna().sum())
        if n == 0:
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            v = {"mean": df[col].mean(), "median": df[col].median()}.get(strategy, df[col].mode()[0] if not df[col].mode().empty else 0)
            df[col] = df[col].fillna(round(float(v), 4))
            report.append({"column": col, "filled": n, "method": strategy, "value": round(float(v), 4)})
        else:
            v = df[col].mode()[0] if not df[col].mode().empty else "unknown"
            df[col] = df[col].fillna(v)
            report.append({"column": col, "filled": n, "method": "mode", "value": str(v)})
    return df, report

def impute_knn(df, n_neighbors=5):
    # only numeric columns — KNN can't handle strings
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not num_cols:
        return df, [{"error": "No numeric columns found for KNN"}]
    imputer = KNNImputer(n_neighbors=n_neighbors)
    before_missing = {col: int(df[col].isna().sum()) for col in num_cols}
    df[num_cols] = imputer.fit_transform(df[num_cols])
    report = [{"column": col, "filled": before_missing[col], "method": f"knn (k={n_neighbors})"}
              for col in num_cols if before_missing[col] > 0]
    return df, report

def impute_ctgan(df, epochs=300):
    from ctgan import CTGAN
    # CTGAN trains on complete rows, generates synthetic to fill gaps
    complete = df.dropna()
    if len(complete) < 100:
        return df, [{"error": "Need at least 100 complete rows for CTGAN"}]
    model = CTGAN(epochs=epochs)
    model.fit(complete)
    n_missing_rows = int(df.isna().any(axis=1).sum())
    synthetic = model.sample(n_missing_rows)
    # replace incomplete rows with synthetic equivalents
    incomplete_idx = df[df.isna().any(axis=1)].index
    df.loc[incomplete_idx] = synthetic.values[:len(incomplete_idx)]
    return df, [{"method": "ctgan", "rows_replaced": n_missing_rows, "epochs": epochs}]


@bp.route('/api/impute', methods=['POST'])
def impute():
    method = request.form.get("method", "mean")  # mean | median | mode | knn | ctgan
    output_format = request.form.get("output_format", "csv")

    # load from job_id (already cleaned) or fresh file
    job_id_src = request.form.get("job_id")
    if job_id_src:
        from store import get as get_job
        job = get_job(job_id_src)
        if not job:
            return jsonify({"error": "Source job not found"}), 404
        df = job["df"].copy()
        fname = job["meta"].get("filename", "data")
    else:
        f = request.files.get('file')
        if not f or not allowed(f.filename):
            return jsonify({"error": "Invalid or missing file"}), 400
        df = load_file(f)
        fname = f.filename

    total_missing_before = int(df.isna().sum().sum())

    try:
        if method in ("mean", "median", "mode"):
            df, report = impute_basic(df, method)
        elif method == "knn":
            k = int(request.form.get("k", 5))
            df, report = impute_knn(df, k)
        elif method == "ctgan":
            epochs = int(request.form.get("epochs", 300))
            df, report = impute_ctgan(df, epochs)
        else:
            return jsonify({"error": f"Unknown method: {method}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    total_missing_after = int(df.isna().sum().sum())

    result = {
        "method": method,
        "missing_before": total_missing_before,
        "missing_after": total_missing_after,
        "filled": total_missing_before - total_missing_after,
        "details": report
    }

    new_job_id = str(uuid.uuid4())
    save(new_job_id, df, {"report": result, "output_format": output_format, "filename": fname})

    return jsonify({"job_id": new_job_id, "report": result, **df_preview(df)})


@bp.route('/api/impute/export/<job_id>/<fmt>')
def export(job_id, fmt):
    job = get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    data, mime, ext = export_bytes(job["df"], fmt)
    base = job["meta"]["filename"].rsplit('.', 1)[0]
    return send_file(io.BytesIO(data), mimetype=mime,
                     as_attachment=True, download_name=f"{base}_imputed.{ext}")
