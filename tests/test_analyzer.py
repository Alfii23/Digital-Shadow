"""
tests/test_analyzer.py
Tests for pattern detection and the exposure engine.
All test data is entirely fictional.
"""

import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from analyzer.exposure_engine import run_exposure_analysis
from analyzer.patterns import (
    EMAIL_PATTERN,
    PHONE_PATTERN,
    DATE_OF_BIRTH_PATTERNS,
    ADDRESS_PATTERNS,
    TRACKING_PARAMS,
    IP_PATTERN,
    PUNYCODE_PATTERN,
)


# ── Email pattern tests ───────────────────────────────────────────────────────

class TestEmailPattern:
    def test_detects_standard_email(self):
        assert EMAIL_PATTERN.search("Contact: test@example.com")

    def test_detects_plus_address(self):
        assert EMAIL_PATTERN.search("me+label@fictional-domain.org")

    def test_detects_subdomain_email(self):
        assert EMAIL_PATTERN.search("user@mail.sub.example.co.uk")

    def test_no_match_missing_at(self):
        assert not EMAIL_PATTERN.search("notanemail.com")

    def test_no_match_missing_tld(self):
        assert not EMAIL_PATTERN.search("user@example")

    def test_no_match_plain_word(self):
        assert not EMAIL_PATTERN.search("hello world no email here")


# ── Phone pattern tests ───────────────────────────────────────────────────────

class TestPhonePattern:
    def _has_valid_phone(self, text):
        import re
        matches = PHONE_PATTERN.findall(text)
        return any(len(re.sub(r'\D', '', m)) >= 9 for m in matches)

    def test_detects_international_format(self):
        assert self._has_valid_phone("+44 7700 900123")

    def test_detects_us_format(self):
        assert self._has_valid_phone("(555) 867-5309")

    def test_detects_plain_digits(self):
        assert self._has_valid_phone("07700123456")

    def test_no_match_short_number(self):
        assert not self._has_valid_phone("1234")

    def test_no_match_random_text(self):
        assert not self._has_valid_phone("hello world no numbers here")


# ── Date-of-birth pattern tests ───────────────────────────────────────────────

class TestDOBPattern:
    def _matches_any(self, text):
        return any(p.search(text) for p in DATE_OF_BIRTH_PATTERNS)

    def test_ddmmyyyy_slash(self):
        assert self._matches_any("DOB: 15/03/1992")

    def test_iso_format(self):
        assert self._matches_any("born on 1990-05-22")

    def test_textual_dob(self):
        assert self._matches_any("date of birth: 12 March 1995")

    def test_no_match_plain_text(self):
        assert not self._matches_any("no date information here at all")


# ── Address pattern tests ─────────────────────────────────────────────────────

class TestAddressPattern:
    def _matches_any(self, text):
        return any(p.search(text) for p in ADDRESS_PATTERNS)

    def test_uk_postcode(self):
        assert self._matches_any("London SW1A 2AA")

    def test_us_zip(self):
        assert self._matches_any("New York, NY 10001")

    def test_street_address(self):
        assert self._matches_any("42 Fictional Street, London")

    def test_no_match_generic_sentence(self):
        assert not self._matches_any("this is a normal sentence without an address")


# ── Exposure engine integration tests ────────────────────────────────────────

