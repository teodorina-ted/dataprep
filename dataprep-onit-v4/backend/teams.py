import requests, os
from dotenv import load_dotenv
load_dotenv()

WEBHOOK = os.environ.get("TEAMS_WEBHOOK_URL", "")

def notify(filename: str, report: dict, output_format: str):
    if not WEBHOOK:
        return
    ops = report.get("operations", [])
    summary = "\n".join(f"• {o['description']}" for o in ops) or "• No issues found"
    card = {
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard", "version": "1.4",
                "body": [
                    {"type": "TextBlock", "text": "✅ DataPrep ONIT — Job Complete",
                     "weight": "Bolder", "size": "Medium", "color": "Good"},
                    {"type": "FactSet", "facts": [
                        {"title": "File", "value": filename},
                        {"title": "Rows", "value": f"{report.get('original_rows','?')} → {report.get('final_rows','?')}"},
                        {"title": "Format", "value": output_format.upper()}
                    ]},
                    {"type": "TextBlock", "text": summary, "wrap": True}
                ]
            }
        }]
    }
    try:
        requests.post(WEBHOOK, json=card, timeout=10)
    except Exception:
        pass
