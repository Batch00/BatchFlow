// Browser file download helpers.
//
// downloadJson must be called synchronously inside a click handler (before any
// await) so the browser still treats the download as user initiated. Some
// browsers, iOS Safari in particular, drop or prompt for a download that starts
// after an await.

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later, not immediately, so a slow browser still finishes the download.
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Local timestamp for file names: 2026-11-13-153012
export function fileStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
