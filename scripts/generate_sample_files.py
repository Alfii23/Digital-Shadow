"""
scripts/generate_sample_files.py
Generates deterministic test sample files for all 5 security risk tiers:
1. Level 1: Clean (Score 0)
2. Level 2: Low Risk (Score 10)
3. Level 3: Moderate Risk (Score 30-35)
4. Level 4: High Risk (Score 50)
5. Level 5: Critical Risk (Score 85-95)
"""

import io
import os
import pypdf
from docx import Document

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "sample_files")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def build_pdf_with_text(filename, metadata, lines):
    filepath = os.path.join(OUTPUT_DIR, filename)

    # 1. Build uncompressed PDF page with Helvetica text stream
    stream_content = []
    y = 740
    for line in lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream_content.append(f"1 0 0 1 50 {y} Tm ({escaped}) Tj")
        y -= 22
    stream_bytes = ("BT /F1 12 Tf " + " ".join(stream_content) + " ET").encode("latin1", "ignore")

    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    buf.write(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    buf.write(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    buf.write(b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n")
    buf.write(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    buf.write(f"5 0 obj << /Length {len(stream_bytes)} >>\nstream\n".encode("latin1"))
    buf.write(stream_bytes)
    buf.write(b"\nendstream\nendobj\n")
    buf.write(b"xref\n0 6\n0000000000 65535 f \n")
    buf.write(b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF")
    buf.seek(0)

    # 2. Re-write using pypdf to clean and stamp exact metadata
    reader = pypdf.PdfReader(buf)
    writer = pypdf.PdfWriter()
    writer.add_page(reader.pages[0])

    if hasattr(writer, "_info") and writer._info:
        writer._info.clear()

    if metadata:
        meta = {("/" + k.lstrip("/")): str(v) for k, v in metadata.items()}
        writer.add_metadata(meta)

    with open(filepath, "wb") as f:
        writer.write(f)

    print(f"Generated PDF: {filepath}")
    return filepath


def build_docx_with_text(filename, core_props, paragraphs, clear_all=False):
    filepath = os.path.join(OUTPUT_DIR, filename)
    doc = Document()

    elem = doc.core_properties._element
    if clear_all:
        for child in list(elem):
            elem.remove(child)
    else:
        props = doc.core_properties
        props.author = core_props.get("author", "")
        props.last_modified_by = core_props.get("last_modified_by", "")
        props.title = core_props.get("title", "")
        props.subject = core_props.get("subject", "")
        props.comments = core_props.get("comments", "")
        props.category = core_props.get("category", "")

    for p in paragraphs:
        doc.add_paragraph(p)

    doc.save(filepath)
    print(f"Generated DOCX: {filepath}")
    return filepath


def main():
    # ── Level 1: Clean (Score 0 &middot; Low / Clean Passed) ──────────────────────────
    build_pdf_with_text(
        "01_CLEAN_AUDIT.pdf",
        metadata={},  # completely empty metadata
        lines=[
            "Digital Shadow Privacy Audit - Clean Benchmark Whitepaper",
            "This public document is fully sanitized. No author name, software strings,",
            "phone numbers, dates of birth, or sensitive physical addresses are present.",
            "Baseline audit status: 100% Passed Clean.",
        ],
    )
    build_docx_with_text(
        "01_CLEAN_AUDIT.docx",
        core_props={},
        paragraphs=[
            "Digital Shadow Privacy Audit - Clean Benchmark Whitepaper",
            "This document contains no identifying metadata properties or personal data.",
            "Baseline audit status: 100% Passed Clean.",
        ],
        clear_all=True,
    )

    # ── Level 2: Low Risk (Score 10 &middot; Low Risk) ──────────────────────────────
    build_pdf_with_text(
        "02_LOW_RISK_METADATA.pdf",
        metadata={
            "Producer": "ReportLab PDF Engine 3.6",
            "CreationDate": "D:20261101120000Z",
        },
        lines=[
            "Open Architecture Technical Standard - Draft 2.4",
            "This document contains standard build tool signatures and modification timestamps.",
            "No personal contact information or personal identity numbers are included.",
        ],
    )
    build_docx_with_text(
        "02_LOW_RISK_METADATA.docx",
        core_props={
            "author": "",
            "title": "Open Architecture Specification",
        },
        paragraphs=[
            "Open Architecture Technical Standard - Draft 2.4",
            "Standard technical overview document without individual user traces.",
        ],
    )

    # ── Level 3: Moderate Risk (Score 30 &middot; Moderate Risk) ────────────────────
    build_pdf_with_text(
        "03_MODERATE_RISK_PROFILE.pdf",
        metadata={
            "Author": "Marcus Vance",
            "Producer": "Microsoft Word 16.78",
            "Title": "Quarterly Operations Review",
            "CreationDate": "D:20261110090000Z",
        },
        lines=[
            "Quarterly Operations Review - Executive Summary",
            "Author: Marcus Vance (Engineering Division)",
            "For inquiries regarding this report, contact: mvance@corporate-sample.org",
            "Confidential internal operations summary.",
        ],
    )
    build_docx_with_text(
        "03_MODERATE_RISK_PROFILE.docx",
        core_props={
            "author": "Marcus Vance",
            "title": "Quarterly Operations Review",
        },
        paragraphs=[
            "Quarterly Operations Review",
            "Author: Marcus Vance (Engineering Division)",
            "Contact: mvance@corporate-sample.org",
            "Internal company circulation only.",
        ],
    )

    # ── Level 4: High Risk (Score 50 &middot; High Risk) ────────────────────────────
    build_pdf_with_text(
        "04_HIGH_RISK_CONTACT_LOCATION.pdf",
        metadata={
            "Author": "Elena Rostova",
            "Title": "Executive Relocation and Dispatch Form",
            "Producer": "Acrobat Distiller 21.0",
        },
        lines=[
            "EXECUTIVE RELOCATION DISPATCH FORM",
            "Executive: Elena Rostova",
            "Direct telephone line: +1 (555) 234-8901",
            "Physical primary address: 742 Evergreen Terrace, Springfield, IL 62704",
            "Official contact: elena.rostova@executive-dispatch.org",
        ],
    )
    build_docx_with_text(
        "04_HIGH_RISK_CONTACT_LOCATION.docx",
        core_props={
            "author": "Elena Rostova",
            "title": "Executive Relocation and Dispatch Form",
        },
        paragraphs=[
            "EXECUTIVE RELOCATION DISPATCH FORM",
            "Executive: Elena Rostova",
            "Direct telephone line: +1 (555) 234-8901",
            "Physical primary address: 742 Evergreen Terrace, Springfield, IL 62704",
            "Official contact: elena.rostova@executive-dispatch.org",
        ],
    )

    # ── Level 5: Critical Risk (Score 85+ &middot; Critical Risk) ───────────────────
    build_pdf_with_text(
        "05_CRITICAL_RISK_CONFIDENTIAL_PASSWORDS.pdf",
        metadata={
            "Author": "Root Administrator",
            "Title": "Master Credentials and Identity Vault",
            "Producer": "Adobe Acrobat Pro 2024",
            "CreationDate": "D:20261120000000Z",
        },
        lines=[
            "CONFIDENTIAL MASTER IDENTITY & CREDENTIAL VAULT",
            "Owner: Root Administrator",
            "Verified DOB: 14/05/1984",
            "Direct Private Mobile: +1-555-891-2345",
            "Permanent Residence: 10 Downing Street, London SW1A 2AA",
            "Primary Contact: admin@corporate-vault.net",
            "Master Root Vault Key: Passw0rd!2026#RootToken",
        ],
    )
    build_docx_with_text(
        "05_CRITICAL_RISK_CONFIDENTIAL_PASSWORDS.docx",
        core_props={
            "author": "Root Administrator",
            "title": "Master Credentials and Identity Vault",
        },
        paragraphs=[
            "CONFIDENTIAL MASTER IDENTITY & CREDENTIAL VAULT",
            "Owner: Root Administrator",
            "Verified DOB: 14/05/1984",
            "Direct Private Mobile: +1-555-891-2345",
            "Permanent Residence: 10 Downing Street, London SW1A 2AA",
            "Primary Contact: admin@corporate-vault.net",
            "Master Root Vault Key: Passw0rd!2026#RootToken",
        ],
    )
    print("All sample files generated successfully!")


if __name__ == "__main__":
    main()
