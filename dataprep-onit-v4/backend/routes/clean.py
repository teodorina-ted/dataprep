from flask import Blueprint, request, jsonify, send_file
import uuid, io, json, os, re
from datetime import datetime
import numpy as np
import pandas as pd
from utils import allowed, load_file, load_sql, export_bytes, df_preview
from store import save, get
from teams import notify

bp = Blueprint('clean', __name__)
HISTORY_DIR = "history"
os.makedirs(HISTORY_DIR, exist_ok=True)

# -- PII detection --
PII_PATTERNS = {
    "email": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    "phone": r'(\+?\d{1,3}[\s-]?)?\d{3}[\s-]?\d{3,4}[\s-]?\d{3,4}',
    "tax_id": r'\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b',  # Italian codice fiscale
    "iban": r'\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b',
}
PII_NAME_HINTS = ['name', 'nome', 'cognome', 'surname', 'patient', 'paziente',
                  'customer', 'cliente', 'contact', 'contatto', 'person']

def detect_pii(df):
    warnings = []
    for col in df.columns:
        col_lower = col.lower()
        # check column name hints
        if any(hint in col_lower for hint in PII_NAME_HINTS):
            warnings.append({"column": col, "type": "name", "reason": "Column name suggests personal names"})
            continue
        # check content patterns
        sample = df[col].dropna().astype(str).head(50)
        for pii_type, pattern in PII_PATTERNS.items():
            matches = sample.str.contains(pattern, regex=True, na=False).sum()
            if matches > len(sample) * 0.3:
                warnings.append({"column": col, "type": pii_type,
                                "reason": f"{matches}/{len(sample)} samples match {pii_type} pattern"})
                break
    return warnings


# -- scan only (no changes) --
def scan_df(df, opts):
    issues = []
    original = (len(df), len(df.columns))

    # column names
    if opts.get("standardize_columns", True):
        old = list(df.columns)
        new_cols = (df.columns.str.strip().str.lower()
                    .str.replace(r'[\s\-\.]+', '_', regex=True)
                    .str.replace(r'[^\w]', '', regex=True))
        changed = [(o, n) for o, n in zip(old, new_cols) if o != n]
        if changed:
            issues.append({"type": "column_rename", "description": f"Will rename {len(changed)} column(s)",
                          "details": [{"from": o, "to": n} for o, n in changed], "fixable": True})

    # duplicates
    if opts.get("remove_duplicates", True):
        n_dupes = int(df.duplicated().sum())
        if n_dupes:
            issues.append({"type": "duplicates", "description": f"Found {n_dupes} duplicate row(s)",
                          "details": [], "fixable": True})

    # type issues
    if opts.get("fix_types", True):
        fixes = []
        for col in df.columns:
            if str(df[col].dtype) == 'object':
                num = pd.to_numeric(df[col], errors='coerce')
                if num.notna().sum() > df[col].notna().sum() * 0.7:
                    fixes.append({"column": col, "from": "text", "to": "numeric"})
                else:
                    try:
                        dt = pd.to_datetime(df[col], errors='coerce', infer_datetime_format=True)
                        if dt.notna().sum() > df[col].notna().sum() * 0.7:
                            fixes.append({"column": col, "from": "text", "to": "datetime"})
                    except: pass
        if fixes:
            issues.append({"type": "type_inference", "description": f"Can fix types in {len(fixes)} column(s)",
                          "details": fixes, "fixable": True})

    # missing values per column
    missing = []
    for col in df.columns:
        n = int(df[col].isna().sum())
        if n:
            is_num = pd.api.types.is_numeric_dtype(df[col]) or pd.to_numeric(df[col], errors='coerce').notna().sum() > df[col].notna().sum() * 0.5
            missing.append({"column": col, "missing_count": n, "is_numeric": is_num})
    if missing:
        total = sum(e["missing_count"] for e in missing)
        issues.append({"type": "missing_values", "description": f"{total} missing value(s) in {len(missing)} column(s)",
                      "details": missing, "fixable": True})

    # outliers
    if opts.get("detect_outliers", True):
        out = []
        for col in df.select_dtypes(include=[np.number]).columns:
            Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            IQR = Q3 - Q1
            lo, hi = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
            n = int(((df[col] < lo) | (df[col] > hi)).sum())
            if n:
                out.append({"column": col, "outlier_count": n,
                           "lower_bound": round(float(lo), 4), "upper_bound": round(float(hi), 4)})
        if out:
            issues.append({"type": "outliers", "description": f"Outliers in {len(out)} numeric column(s)",
                          "details": out, "fixable": False})

    # whitespace
    if opts.get("trim_whitespace", True):
        ws_cols = []
        for col in df.select_dtypes(include=['object']).columns:
            if df[col].dropna().str.contains(r'^\s|\s$', regex=True).any():
                ws_cols.append(col)
        if ws_cols:
            issues.append({"type": "whitespace", "description": f"Whitespace in {len(ws_cols)} text column(s)",
                          "details": [{"column": c} for c in ws_cols], "fixable": True})

    # PII
    pii = detect_pii(df)
    if pii:
        issues.append({"type": "pii_warning", "description": f"⚠ {len(pii)} column(s) may contain personal data (GDPR)",
                      "details": pii, "fixable": False})

    return issues


