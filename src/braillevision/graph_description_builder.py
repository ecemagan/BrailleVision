from __future__ import annotations

from braillevision.graph_segmenter import build_graph_segments


def _is_turkish(locale: str) -> bool:
    return str(locale or "").lower().startswith("tr")


def _clean_text(value: object) -> str:
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def _clean_list(values: object) -> list[str]:
    if not isinstance(values, list):
        return []

    return [_clean_text(value) for value in values if _clean_text(value)]


def _fallback_title(payload: dict, locale: str) -> str:
    if _is_turkish(locale):
        return "Grafik açıklaması"

    return "Graph description"


def _graph_type_label(graph_type: str, locale: str) -> str:
    normalized = graph_type.replace("_", " ").strip().lower()
    graph_map_en = {
        "line_graph": "line graph",
        "line graph": "line graph",
        "function_graph": "function graph",
        "function graph": "function graph",
        "coordinate_plane_graph": "coordinate-plane graph",
        "coordinate plane graph": "coordinate-plane graph",
    }
    graph_map_tr = {
        "line_graph": "çizgi grafiği",
        "line graph": "çizgi grafiği",
        "function_graph": "fonksiyon grafiği",
        "function graph": "fonksiyon grafiği",
        "coordinate_plane_graph": "koordinat düzlemi grafiği",
        "coordinate plane graph": "koordinat düzlemi grafiği",
    }

    if _is_turkish(locale):
        return graph_map_tr.get(normalized, normalized or "grafik")

    return graph_map_en.get(normalized, normalized or "graph")


def _has_axis_label(value: str, expected_label: str) -> bool:
    normalized = _clean_text(value).lower()
    return normalized == expected_label or normalized.startswith(expected_label)


def _build_axis_sentence(axis_x: str, axis_y: str, coordinate_plane_present: bool, locale: str) -> str:
    has_x_label = _has_axis_label(axis_x, "x")
    has_y_label = _has_axis_label(axis_y, "y")

    if _is_turkish(locale):
        if has_x_label and has_y_label:
            return "Grafikte etiketlenmiş x ve y eksenleri görülüyor."

        if coordinate_plane_present:
            return "Grafik bir koordinat düzlemi üzerinde gösteriliyor."

        if axis_x and axis_y:
            return f"Grafikte x ekseni için {axis_x} ve y ekseni için {axis_y} bilgisi görülüyor."

        if axis_x:
            return f"Grafikte x ekseni için {axis_x} bilgisi okunuyor."

        if axis_y:
            return f"Grafikte y ekseni için {axis_y} bilgisi okunuyor."

        return ""

    if has_x_label and has_y_label:
        return "The graph includes labeled x and y axes."

    if coordinate_plane_present:
        return "The graph is shown on a coordinate plane."

    if axis_x and axis_y:
        return f"The graph shows {axis_x} on the x-axis and {axis_y} on the y-axis."

    if axis_x:
        return f"The x-axis appears to be labeled as {axis_x}."

    if axis_y:
        return f"The y-axis appears to be labeled as {axis_y}."

    return ""


def _build_trend_sentence(trend: str, is_line_graph: bool, locale: str) -> str:
    normalized = _clean_text(trend).lower()

    if _is_turkish(locale):
        if normalized == "increasing" or normalized == "artan":
            return "Doğru soldan sağa yükseliyor, yani fonksiyon artan."
        if normalized == "decreasing" or normalized == "azalan":
            return "Doğru soldan sağa inerken görülüyor, yani fonksiyon azalan."
        if normalized == "horizontal" or normalized == "yatay":
            return "Doğru yatay görünüyor, yani fonksiyon sabit."
        return "Grafiğin genel eğilimi net seçilemiyor." if not is_line_graph else ""

    if normalized == "increasing":
        return "The line rises from left to right, so the function is increasing."
    if normalized == "decreasing":
        return "The line falls from left to right, so the function is decreasing."
    if normalized == "horizontal":
        return "The line is horizontal, so the function stays constant."
    return "The overall direction of the graph is unclear." if not is_line_graph else ""


