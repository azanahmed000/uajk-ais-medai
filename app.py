"""
UAJK AIS Society — MedAI Flask Backend
========================================
Serves the frontend and provides prediction API endpoints
for Heart Disease, Hypertension, and Diabetes models.
"""

import os
import sys
import logging
import traceback
import numpy as np
import joblib
from flask import Flask, send_from_directory, request, jsonify

# ============================================================
# Configuration
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)  # Phone Link folder

# Model paths — check models/ first, then fallback to original locations
MODEL_PATHS = {
    "heart": [
        os.path.join(BASE_DIR, "models", "model.pkl"),
        os.path.join(PROJECT_ROOT, "Trained_Heart_model", "Heart_Disease_Model", "model.pkl"),
    ],
    "hypertension": [
        os.path.join(BASE_DIR, "models", "medai_hypertension_model.pkl"),
        os.path.join(PROJECT_ROOT, "Trained_hypertension_model", "Trained_hypertension_model", "medai_hypertension_model.pkl"),
    ],
    "diabetes_model": [
        os.path.join(BASE_DIR, "models", "Diabetes_RF_model_optimized.pkl"),
        os.path.join(PROJECT_ROOT, "diabetes", "diabetes", "Diabetes_RF_model_optimized.pkl"),
    ],
    "diabetes_scaler": [
        os.path.join(BASE_DIR, "models", "Diabetes_scaler.pkl"),
        os.path.join(PROJECT_ROOT, "diabetes", "diabetes", "Diabetes_scaler.pkl"),
    ],
}

# Heart Disease model — hardcoded StandardScaler params
# Based on the UCI Cleveland Heart Disease dataset statistics
# Features: age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal
HEART_FEATURE_NAMES = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]
HEART_SCALER_MEAN = np.array([54.42052980, 0.00000000, 0.00000000, 131.60264901, 246.50000000, 0.00000000, 0.00000000, 149.56953642, 0.00000000, 1.04304636, 0.00000000, 0.00000000, 0.00000000])
HEART_SCALER_STD  = np.array([9.03297724, 1.00000000, 1.00000000, 17.53429165, 51.66773302, 1.00000000, 1.00000000, 22.86557606, 1.00000000, 1.15952776, 1.00000000, 1.00000000, 1.00000000])

# Hypertension model features (19)
# Features: Age, BMI, Cholesterol, Systolic_BP, Diastolic_BP, Smoking_Status,
#           Alcohol_Intake, Physical_Activity_Level, Family_History, Diabetes,
#           Stress_Level, Salt_Intake, Sleep_Duration, Heart_Rate, LDL, HDL,
#           Triglycerides, Glucose, Gender
HYPER_FEATURE_NAMES = [
    "Age", "BMI", "Cholesterol", "Systolic_BP", "Diastolic_BP",
    "Smoking_Status", "Alcohol_Intake", "Physical_Activity_Level",
    "Family_History", "Diabetes", "Stress_Level", "Salt_Intake",
    "Sleep_Duration", "Heart_Rate", "LDL", "HDL", "Triglycerides",
    "Glucose", "Gender"
]
# Approximate StandardScaler params for hypertension model
# Based on typical population health statistics
HYPER_SCALER_MEAN = np.array([
    45.0, 27.0, 210.0, 125.0, 82.0,
    0.8, 0.7, 1.0,
    0.4, 0.15, 5.0, 1.0,
    7.0, 75.0, 120.0, 55.0, 150.0,
    100.0, 0.5
])
HYPER_SCALER_STD = np.array([
    15.0, 6.0, 45.0, 18.0, 12.0,
    0.8, 0.7, 0.8,
    0.5, 0.36, 2.5, 0.8,
    1.5, 12.0, 35.0, 15.0, 60.0,
    25.0, 0.5
])

# Diabetes features (8)
DIABETES_FEATURE_NAMES = [
    "Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
    "Insulin", "BMI", "DiabetesPedigreeFunction", "Age"
]
DIABETES_THRESHOLD = 0.52  # Custom optimized threshold

# ============================================================
# Logging Setup
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("MedAI")

# ============================================================
# Flask App
# ============================================================
app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["SECRET_KEY"] = "uajk-ais-medai-2026"

# ============================================================
# Model Loading
# ============================================================
models = {}


def find_model_path(key):
    """Find the first existing path for a model key."""
    for path in MODEL_PATHS.get(key, []):
        if os.path.exists(path):
            return path
    return None


