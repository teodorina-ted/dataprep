from flask import Flask
from flask_cors import CORS
from routes.clean import bp as clean_bp
from routes.bulk import bp as bulk_bp
from routes.impute import bp as impute_bp
from routes.predict import bp as predict_bp
from routes.validate import bp as validate_bp

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

app.register_blueprint(clean_bp)
app.register_blueprint(bulk_bp)
app.register_blueprint(impute_bp)
app.register_blueprint(predict_bp)
app.register_blueprint(validate_bp)

if __name__ == '__main__':
    # port 8080 because Windows blocks 5000
    app.run(debug=True, port=8080)