# -- apply cleaning --
def clean_df(df, opts, missing_strategies=None):
    ops = []
    changes_log = []  # cell-level audit
    original = (len(df), len(df.columns))

    # 1. columns
    if opts.get("standardize_columns", True):
        old = list(df.columns)
        df.columns = (df.columns.str.strip().str.lower()
                      .str.replace(r'[\s\-\.]+', '_', regex=True)
                      .str.replace(r'[^\w]', '', regex=True))
        changed = [(o, n) for o, n in zip(old, df.columns) if o != n]
        if changed:
            ops.append({"type": "column_rename", "description": f"Renamed {len(changed)} column(s)",
                       "details": [{"from": o, "to": n} for o, n in changed]})
            for o, n in changed:
                changes_log.append({"action": "rename_column", "from": o, "to": n})

    # 2. duplicates
    if opts.get("remove_duplicates", True):
        before = len(df)
        dupe_mask = df.duplicated()
        dupe_indices = list(df[dupe_mask].index)
        df = df.drop_duplicates()
        removed = before - len(df)
        if removed:
            ops.append({"type": "duplicates", "description": f"Removed {removed} duplicate row(s)", "details": []})
            changes_log.append({"action": "remove_duplicates", "rows_removed": removed, "indices": dupe_indices[:20]})

    # 3. types
    if opts.get("fix_types", True):
        fixes = []
        for col in df.columns:
            orig = str(df[col].dtype)
            if orig == 'object':
                num = pd.to_numeric(df[col], errors='coerce')
                if num.notna().sum() > df[col].notna().sum() * 0.7:
                    df[col] = num
                    fixes.append({"column": col, "from": orig, "to": str(df[col].dtype)})
                else:
                    try:
                        dt = pd.to_datetime(df[col], errors='coerce', infer_datetime_format=True)
                        if dt.notna().sum() > df[col].notna().sum() * 0.7:
                            df[col] = dt
                            fixes.append({"column": col, "from": orig, "to": "datetime"})
                    except: pass
        if fixes:
            ops.append({"type": "type_inference", "description": f"Fixed types in {len(fixes)} column(s)", "details": fixes})
            for f in fixes:
                changes_log.append({"action": "fix_type", "column": f["column"], "from": f["from"], "to": f["to"]})

    # 4. missing values — per-column strategies
    if not missing_strategies:
        missing_strategies = {}
    default_num = missing_strategies.get("_default_numeric", "flag")
    default_text = missing_strategies.get("_default_text", "flag")

    missing_report = []
    for col in df.columns:
        n = int(df[col].isna().sum())
        if n == 0:
            continue
        is_num = pd.api.types.is_numeric_dtype(df[col])
        strategy = missing_strategies.get(col, default_num if is_num else default_text)
        entry = {"column": col, "missing_count": n}

        if strategy == "drop_rows":
            df = df.dropna(subset=[col])
            entry["action"] = "rows dropped"
        elif strategy == "fill_mean" and is_num:
            v = round(df[col].mean(), 4)
            df[col] = df[col].fillna(v)
            entry["action"] = f"filled mean ({v})"
        elif strategy == "fill_median" and is_num:
            v = round(df[col].median(), 4)
            df[col] = df[col].fillna(v)
            entry["action"] = f"filled median ({v})"
        elif strategy == "fill_mode":
            v = df[col].mode()
            if not v.empty:
                df[col] = df[col].fillna(v[0])
                entry["action"] = f"filled mode ({v[0]})"
        else:
            entry["action"] = "flagged"

        missing_report.append(entry)
        if entry["action"] != "flagged":
            changes_log.append({"action": "fill_missing", "column": col, "count": n, "strategy": entry["action"]})

    if missing_report:
        total = sum(e["missing_count"] for e in missing_report)
        ops.append({"type": "missing_values", "description": f"{total} missing value(s) in {len(missing_report)} column(s)",
                    "details": missing_report})

    # 5. outliers
    if opts.get("detect_outliers", True):
        out = []
        for col in df.select_dtypes(include=[np.number]).columns:
            Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            IQR = Q3 - Q1
            lo, hi = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
            n = int(((df[col] < lo) | (df[col] > hi)).sum())
            if n:
                out.append({"column": col, "outlier_count": n,
                           "lower_bound": round(float(lo), 4), "upper_bound": round(float(hi), 4)})
        if out:
            ops.append({"type": "outliers", "description": f"Outliers in {len(out)} numeric column(s)", "details": out})

    # 6. whitespace
    if opts.get("trim_whitespace", True):
        str_cols = list(df.select_dtypes(include=['object']).columns)
        trimmed = []
        for col in str_cols:
            mask = df[col].dropna().str.contains(r'^\s|\s$', regex=True)
            if mask.any():
                trimmed.append(col)
            df[col] = df[col].str.strip()
        if trimmed:
            ops.append({"type": "whitespace", "description": f"Trimmed whitespace in {len(trimmed)} text column(s)", "details": []})
            changes_log.append({"action": "trim_whitespace", "columns": trimmed})

    report = {
        "original_rows": original[0], "original_cols": original[1],
        "final_rows": len(df), "final_cols": len(df.columns),
        "rows_removed": original[0] - len(df),
        "operations": ops
    }
    return df, report, changes_log


