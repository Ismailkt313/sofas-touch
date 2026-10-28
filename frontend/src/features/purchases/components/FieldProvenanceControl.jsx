export function FieldSourceBadge({
  meta,
  hasValue,
  ocrActive = false,
  onConfirm,
  disabled = false,
}) {
  if (!meta) {
    return null
  }

  if (meta.confirmed && hasValue) {
    return (
      <span className="pv-prov-tag pv-prov-tag--confirmed">Confirmed</span>
    )
  }

  if (meta.source === 'ocr' && hasValue) {
    return (
      <span className="pv-prov-group">
        <span className="pv-prov-tag pv-prov-tag--ocr">From bill</span>
        {onConfirm ? (
          <button
            type="button"
            className="pv-prov-confirm-btn"
            onClick={onConfirm}
            disabled={disabled}
          >
            Confirm
          </button>
        ) : null}
      </span>
    )
  }

  if (meta.touched && meta.source === 'manual' && ocrActive) {
    return <span className="pv-prov-tag pv-prov-tag--manual">Manual</span>
  }

  return null
}

export function FieldSuggestionBanner({
  suggestion,
  formatValue,
  labelPrefix = 'Detected on bill',
  onAccept,
  onDismiss,
  disabled = false,
}) {
  if (!suggestion || suggestion.value === undefined || suggestion.value === '') {
    return null
  }

  const displayText =
    typeof formatValue === 'function'
      ? formatValue(suggestion.value)
      : String(suggestion.value)

  return (
    <div className="pv-field-suggestion" role="status">
      <span className="pv-field-suggestion__text">
        {labelPrefix}: <strong>{displayText}</strong>
      </span>
      <span className="pv-field-suggestion__actions">
        <button
          type="button"
          className="pv-sug-action pv-sug-action--accept"
          onClick={onAccept}
          disabled={disabled}
        >
          Apply
        </button>
        <button
          type="button"
          className="pv-sug-action pv-sug-action--dismiss"
          onClick={onDismiss}
          disabled={disabled}
        >
          Dismiss
        </button>
      </span>
    </div>
  )
}
