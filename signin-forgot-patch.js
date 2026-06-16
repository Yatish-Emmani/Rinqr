// REPLACE the showForgot() function in signin.html with this:

async function showForgot() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!isEmail(email)) {
    document.getElementById('loginEmailField').classList.add('has-error');
    document.getElementById('loginEmail').focus();
    return;
  }

  const btn = document.getElementById('loginBtn');
  const origLabel = btn.textContent;
  btn.textContent = 'Sending reset link…';
  btn.disabled    = true;

  try {
    await fetch('/api/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    // Always show success (prevents enumeration)
    showAlert(`Reset link sent to ${email} — check your inbox`, 'success');
  } catch {
    showAlert('Network error — try again', 'error');
  }

  btn.textContent = origLabel;
  btn.disabled    = false;
}
