from flask import Blueprint, request, jsonify, send_file
import uuid, io
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from utils import allowed, load_file, export_bytes, df_preview
from store import save, get
import pickle, os

bp = Blueprint('predict', __name__)
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)

MODELS = {
    "linear":   LinearRegression,
    "random_forest": RandomForestRegressor,
    "gradient_boost": GradientBoostingRegressor
}

@bp.route('/api/predict/train', methods=['POST'])
def train():
    job_id_src = request.form.get("job_id")
    target_col = request.form.get("target")        # column to predict
    feature_cols = request.form.get("features", "").split(",")  # columns to use
    model_type = request.form.get("model", "random_forest")
    output_format = request.form.get("output_format", "csv")

    if not target_col:
        return jsonify({"error": "target column required"}), 400

    # load data
    if job_id_src:
        job = get(job_id_src)
        if not job:
            return jsonify({"error": "Source job not found"}), 404
        df = job["df"].copy()
        fname = job["meta"].get("filename", "data")
    else:
        f = request.files.get('file')
        if not f:
            return jsonify({"error": "No file or job_id provided"}), 400
        df = load_file(f)
        fname = f.filename

    # features: use all numeric if none specified
    features = [c.strip() for c in feature_cols if c.strip()] or \
               [c for c in df.select_dtypes(include=[np.number]).columns if c != target_col]

    if target_col not in df.columns:
        return jsonify({"error": f"Column '{target_col}' not found"}), 400

    df = df.dropna(subset=[target_col] + features)
    X = df[features]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    ModelClass = MODELS.get(model_type, RandomForestRegressor)
    model = ModelClass()
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    r2 = float(r2_score(y_test, y_pred))

    # save model to disk
    model_id = str(uuid.uuid4())
    model_path = os.path.join(MODELS_DIR, f"{model_id}.pkl")
    with open(model_path, 'wb') as mf:
        pickle.dump({"model": model, "features": features, "target": target_col}, mf)

    result = {
        "model_id": model_id,
        "model_type": model_type,
        "target": target_col,
        "features": features,
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "accuracy_note": f"R² = {round(r2,4)} (1.0 = perfect, 0 = random)"
    }

    return jsonify(result)


@bp.route('/api/predict/forecast', methods=['POST'])
def forecast():
    """Use trained model to predict on new/future data"""
    model_id = request.form.get("model_id")
    output_format = request.form.get("output_format", "csv")

    model_path = os.path.join(MODELS_DIR, f"{model_id}.pkl")
    if not os.path.exists(model_path):
        return jsonify({"error": "Model not found"}), 404

    with open(model_path, 'rb') as mf:
        saved = pickle.load(mf)

    model = saved["model"]
    features = saved["features"]
    target = saved["target"]

    f = request.files.get('file')
    if not f:
        return jsonify({"error": "Upload new data file to forecast"}), 400

    df = load_file(f)
    fname = f.filename

    missing_features = [c for c in features if c not in df.columns]
    if missing_features:
        return jsonify({"error": f"Missing columns: {missing_features}"}), 400

    df[f"predicted_{target}"] = model.predict(df[features])

    job_id = str(uuid.uuid4())
    save(job_id, df, {"output_format": output_format, "filename": fname,
                      "model_id": model_id, "target": target})

    return jsonify({"job_id": job_id, "model_id": model_id,
                    "predicted_column": f"predicted_{target}", **df_preview(df)})


@bp.route('/api/predict/export/<job_id>/<fmt>')
def export(job_id, fmt):
    job = get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    data, mime, ext = export_bytes(job["df"], fmt)
    base = job["meta"]["filename"].rsplit('.', 1)[0]
    return send_file(io.BytesIO(data), mimetype=mime,
                     as_attachment=True, download_name=f"{base}_predicted.{ext}")