def save_history(job_id, filename, report, changes_log, pii_warnings):
    entry = {
        "job_id": job_id,
        "timestamp": datetime.now().isoformat(),
        "filename": filename,
        "report": report,
        "changes": changes_log,
        "pii_warnings": pii_warnings
    }
    path = os.path.join(HISTORY_DIR, f"{job_id}.json")
    with open(path, 'w') as f:
        json.dump(entry, f, indent=2, default=str)


# -- STEP 1: scan only, no changes --
@bp.route('/api/clean/scan', methods=['POST'])
def scan():
    opts = {k: request.form.get(k, "true") == "true"
            for k in ["standardize_columns", "remove_duplicates", "fix_types",
                      "detect_outliers", "trim_whitespace"]}
    try:
        if request.form.get("sql_mode") == "true":
            df = load_sql(request.form.get("connection_string", ""),
                          request.form.get("sql_query", "SELECT * FROM data"))
            fname = "sql_query"
        else:
            f = request.files.get('file')
            if not f or not allowed(f.filename):
                return jsonify({"error": "Invalid or missing file"}), 400
            fname = f.filename
            df = load_file(f)

        issues = scan_df(df, opts)
        pii = [i for i in issues if i["type"] == "pii_warning"]

        # store raw df for the apply step
        scan_id = str(uuid.uuid4())
        save(scan_id, df, {"filename": fname, "scan": True})

        return jsonify({
            "scan_id": scan_id,
            "filename": fname,
            "issues": issues,
            "pii_warnings": pii,
            **df_preview(df)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- STEP 2: apply after approval --
@bp.route('/api/clean/apply', methods=['POST'])
def apply_clean():
    scan_id = request.json.get("scan_id")
    opts = request.json.get("options", {})
    missing_strategies = request.json.get("missing_strategies", {})
    output_format = request.json.get("output_format", "csv")

    job = get(scan_id)
    if not job:
        return jsonify({"error": "Scan not found. Re-upload file."}), 404

    df = job["df"].copy()
    fname = job["meta"]["filename"]

    cleaned, report, changes_log = clean_df(df, opts, missing_strategies)
    report["filename"] = fname
    report["output_format"] = output_format

    pii = detect_pii(cleaned)

    job_id = str(uuid.uuid4())
    save(job_id, cleaned, {"report": report, "output_format": output_format, "filename": fname})
    save_history(job_id, fname, report, changes_log, pii)
    notify(fname, report, output_format)

    return jsonify({"job_id": job_id, "report": report, "changes_log": changes_log,
                    "pii_warnings": pii, **df_preview(cleaned)})


# -- history --
@bp.route('/api/clean/history')
def history():
    files = sorted(os.listdir(HISTORY_DIR), reverse=True)[:50]
    entries = []
    for f in files:
        with open(os.path.join(HISTORY_DIR, f)) as fh:
            entries.append(json.load(fh))
    return jsonify(entries)


# -- export (unchanged) --
@bp.route('/api/clean/export/<job_id>/<fmt>')
def export(job_id, fmt):
    job = get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    data, mime, ext = export_bytes(job["df"], fmt)
    base = job["meta"]["filename"].rsplit('.', 1)[0]
    return send_file(io.BytesIO(data), mimetype=mime,
                     as_attachment=True, download_name=f"{base}_cleaned.{ext}")
