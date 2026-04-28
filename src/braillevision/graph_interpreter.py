from __future__ import annotations

import math
import re


LINEAR_EQUATION_PATTERN = re.compile(
    r"^(?:y|f\(x\))=([+\-]?)(\d*(?:\.\d+)?)x(?:(\+|\-)(\d+(?:\.\d+)?))?$",
    re.IGNORECASE,
)
CONSTANT_EQUATION_PATTERN = re.compile(
    r"^(?:y|f\(x\))=([+\-]?\d+(?:\.\d+)?)$",
    re.IGNORECASE,
)


def _clean_text(value: object) -> str:
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


def _normalize_equation_text(equation_text: str) -> str:
    normalized = _clean_text(equation_text)
    normalized = normalized.replace("−", "-").replace("—", "-").replace("–", "-")
    normalized = normalized.replace(" ", "")
    return normalized


def _format_number(value: float) -> str:
    if math.isclose(value, round(value), abs_tol=1e-9):
        return str(int(round(value)))

    return f"{value:.2f}".rstrip("0").rstrip(".")


def _parse_linear_equation(equation_text: str) -> dict | None:
    normalized = _normalize_equation_text(equation_text)

    constant_match = CONSTANT_EQUATION_PATTERN.match(normalized)
    if constant_match:
        intercept = float(constant_match.group(1))
        return {
            "is_linear": True,
            "is_horizontal": True,
            "slope": 0.0,
            "intercept": intercept,
            "x_intercept": "" if not math.isclose(intercept, 0.0, abs_tol=1e-9) else "all real x-values",
            "y_intercept": _format_number(intercept),
        }

    linear_match = LINEAR_EQUATION_PATTERN.match(normalized)
    if not linear_match:
        return None

    slope_sign = -1.0 if linear_match.group(1) == "-" else 1.0
    slope_value = linear_match.group(2)
    slope_magnitude = float(slope_value) if slope_value else 1.0
    slope = slope_sign * slope_magnitude

    intercept_sign = linear_match.group(3)
    intercept_value = linear_match.group(4)
    intercept = 0.0

    if intercept_sign and intercept_value:
        intercept = float(intercept_value)
        if intercept_sign == "-":
            intercept *= -1.0

    x_intercept = ""
    if not math.isclose(slope, 0.0, abs_tol=1e-9):
        x_intercept = _format_number((-intercept) / slope)

    return {
        "is_linear": True,
        "is_horizontal": math.isclose(slope, 0.0, abs_tol=1e-9),
        "slope": slope,
        "intercept": intercept,
        "x_intercept": x_intercept,
        "y_intercept": _format_number(intercept),
    }


def _infer_trend_from_slope(slope: float | None) -> str:
    if slope is None:
        return ""

    if slope > 0:
        return "increasing"

    if slope < 0:
        return "decreasing"

    return "horizontal"


def enhance_graph_payload(payload: dict) -> dict:
    enhanced = dict(payload)
    equation_text = _clean_text(payload.get("equation_text"))
    axis_x = _clean_text(payload.get("axis_x"))
    axis_y = _clean_text(payload.get("axis_y"))
    graph_type = _clean_text(payload.get("graph_type"))
    trend_direction = _clean_text(payload.get("trend_direction"))
    x_intercept_text = _clean_text(payload.get("x_intercept_text"))
    y_intercept_text = _clean_text(payload.get("y_intercept_text"))
    notes = payload.get("notes") if isinstance(payload.get("notes"), list) else []
    coordinate_plane_present = bool(payload.get("coordinate_plane_present"))

    parsed_equation = _parse_linear_equation(equation_text) if equation_text else None
    axes_visible = coordinate_plane_present or bool(axis_x or axis_y)
    axes_labeled = axis_x.lower().startswith("x") and axis_y.lower().startswith("y")

    if parsed_equation:
        enhanced["graph_type"] = "line_graph"
        enhanced["trend_direction"] = trend_direction or _infer_trend_from_slope(parsed_equation.get("slope"))
        enhanced["y_intercept_text"] = y_intercept_text or parsed_equation.get("y_intercept", "")

        inferred_x_intercept = parsed_equation.get("x_intercept", "")
        if inferred_x_intercept and inferred_x_intercept != "all real x-values":
            enhanced["x_intercept_text"] = x_intercept_text or inferred_x_intercept

        if not axis_x and axes_visible:
            enhanced["axis_x"] = "x"

        if not axis_y and axes_visible:
            enhanced["axis_y"] = "y"

        if not notes:
            enhanced["notes"] = []
    elif graph_type.lower() == "unclear" and axes_visible:
        enhanced["graph_type"] = "coordinate_plane_graph"

    enhanced["coordinate_plane_present"] = axes_visible
    enhanced["axes_visible"] = axes_visible
    enhanced["axes_labeled"] = axes_labeled

    if not enhanced.get("confidence"):
        enhanced["confidence"] = "medium" if parsed_equation else "low"

    return enhanced