class TestExposureEngine:
    def _get_rule_ids(self, findings):
        return {f['rule_id'] for f in findings}

    def test_detects_email_in_field(self):
        findings = run_exposure_analysis({'email': 'demo@example-test.com'})
        assert 'CONTACT_EMAIL_IN_TEXT' in self._get_rule_ids(findings)

    def test_detects_email_in_text(self):
        findings = run_exposure_analysis({'profile_text': 'reach me at fake@example-test.org'})
        assert 'CONTACT_EMAIL_IN_TEXT' in self._get_rule_ids(findings)

    def test_detects_phone_in_text(self):
        findings = run_exposure_analysis({'profile_text': 'Call me at +44 7700 900123'})
        assert 'CONTACT_PHONE_IN_TEXT' in self._get_rule_ids(findings)

    def test_detects_dob_in_text(self):
        findings = run_exposure_analysis({'profile_text': 'DOB: 15/03/1992'})
        assert 'PERSONAL_DOB_PATTERN' in self._get_rule_ids(findings)

    def test_detects_address_in_text(self):
        findings = run_exposure_analysis({'profile_text': '42 Fictional Street, London SW1A 2AA'})
        assert 'PERSONAL_ADDRESS_PATTERN' in self._get_rule_ids(findings)

    def test_detects_profile_urls(self):
        findings = run_exposure_analysis({'profile_urls': ['https://twitter.com/testuser_fictional']})
        assert 'PROFILE_URL_PROVIDED' in self._get_rule_ids(findings)

    def test_detects_multiple_urls(self):
        findings = run_exposure_analysis({'profile_urls': [
            'https://a.example.com',
            'https://b.example.com',
            'https://c.example.com',
        ]})
        assert 'PROFILE_MULTIPLE_URLS' in self._get_rule_ids(findings)

    def test_detects_username_reuse(self):
        findings = run_exposure_analysis({
            'username': 'fictional_user',
            'profile_urls': [
                'https://github.com/fictional_user',
                'https://twitter.com/fictional_user',
            ],
        })
        assert 'PROFILE_USERNAME_REUSE' in self._get_rule_ids(findings)

    def test_detects_name_contact_combination(self):
        findings = run_exposure_analysis({
            'username': 'AlexFictional',
            'email': 'alex@example-fictional.com',
        })
        assert 'COMBINATION_NAME_CONTACT' in self._get_rule_ids(findings)

    def test_no_findings_empty_input(self):
        findings = run_exposure_analysis({})
        assert findings == []

    def test_no_email_finding_without_email(self):
        findings = run_exposure_analysis({'username': 'testuser'})
        assert 'CONTACT_EMAIL_IN_TEXT' not in self._get_rule_ids(findings)

    def test_deduplication_prevents_double_count(self):
        """The same rule should appear at most once."""
        findings = run_exposure_analysis({
            'email': 'a@example-fictional.com',
            'profile_text': 'my email is a@example-fictional.com',
        })
        rule_ids = [f['rule_id'] for f in findings]
        assert rule_ids.count('CONTACT_EMAIL_IN_TEXT') == 1

    def test_long_text_does_not_crash(self):
        """Engine must handle text at the maximum configured length."""
        long_text = 'x ' * 4000  # ~8000 chars
        findings = run_exposure_analysis({'profile_text': long_text})
        assert isinstance(findings, list)

    def test_multi_attribute_combination(self):
        findings = run_exposure_analysis({
            'username': 'FictionalPerson',
            'email': 'fictional@example-test.com',
            'profile_text': 'DOB: 01/01/1990, 42 Test Street, London SW1A 2AA',
        })
        assert 'PERSONAL_MULTI_ATTRIBUTE' in self._get_rule_ids(findings)


# ── Document Metadata Analyzer tests ──────────────────────────────────────────

class TestDocumentMetadataAnalyzer:
    def test_sensitive_filename(self):
        from analyzer.metadata_analyzer import analyze_document_metadata
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            findings = analyze_document_metadata(tmp.name, "salary_confidential_2026.pdf")
            rule_ids = [f["rule_id"] for f in findings]
            assert "DOC_SENSITIVE_FILENAME" in rule_ids

    def test_pdf_metadata_extraction(self):
        from analyzer.metadata_analyzer import analyze_document_metadata
        import tempfile
        import pypdf

        writer = pypdf.PdfWriter()
        writer.add_blank_page(width=72, height=72)
        writer.add_metadata({
            "/Author": "Secret Agent",
            "/Producer": "ReportGenerator 4.0",
            "/Title": "Classified Strategy",
        })
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            writer.write(tmp)
            tmp_path = tmp.name

        try:
            findings = analyze_document_metadata(tmp_path, "normal_doc.pdf")
            rule_ids = [f["rule_id"] for f in findings]
            assert "DOC_AUTHOR_METADATA" in rule_ids
            assert "DOC_SOFTWARE_METADATA" in rule_ids
            assert "DOC_TITLE_METADATA" in rule_ids
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def test_clean_document(self):
        from analyzer.metadata_analyzer import analyze_document_metadata
        import tempfile
        import pypdf

        writer = pypdf.PdfWriter()
        writer.add_blank_page(width=72, height=72)
        # Clear default pypdf producer metadata to simulate a sanitized/stripped document
        if hasattr(writer, "_info") and writer._info:
            writer._info.clear()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            writer.write(tmp)
            tmp_path = tmp.name

        try:
            findings = analyze_document_metadata(tmp_path, "clean_sample.pdf")
            assert len(findings) == 0
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

