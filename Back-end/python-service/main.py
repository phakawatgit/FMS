from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI(title="FMS Python Service", version="1.0.0")


@app.get("/")
def root():
    return {"name": "FMS Python Service", "status": "running"}


@app.get("/health")
def health():
    return {
        "success": True,
        "service": "fms-python-service",
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/reports/preview")
def report_preview(payload: dict):
    """จุดเริ่มต้นสำหรับสร้างรายงานด้วย Python ในขั้นถัดไป"""
    return {
        "success": True,
        "message": "รับข้อมูลสำหรับสร้างรายงานแล้ว",
        "received": payload,
    }
