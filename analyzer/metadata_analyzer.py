"""
analyzer/metadata_analyzer.py
Extracts and evaluates document metadata and exposed personal content from PDF and DOCX files.

SECURITY REQUIREMENTS:
- Uploaded content is NEVER executed.
- Files are processed in memory or from a secure temp path and immediately deleted.
- The module extracts metadata properties and audits for personal identifying information (PII).
- Temporary files must be deleted by the caller after this module returns.
"""

from __future__ import annotations

import os
import re
from typing import Optional

from analyzer.patterns import (
    ADDRESS_PATTERNS,
    DATE_OF_BIRTH_PATTERNS,
    EMAIL_PATTERN,
    PHONE_PATTERN,
    SENSITIVE_FILENAME_KEYWORDS,
)
from analyzer.recommendations import get_recommendation
from analyzer.risk_scoring import build_finding


def analyze_document_metadata(filepath: str, original_filename: str) -> list[dict]:
    """
    Extract and analyze metadata and personal data from a PDF or DOCX file.

    Args:
        filepath: Absolute path to the securely stored temp file.
        original_filename: The original filename supplied by the user.

    Returns:
        A list of finding dicts.
    """
    findings: list[dict] = []

    # 1. Filename sensitivity check
    findings.extend(_check_filename(original_filename))

    # 2. Extension-based dispatch & metadata extraction
    ext = os.path.splitext(original_filename)[1].lower()
    meta: dict = {}
    text_content: str = ""

    if ext == ".pdf":
        meta, text_content = _extract_pdf_data(filepath)
    elif ext == ".docx":
        meta, text_content = _extract_docx_data(filepath)

    # 3. Analyze extracted metadata fields
    if meta:
        findings.extend(_check_author(meta))
        findings.extend(_check_software(meta))
        findings.extend(_check_timestamps(meta))
        findings.extend(_check_title(meta))

    # 4. Analyze extracted text content for personal data
    if text_content:
        findings.extend(_check_document_text(text_content))

    return findings


# ── Filename check ────────────────────────────────────────────────────────────

