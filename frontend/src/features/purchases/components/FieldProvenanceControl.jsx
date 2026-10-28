export function FieldSourceBadge({ meta, hasValue }) {
  if (!meta || !hasValue) {
    return null
  }

  if (meta.source === 'ocr' && !meta.touched) {
    return <span className="pv-prov-tag pv-prov-tag--ocr">Autofilled</span>
  }

  return null
}

export function FieldSuggestionBanner({
  suggestion,
  formatValue,
  labelPrefix = 'Bill',
  onAccept,
  onDismiss,
  disabled = false,
}) {
  if (
    !suggestion ||
    suggestion.value === undefined ||
    suggestion.value === ''
  ) {
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
          Use
        </button>
        <button
          type="button"
          className="pv-sug-action pv-sug-action--dismiss"
          onClick={onDismiss}
          disabled={disabled}
          aria-label="Dismiss suggestion"
        >
          Dismiss
        </button>
      </span>
    </div>
  )
}