def load_models():
    """Load all available ML models at startup."""
    global models

    # --- Heart Disease Model ---
    heart_path = find_model_path("heart")
    if heart_path:
        try:
            models["heart"] = joblib.load(heart_path)
            size_mb = os.path.getsize(heart_path) / (1024 * 1024)
            logger.info(f"[LOADED] Heart Disease model ({size_mb:.1f} MB) from: {heart_path}")
        except Exception as e:
            logger.error(f"[ERROR] Failed to load Heart model: {e}")
    else:
        logger.warning("[WARNING] Heart Disease model not found")

    # --- Diabetes Model + Scaler ---
    diabetes_path = find_model_path("diabetes_model")
    scaler_path = find_model_path("diabetes_scaler")

    if diabetes_path:
        try:
            models["diabetes"] = joblib.load(diabetes_path)
            size_mb = os.path.getsize(diabetes_path) / (1024 * 1024)
            logger.info(f"[LOADED] Diabetes model ({size_mb:.1f} MB) from: {diabetes_path}")
        except Exception as e:
            logger.error(f"[ERROR] Failed to load Diabetes model: {e}")

    if scaler_path:
        try:
            models["diabetes_scaler"] = joblib.load(scaler_path)
            logger.info(f"[LOADED] Diabetes scaler loaded from: {scaler_path}")
        except Exception as e:
            logger.error(f"[ERROR] Failed to load Diabetes scaler: {e}")

    # --- Hypertension Model (large — 678MB, load last) ---
    hyper_path = find_model_path("hypertension")
    if hyper_path:
        size_mb = os.path.getsize(hyper_path) / (1024 * 1024)
        logger.info(f"[LOADING] Hypertension model ({size_mb:.0f} MB) — this may take a moment...")
        try:
            models["hypertension"] = joblib.load(hyper_path)
            logger.info(f"[LOADED] Hypertension model loaded successfully!")
        except Exception as e:
            logger.error(f"[ERROR] Failed to load Hypertension model: {e}")
    else:
        logger.warning("[WARNING] Hypertension model not found")

    logger.info(f"[INFO] Models loaded: {list(models.keys())}")


# ============================================================
# Routes — Static Files
# ============================================================
@app.route("/")
def index():
    """Serve the main SPA."""
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/favicon.ico")
def favicon():
    return "", 204


# ============================================================
# Routes — Health Check
# ============================================================
@app.route("/api/health")
def health():
    """Check which models are loaded."""
    return jsonify({
        "status": "ok",
        "models": {
            "heart": "heart" in models,
            "hypertension": "hypertension" in models,
            "diabetes": "diabetes" in models,
            "diabetes_scaler": "diabetes_scaler" in models,
        }
    })


# ============================================================
# Routes — Prediction API
# ============================================================
@app.route("/api/predict/heart", methods=["POST"])
def predict_heart():
    """Heart Disease prediction endpoint."""
    if "heart" not in models:
        return jsonify({"error": "Heart Disease model not loaded"}), 503

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Extract features in the correct order
        raw_values = np.array([
            float(data.get("age", 0)),
            float(data.get("sex", 0)),
            float(data.get("cp", 0)),
            float(data.get("trestbps", 0)),
            float(data.get("chol", 0)),
            float(data.get("fbs", 0)),
            float(data.get("restecg", 0)),
            float(data.get("thalach", 0)),
            float(data.get("exang", 0)),
            float(data.get("oldpeak", 0)),
            float(data.get("slope", 0)),
            float(data.get("ca", 0)),
            float(data.get("thal", 0)),
        ]).reshape(1, -1)

        # Map categorical features from HTML values
        cp_map = {0: 3, 1: 1, 2: 2, 3: 0}
        restecg_map = {0: 1, 1: 2, 2: 0}
        slope_map = {0: 2, 1: 1, 2: 0}
        thal_map = {0: 2, 1: 1, 2: 3, 3: 0}

        mapped_values = raw_values.copy().astype(float)
        mapped_values[0, 2] = cp_map.get(int(raw_values[0, 2]), 0)
        mapped_values[0, 6] = restecg_map.get(int(raw_values[0, 6]), 0)
        mapped_values[0, 10] = slope_map.get(int(raw_values[0, 10]), 0)
        mapped_values[0, 12] = thal_map.get(int(raw_values[0, 12]), 0)

        # Apply StandardScaler (hardcoded params from training data)
        scaled_values = (mapped_values - HEART_SCALER_MEAN) / HEART_SCALER_STD

        # Predict (Target: 1.0 -> Healthy, 0.0 -> Disease, so predict_proba[:, 0] is disease probability)
        model = models["heart"]
        probabilities = model.predict_proba(scaled_values)[0]
        
        # Risk of disease is probability of class 0
        risk_percent = round(float(probabilities[0]) * 100, 1)
        prediction = 1 if probabilities[0] >= 0.5 else 0

        logger.info(f"Heart prediction: {prediction} (risk: {risk_percent}%)")

        return jsonify({
            "disease": "heart",
            "prediction": prediction,
            "risk_percent": risk_percent,
            "label": "Heart Disease Detected" if prediction == 1 else "No Heart Disease",
            "probabilities": {
                "no_disease": round(float(probabilities[1]) * 100, 1),
                "disease": round(float(probabilities[0]) * 100, 1),
            }
        })

    except Exception as e:
        logger.error(f"Heart prediction error: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict/hypertension", methods=["POST"])
