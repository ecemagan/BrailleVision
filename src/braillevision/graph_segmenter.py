from __future__ import annotations

import re
import unicodedata

TOKEN_PATTERN = re.compile(r"\s+|[^\w\s]|[\w\u00C0-\u024F\u0370-\u03FF]+", re.UNICODE)


def build_graph_segments(text: str, translator) -> list[dict]:
    """Create synchronized text/Braille segments for hover and focus mapping."""
    normalized_text = unicodedata.normalize("NFKC", str(text or ""))
    segments: list[dict] = []

    for index, token in enumerate(TOKEN_PATTERN.findall(normalized_text), start=1):
        kind = "space" if token.isspace() else "punctuation" if len(token) == 1 and not token.isalnum() else "word"
        segments.append(
            {
                "id": f"seg_{index}",
                "text": token,
                "braille": token if token.isspace() else translator.translate(token),
                "kind": kind,
                "is_interactive": not token.isspace(),
            }
        )

    return segments