def _check_filename(filename: str) -> list[dict]:
    findings = []
    if SENSITIVE_FILENAME_KEYWORDS.search(filename):
        rec = get_recommendation("DOC_SENSITIVE_FILENAME")
        findings.append(
            build_finding(
                rule_id="DOC_SENSITIVE_FILENAME",
                title="Sensitive keyword in document filename",
                category="Sensitive Document Indicators",
                severity="medium",
                evidence=f"Filename: {filename}",
                explanation=(
                    "The document filename contains a term that suggests sensitive content "
                    "(e.g., password, medical, salary). Filenames are visible in directory "
                    "listings, email threads, and cloud storage UIs before a recipient "
                    "opens the file."
                ),
                consequence=(
                    "The nature of the document is disclosed to anyone who can view "
                    "the filename, which may draw unwanted attention."
                ),
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )
    return findings


# ── Author metadata ───────────────────────────────────────────────────────────

def _check_author(meta: dict) -> list[dict]:
    findings = []
    author_fields = ["author", "creator", "last_modified_by", "dc:creator", "dc_creator"]
    authors_found = []
    for field in author_fields:
        val = meta.get(field, "")
        if val and isinstance(val, str) and val.strip():
            authors_found.append(f"{field}: {val.strip()}")

    if authors_found:
        rec = get_recommendation("DOC_AUTHOR_METADATA")
        findings.append(
            build_finding(
                rule_id="DOC_AUTHOR_METADATA",
                title="Author / creator identity in document metadata",
                category="Sensitive Document Indicators",
                severity="medium",
                evidence="; ".join(authors_found),
                explanation=(
                    "The document's embedded metadata contains author or creator "
                    "name information. This data is not visible in the rendered "
                    "document but can be read by anyone with access to the file."
                ),
                consequence=(
                    "The real name or username of the document author may be revealed "
                    "to recipients, even if the document content is intended to be anonymous."
                ),
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )
    return findings


# ── Software metadata ─────────────────────────────────────────────────────────

def _check_software(meta: dict) -> list[dict]:
    findings = []
    software_fields = ["producer", "creator_tool", "application", "dc:format", "xmp_creatortool", "pdf_producer"]
    software_found = []
    for field in software_fields:
        val = meta.get(field, "")
        if val and isinstance(val, str) and val.strip():
            software_found.append(f"{field}: {val.strip()}")

    if software_found:
        rec = get_recommendation("DOC_SOFTWARE_METADATA")
        findings.append(
            build_finding(
                rule_id="DOC_SOFTWARE_METADATA",
                title="Software / application version in document metadata",
                category="Sensitive Document Indicators",
                severity="low",
                evidence="; ".join(software_found),
                explanation=(
                    "The document's metadata includes the name and possibly version "
                    "of the software used to create it. Software version information "
                    "can be used in targeted attack research."
                ),
                consequence=(
                    "An attacker may use this information to identify known "
                    "vulnerabilities in the software version you use."
                ),
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )
    return findings


# ── Timestamp metadata ────────────────────────────────────────────────────────

def _check_timestamps(meta: dict) -> list[dict]:
    findings = []
    ts_fields = ["creationdate", "moddate", "created", "modified"]
    found = []
    for k in ts_fields:
        v = meta.get(k)
        if v and isinstance(v, str) and v.strip():
            found.append(f"{k}: {v.strip()}")
    if found:
        rec = get_recommendation("DOC_TIMESTAMP_METADATA")
        findings.append(
            build_finding(
                rule_id="DOC_TIMESTAMP_METADATA",
                title="Creation / modification timestamp in metadata",
                category="Sensitive Document Indicators",
                severity="low",
                evidence="; ".join(found[:2]),
                explanation=(
                    "Document metadata contains precise creation and modification timestamps, "
                    "often revealing your editing hours, revision cadence, and timezone."
                ),
                consequence="Timestamps can reveal operational schedules and geographic location.",
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )
    return findings


# ── Title metadata ────────────────────────────────────────────────────────────

def _check_title(meta: dict) -> list[dict]:
    findings = []
    title_fields = ["title", "subject", "dc:title", "dc:subject", "dc_title"]
    found = []
    for k in title_fields:
        v = meta.get(k)
        if v and isinstance(v, str) and v.strip() and v.strip().lower() not in ["untitled", "document"]:
            found.append(f"{k}: {v.strip()}")
    if found:
        rec = get_recommendation("DOC_TITLE_METADATA")
        findings.append(
            build_finding(
                rule_id="DOC_TITLE_METADATA",
                title="Document title or subject in metadata",
                category="Sensitive Document Indicators",
                severity="low",
                evidence="; ".join(found[:2]),
                explanation=(
                    "Internal document titles and subjects may expose internal project codes, "
                    "client names, or sensitive document classifications."
                ),
                consequence="Recipients can read the internal title even if omitted from the cover page.",
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )
    return findings


# ── Document text personal data checks ────────────────────────────────────────

def _check_document_text(text: str) -> list[dict]:
    findings = []
    if not text or len(text.strip()) < 5:
        return findings

    # Check for email
    emails = EMAIL_PATTERN.findall(text)
    if emails:
        rec = get_recommendation("DOC_TEXT_EMAIL_EXPOSURE")
        unique_emails = list(dict.fromkeys(emails))[:3]
        findings.append(
            build_finding(
                rule_id="DOC_TEXT_EMAIL_EXPOSURE",
                title="Email address detected in document content",
                category="Contact Info",
                severity="medium",
                evidence=f"Found in text: {', '.join(unique_emails)}",
                explanation="The document text contains direct personal or professional email addresses.",
                consequence="Sharing this document publicly exposes these email addresses to spam and spear-phishing.",
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )

    # Check for phone
    phones = PHONE_PATTERN.findall(text)
    valid_phones = [p.strip() for p in phones if len(re.sub(r"\D", "", p)) >= 9]
    if valid_phones:
        rec = get_recommendation("DOC_TEXT_PHONE_EXPOSURE")
        unique_phones = list(dict.fromkeys(valid_phones))[:2]
        findings.append(
            build_finding(
                rule_id="DOC_TEXT_PHONE_EXPOSURE",
                title="Phone number detected in document content",
                category="Contact Info",
                severity="high",
                evidence=f"Found in text: {', '.join(unique_phones)}",
                explanation="The document contains telephone numbers that can be used for SMS phishing or social engineering.",
                consequence="Phone numbers facilitate SIM-swap attacks and direct targeted social engineering.",
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )

    # Check for DOB (require explicit DOB label or birth indicator in document text)
    dob_pat = re.compile(
        r"(?i)\b(?:dob|date\s+of\s+birth|born\s+(?:on)?|birth\s*date)\s*[:\-]?\s*"
        r"(?:\d{1,2}[\s\-\/\.]\w{3,9}[\s\-\/\.]\d{2,4}|\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4}|\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2})",
    )
    dob_matches = dob_pat.findall(text)
    if dob_matches:
        rec = get_recommendation("DOC_TEXT_DOB_EXPOSURE")
        sample_dob = dob_matches[0] if isinstance(dob_matches[0], str) else str(dob_matches[0])
        findings.append(
            build_finding(
                rule_id="DOC_TEXT_DOB_EXPOSURE",
                title="Date of birth pattern in document content",
                category="Personal Identity",
                severity="high",
                evidence=f"Found in text: {sample_dob}",
                explanation="Full dates of birth are knowledge-based identity verification factors.",
                consequence="Attackers can use dates of birth to impersonate you with financial institutions.",
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )

    # Check for Address (require street address, UK postcode, or labeled postal indicator)
    addr_evidence = None
    if len(ADDRESS_PATTERNS) >= 4:
        street_m = ADDRESS_PATTERNS[3].search(text)
        if street_m:
            addr_evidence = street_m.group(0)

    if not addr_evidence and len(ADDRESS_PATTERNS) >= 2:
        uk_m = ADDRESS_PATTERNS[1].search(text)
        if uk_m:
            addr_evidence = uk_m.group(0)

    if not addr_evidence:
        postal_m = re.search(r"(?i)\b(?:zip|postal|pin|pincode|address)[\s:#-]*(\d{5}(?:-\d{4})?|\d{6})\b", text)
        if postal_m:
            addr_evidence = postal_m.group(0)

    if addr_evidence:
        rec = get_recommendation("DOC_TEXT_ADDRESS_EXPOSURE")
        findings.append(
            build_finding(
                rule_id="DOC_TEXT_ADDRESS_EXPOSURE",
                title="Physical address or postal code in document",
                category="Location Exposure",
                severity="medium",
                evidence=f"Found in text: {addr_evidence}",
                explanation="Physical home or office address indicators were detected in the document body.",
                consequence="Exposing your physical address enables physical security risks and OSINT correlation.",
                recommendation_action=rec["action"],
                recommendation_detail=rec["detail"],
            )
        )

    return findings


# ── PDF extraction ────────────────────────────────────────────────────────────

def _extract_pdf_data(filepath: str) -> tuple[dict, str]:
    """
    Extract PDF metadata and readable text.
    Handles lazy pypdf references while file is open, plus raw string regex fallback.
    """
    meta: dict = {}
    text_parts: list[str] = []

    # 1. Primary: pypdf (file handle MUST remain open while accessing reader.metadata)
    try:
        import pypdf  # type: ignore
        with open(filepath, "rb") as f:
            reader = pypdf.PdfReader(f, strict=False)
            info = reader.metadata
            if info:
                for k, v in info.items():
                    if k:
                        key = str(k).lstrip("/").lower()
                        val = str(v).strip() if v is not None else ""
                        if val:
                            meta[key] = val

            # XMP metadata if available
            try:
                if hasattr(reader, "xmp_metadata") and reader.xmp_metadata:
                    xmp = reader.xmp_metadata
                    for attr in ["dc_creator", "dc_title", "xmp_creatortool", "pdf_producer"]:
                        val = getattr(xmp, attr, None)
                        if val:
                            if isinstance(val, list) and val:
                                meta[attr.replace("_", ":")] = str(val[0])
                            elif isinstance(val, str) and val.strip():
                                meta[attr.replace("_", ":")] = val.strip()
            except Exception:
                pass

            # Extract text from first 10 pages
            try:
                for page in reader.pages[:10]:
                    txt = page.extract_text()
                    if txt:
                        text_parts.append(txt)
            except Exception:
                pass
    except Exception:
        pass

    # 2. Raw fallback: regex parse PDF header/trailers if metadata was missing or pypdf failed
    try:
        with open(filepath, "rb") as f:
            raw_bytes = f.read(300000)
            raw_text = raw_bytes.decode("latin1", errors="ignore")

            for tag in ["author", "creator", "producer", "title", "creationdate", "moddate"]:
                if tag not in meta:
                    m = re.search(r"/" + tag + r"\s*\(([^)]+)\)", raw_text, re.IGNORECASE)
                    if m:
                        meta[tag] = m.group(1).strip()
    except Exception:
        pass

    return meta, " ".join(text_parts)


# ── DOCX extraction ───────────────────────────────────────────────────────────

def _extract_docx_data(filepath: str) -> tuple[dict, str]:
    """
    Extract DOCX core properties and text content.
    """
    meta: dict = {}
    text_parts: list[str] = []

    # 1. Primary: python-docx
    try:
        from docx import Document  # type: ignore
        doc = Document(filepath)
        props = doc.core_properties
        field_map = {
            "author": props.author,
            "last_modified_by": props.last_modified_by,
            "creator": props.author,
            "title": props.title,
            "subject": props.subject,
            "application": getattr(props, "application", None),
            "created": str(props.created) if props.created else None,
            "modified": str(props.modified) if props.modified else None,
        }
        for k, v in field_map.items():
            if v and str(v).strip():
                meta[k] = str(v).strip()

        for p in doc.paragraphs[:50]:
            if p.text:
                text_parts.append(p.text)
    except Exception:
        pass

    # 2. Fallback: direct ZIP XML extraction
    if not meta:
        try:
            import zipfile
            import xml.etree.ElementTree as ET
            with zipfile.ZipFile(filepath, "r") as z:
                if "docProps/core.xml" in z.namelist():
                    core_xml = z.read("docProps/core.xml")
                    root = ET.fromstring(core_xml)
                    for elem in root:
                        tag_name = elem.tag.split("}")[-1].lower()
                        if elem.text and elem.text.strip():
                            meta[tag_name] = elem.text.strip()
                if "word/document.xml" in z.namelist() and not text_parts:
                    doc_xml = z.read("word/document.xml")
                    root = ET.fromstring(doc_xml)
                    text_parts = [elem.text for elem in root.iter() if elem.text]
        except Exception:
            pass

    return meta, " ".join(text_parts)