def _build_explanation(payload: dict, locale: str) -> str:
    graph_type = _graph_type_label(payload.get("graph_type", ""), locale)
    axis_x = _clean_text(payload.get("axis_x"))
    axis_y = _clean_text(payload.get("axis_y"))
    coordinate_plane_present = bool(payload.get("coordinate_plane_present"))
    equation = _clean_text(payload.get("equation_text"))
    caption = _clean_text(payload.get("caption_text"))
    trend = _clean_text(payload.get("trend_direction"))
    x_intercept = _clean_text(payload.get("x_intercept_text"))
    y_intercept = _clean_text(payload.get("y_intercept_text"))
    notes = _clean_list(payload.get("notes"))
    confidence = _clean_text(payload.get("confidence")) or ("medium" if not _is_turkish(locale) else "orta")
    is_line_graph = graph_type in {"line graph", "çizgi grafiği"}
    is_coordinate_plane = bool(coordinate_plane_present or axis_x or axis_y or is_line_graph)
    axis_sentence = _build_axis_sentence(axis_x, axis_y, coordinate_plane_present, locale)
    trend_sentence = _build_trend_sentence(trend, is_line_graph, locale)

    if _is_turkish(locale):
        sentences = []
        if is_line_graph and is_coordinate_plane:
            sentences.append("Bu grafik x-y koordinat düzleminde çizilmiş bir doğru gösteriyor.")
        elif is_coordinate_plane and graph_type == "koordinat düzlemi grafiği":
            sentences.append("Bu grafik x-y koordinat düzleminde gösteriliyor.")
        else:
            sentences.append(f"Bu grafik {graph_type} olarak yorumlandı.")

        if equation:
            sentences.append(f"Görselde seçilebilen denklem {equation}.")

        if trend_sentence:
            sentences.append(trend_sentence)

        if y_intercept:
            sentences.append(f"Doğru y eksenini {y_intercept} noktasında kesiyor gibi görünüyor.")

        if x_intercept:
            sentences.append(f"Doğru x eksenini {x_intercept} noktasında kesiyor gibi görünüyor.")

        if axis_sentence:
            sentences.append(axis_sentence)

        if caption:
            sentences.append(f"Görünen kısa açıklama veya caption metni {caption}.")

        if notes:
            sentences.append(f"Bu yorum {confidence} güven düzeyindedir. {notes[0]}")

        return " ".join(sentence for sentence in sentences if sentence).strip()

    sentences = []
    if is_line_graph and is_coordinate_plane:
        sentences.append("This graph shows a straight line on an x-y coordinate plane.")
    elif is_coordinate_plane and graph_type == "coordinate-plane graph":
        sentences.append("This graph is shown on an x-y coordinate plane.")
    else:
        sentences.append(f"This graph is interpreted as a {graph_type}.")

    if equation:
        sentences.append(f"The visible equation is {equation}.")

    if trend_sentence:
        sentences.append(trend_sentence)

    if y_intercept:
        sentences.append(f"It crosses the y-axis at {y_intercept}.")

    if x_intercept:
        sentences.append(f"It crosses the x-axis at {x_intercept}.")

    if axis_sentence:
        sentences.append(axis_sentence)

    if caption:
        sentences.append(f"A nearby caption reads {caption}.")

    if notes:
        sentences.append(f"Confidence is {confidence}. {notes[0]}")

    return " ".join(sentence for sentence in sentences if sentence).strip()


def build_graph_result(payload: dict, locale: str, translator) -> dict:
    title = _clean_text(payload.get("title")) or _fallback_title(payload, locale)
    graph_type = _graph_type_label(payload.get("graph_type", ""), locale)
    equation_text = _clean_text(payload.get("equation_text"))
    caption_text = _clean_text(payload.get("caption_text"))
    explanation_text = _build_explanation(payload, locale)
    explanation_braille = translator.translate(explanation_text)
    notes = _clean_list(payload.get("notes"))
    confidence = _clean_text(payload.get("confidence")) or ("medium" if not _is_turkish(locale) else "orta")

    return {
        "title": title,
        "graph_type": graph_type,
        "coordinate_plane_present": bool(payload.get("coordinate_plane_present")),
        "axis_x": _clean_text(payload.get("axis_x")),
        "axis_y": _clean_text(payload.get("axis_y")),
        "trend_direction": _clean_text(payload.get("trend_direction")),
        "x_intercept_text": _clean_text(payload.get("x_intercept_text")),
        "y_intercept_text": _clean_text(payload.get("y_intercept_text")),
        "equation_text": equation_text,
        "caption_text": caption_text,
        "explanation_text": explanation_text,
        "explanation_braille": explanation_braille,
        "notes": notes,
        "confidence": confidence,
        "segments": build_graph_segments(explanation_text, translator),
    }
