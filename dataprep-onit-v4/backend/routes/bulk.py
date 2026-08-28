from flask import Blueprint, request, jsonify, send_file
import uuid, io
import pandas as pd
from utils import allowed, load_file, export_bytes, df_preview
from store import save, get

bp = Blueprint('bulk', __name__)

@bp.route('/api/bulk/check', methods=['POST'])
def check():
    """Pre-merge column compatibility check"""
    files = request.files.getlist('files')
    if len(files) < 2:
        return jsonify({"error": "Upload at least 2 files"}), 400

    schemas = []
    for f in files:
        if not allowed(f.filename):
            return jsonify({"error": f"Unsupported file: {f.filename}"}), 400
        df = load_file(f)
        schemas.append({
            "filename": f.filename,
            "columns": list(df.columns),
            "rows": len(df),
            "dtypes": {c: str(t) for c, t in df.dtypes.items()}
        })

    # Find column mismatches
    all_cols = [set(s["columns"]) for s in schemas]
    common = set.intersection(*all_cols)
    all_union = set.union(*all_cols)
    extra = all_union - common

    mismatches = []
    for col in extra:
        present_in = [s["filename"] for s in schemas if col in s["columns"]]
        missing_in = [s["filename"] for s in schemas if col not in s["columns"]]
        mismatches.append({"column": col, "present_in": present_in, "missing_in": missing_in})

    return jsonify({
        "schemas": schemas,
        "common_columns": list(common),
        "mismatches": mismatches,
        "compatible": len(mismatches) == 0
    })


@bp.route('/api/bulk/merge', methods=['POST'])
def merge():
    files = request.files.getlist('files')
    strategy = request.form.get("mismatch_strategy", "common_only")
    output_format = request.form.get("output_format", "csv")

    if len(files) < 2:
        return jsonify({"error": "Upload at least 2 files"}), 400

    dfs = []
    filenames = []
    for f in files:
        df = load_file(f)
        df["_source_file"] = f.filename
        dfs.append(df)
        filenames.append(f.filename)

    if strategy == "common_only":
        common = list(set.intersection(*[set(df.columns) for df in dfs]))
        dfs = [df[common] for df in dfs]

    merged = pd.concat(dfs, ignore_index=True)
    report = {
        "files_merged": len(dfs),
        "filenames": filenames,
        "total_rows": len(merged),
        "total_cols": len(merged.columns),
        "strategy": strategy
    }

    job_id = str(uuid.uuid4())
    save(job_id, merged, {"report": report, "output_format": output_format, "filename": "merged"})

    return jsonify({"job_id": job_id, "report": report, **df_preview(merged)})


@bp.route('/api/bulk/export/<job_id>/<fmt>')
def export(job_id, fmt):
    job = get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    data, mime, ext = export_bytes(job["df"], fmt)
    return send_file(io.BytesIO(data), mimetype=mime,
                     as_attachment=True, download_name=f"merged_cleaned.{ext}")