def predict_hypertension():
    """Hypertension prediction endpoint."""
    if "hypertension" not in models:
        return jsonify({"error": "Hypertension model not loaded"}), 503

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Extract features in the exact order the model expects
        raw_values = np.array([
            float(data.get("age", 0)),
            float(data.get("bmi", 0)),
            float(data.get("cholesterol", 0)),
            float(data.get("systolic_bp", 0)),
            float(data.get("diastolic_bp", 0)),
            float(data.get("smoking", 0)),
            float(data.get("alcohol", 0)),
            float(data.get("activity", 0)),
            float(data.get("family_history", 0)),
            float(data.get("diabetes", 0)),
            float(data.get("stress", 0)),
            float(data.get("salt", 0)),
            float(data.get("sleep", 0)),
            float(data.get("heart_rate", 0)),
            float(data.get("ldl", 0)),
            float(data.get("hdl", 0)),
            float(data.get("triglycerides", 0)),
            float(data.get("glucose", 0)),
            float(data.get("gender", 0)),
        ]).reshape(1, -1)

        # Apply StandardScaler (approximate params)
        scaled_values = (raw_values - HYPER_SCALER_MEAN) / HYPER_SCALER_STD

        # Predict
        model = models["hypertension"]
        prediction = int(model.predict(scaled_values)[0])
        probabilities = model.predict_proba(scaled_values)[0]
        risk_percent = round(float(probabilities[1]) * 100, 1)

        logger.info(f"Hypertension prediction: {prediction} (risk: {risk_percent}%)")

        return jsonify({
            "disease": "hypertension",
            "prediction": prediction,
            "risk_percent": risk_percent,
            "label": "Hypertension Risk Detected" if prediction == 1 else "No Hypertension",
            "probabilities": {
                "no_hypertension": round(float(probabilities[0]) * 100, 1),
                "hypertension": round(float(probabilities[1]) * 100, 1),
            }
        })

    except Exception as e:
        logger.error(f"Hypertension prediction error: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict/diabetes", methods=["POST"])
def predict_diabetes():
    """Diabetes prediction endpoint."""
    if "diabetes" not in models:
        return jsonify({"error": "Diabetes model not loaded"}), 503

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Extract features in the exact order
        raw_values = np.array([
            float(data.get("pregnancies", 0)),
            float(data.get("glucose", 0)),
            float(data.get("blood_pressure", 0)),
            float(data.get("skin_thickness", 0)),
            float(data.get("insulin", 0)),
            float(data.get("bmi", 0)),
            float(data.get("dpf", 0)),
            float(data.get("age", 0)),
        ]).reshape(1, -1)

        # Apply the saved StandardScaler
        if "diabetes_scaler" in models:
            scaled_values = models["diabetes_scaler"].transform(raw_values)
            logger.info("Applied saved Diabetes scaler")
        else:
            # Fallback: use raw values (less accurate)
            scaled_values = raw_values
            logger.warning("Diabetes scaler not found — using raw values")

        # Predict using custom threshold (0.52)
        model = models["diabetes"]
        probabilities = model.predict_proba(scaled_values)[0]
        risk_percent = round(float(probabilities[1]) * 100, 1)

        # Apply custom threshold
        prediction = 1 if probabilities[1] >= DIABETES_THRESHOLD else 0

        logger.info(f"Diabetes prediction: {prediction} (risk: {risk_percent}%, threshold: {DIABETES_THRESHOLD})")

        return jsonify({
            "disease": "diabetes",
            "prediction": prediction,
            "risk_percent": risk_percent,
            "label": "Diabetes Risk Detected" if prediction == 1 else "No Diabetes",
            "threshold_used": DIABETES_THRESHOLD,
            "probabilities": {
                "no_diabetes": round(float(probabilities[0]) * 100, 1),
                "diabetes": round(float(probabilities[1]) * 100, 1),
            }
        })

    except Exception as e:
        logger.error(f"Diabetes prediction error: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


# ============================================================
# Error Handlers
# ============================================================
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    print()
    print("=" * 58)
    print("   UAJK AIS Society - MedAI Prediction Server")
    print("=" * 58)
    print()

    load_models()

    print()
    print("=" * 58)
    print("   [SERVER] Server starting at: http://127.0.0.1:5000")
    print("=" * 58)
    print()

    app.run(host="127.0.0.1", port=5000, debug=True)
