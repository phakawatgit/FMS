from io import BytesIO
from datetime import datetime

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

app = FastAPI(title="FMS Reports")


@app.get("/health")
def health():
    return {"ok": True, "service": "fms-reports"}


@app.post("/reports/excel")
def export_excel():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Duty shifts"
    sheet.append(["Date", "Nurse", "Color", "Affiliation"])
    sheet.append([datetime.now().date().isoformat(), "", "", ""])
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=fms-duty-shifts.xlsx"})


@app.post("/reports/pdf")
def export_pdf():
    output = BytesIO()
    document = canvas.Canvas(output, pagesize=A4)
    document.setTitle("FMS Duty Shifts")
    document.setFont("Helvetica-Bold", 18)
    document.drawString(48, 790, "FMS Duty Shifts")
    document.setFont("Helvetica", 11)
    document.drawString(48, 765, f"Generated: {datetime.now().isoformat(timespec='minutes')}")
    document.drawString(48, 735, "Date                 Nurse                 Color                 Affiliation")
    document.save()
    output.seek(0)
    return StreamingResponse(output, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=fms-duty-shifts.pdf"})
