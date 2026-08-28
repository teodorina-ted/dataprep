from flask import Blueprint, request, jsonify
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from utils import allowed, load_file
from store import get

bp = Blueprint('validate', __name__)

@bp.route('/api/validate', methods=['POST'])
def validate():
    """Compare saved prediction vs real data that arrived"""
    pred_job_id = request.form.get("prediction_job_id")
    real_file = request.files.get("real_file")

    if not pred_job_id or not real_file:
        return jsonify({"error": "Need prediction_job_id and real_file"}), 400

    pred_job = get(pred_job_id)
    if not pred_job:
        return jsonify({"error": "Prediction job not found"}), 404

    pred_df = pred_job["df"]
    target = pred_job["meta"].get("target", "")
    predicted_col = f"predicted_{target}"

    if predicted_col not in pred_df.columns:
        return jsonify({"error": f"Column '{predicted_col}' not in prediction"}), 400

    real_df = load_file(real_file)

    if target not in real_df.columns:
        return jsonify({"error": f"Column '{target}' not in real data"}), 400

    # align by index
    min_len = min(len(pred_df), len(real_df))
    y_pred = pred_df[predicted_col].iloc[:min_len].values
    y_real = real_df[target].iloc[:min_len].values

    mae = float(mean_absolute_error(y_real, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_real, y_pred)))
    r2 = float(r2_score(y_real, y_pred))
    mape = float(np.mean(np.abs((y_real - y_pred) / np.where(y_real == 0, 1, y_real))) * 100)

    # row by row diff
    comparison = pd.DataFrame({
        "predicted": y_pred,
        "real": y_real,
        "error": np.abs(y_real - y_pred),
        "error_pct": np.abs((y_real - y_pred) / np.where(y_real == 0, 1, y_real)) * 100
    })

    verdict = "good" if r2 > 0.8 else "acceptable" if r2 > 0.5 else "needs_retraining"

    return jsonify({
        "rows_compared": min_len,
        "target": target,
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "mape_pct": round(mape, 2),
        "verdict": verdict,
        "verdict_note": {
            "good": "Model is accurate. Keep using it.",
            "acceptable": "Decent. Collect more data and retrain soon.",
            "needs_retraining": "Model missed too much. Retrain with new real data."
        }[verdict],
        "sample_comparison": comparison.head(10).round(4).to_dict(orient='records')
    })
