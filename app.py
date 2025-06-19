from flask import Flask, request, send_file, jsonify
from io import BytesIO
from datetime import datetime
import tempfile
import os

try:
    from fpdf import FPDF
except ImportError:
    raise ImportError("You must install fpdf: pip install fpdf")

app = Flask(__name__)

@app.route("/export-pdf", methods=["POST"])
def export_pdf():
    data = request.get_json()
    job = data["job"]
    records = data["records"]
    # Create PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 12, f"Time Records - {job['name']}", ln=1, align='C')
    pdf.set_font("Arial", "", 11)
    pdf.cell(0, 8, f"Salary: {job['currency']}{job['salary']} / {'hr' if job['payment_type']=='hour' else 'month'}", ln=1)
    pdf.cell(0, 8, f"Period: {job['period'].capitalize()}", ln=1)
    pdf.ln(4)

    # Table header
    pdf.set_font("Arial", "B", 11)
    pdf.cell(30, 8, "Date", 1)
    pdf.cell(22, 8, "Start", 1)
    pdf.cell(22, 8, "End", 1)
    pdf.cell(22, 8, "Break", 1)
    pdf.cell(18, 8, "Type", 1)
    pdf.cell(20, 8, "Closed", 1)
    pdf.cell(24, 8, "Hours", 1)
    pdf.cell(24, 8, "Earnings", 1)
    pdf.ln()
    pdf.set_font("Arial", "", 10)
    for r in records:
        mins = (parse_time(r['end']) - parse_time(r['start'])) - int(r.get('break',0))
        h = mins/60 if mins>0 else 0
        if job['payment_type'] == "hour":
            earn = h * float(job['salary'])
        else:
            earn = float(job['salary'])
        pdf.cell(30, 8, r['date'], 1)
        pdf.cell(22, 8, r['start'], 1)
        pdf.cell(22, 8, r['end'], 1)
        pdf.cell(22, 8, str(r.get('break',0)), 1)
        pdf.cell(18, 8, "Manual" if r.get('isManual') else "Clock", 1)
        pdf.cell(20, 8, "Yes" if r.get('closed') else "No", 1)
        pdf.cell(24, 8, "{:.2f}".format(h), 1)
        pdf.cell(24, 8, "{:.2f}".format(earn), 1)
        pdf.ln()
    # Save to temp file
    pdf_bytes = BytesIO()
    pdf.output(pdf_bytes)
    pdf_bytes.seek(0)
    return send_file(pdf_bytes, as_attachment=True,
        download_name=f"{job['name'].replace(' ','_')}_records.pdf",
        mimetype="application/pdf")

def parse_time(t):
    h, m = [int(x) for x in t.split(":")]
    return h*60 + m

if __name__ == "__main__":
    app.run(debug=True)