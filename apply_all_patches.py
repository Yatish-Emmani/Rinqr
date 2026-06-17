#!/usr/bin/env python3
"""
Rinqr SEO Fix — Master Patch Script (Python version for Windows/PowerShell)
Run from your project root: python apply_all_patches.py
"""

import os, sys, shutil

def patch_file(filename, replacements):
    if not os.path.exists(filename):
        print(f"  ✗ SKIPPED — {filename} not found in current directory")
        return
    shutil.copy(filename, filename + '.bak')
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    applied = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            applied += 1
        else:
            print(f"    ⚠ pattern not found (already patched or modified?): {old[:50]!r}...")
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✓ {filename} — {applied}/{len(replacements)} patches applied (backup: {filename}.bak)")


SR_ONLY = ".sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n    "

print("Applying all Rinqr SEO patches...\n")

# ── contact.html ──────────────────────────────────────────
patch_file('contact.html', [
    ('<title>Contact Us — Rinqr</title>',
     '<title>Contact Rinqr — Support &amp; Business Pilots</title>'),
    ('href="mailto:support@getrinqr.com"', 'href="mailto:support@rinqr.com"'),
    ('>support@getrinqr.com →</a>', '>support@rinqr.com →</a>'),
    ('href="mailto:privacy@getrinqr.com"', 'href="mailto:privacy@rinqr.com"'),
    ('>privacy@getrinqr.com →</a>', '>privacy@rinqr.com →</a>'),
])

# ── property.html ─────────────────────────────────────────
patch_file('property.html', [
    (
        'content="Eliminate parking disputes and reduce tows with Rinqr\'s property manager portal. Residents resolve issues directly — no calls to your front desk. Free 60-day pilot."',
        'content="Eliminate parking disputes with Rinqr\'s property manager portal. Residents resolve issues privately — no calls to your desk. Free 60-day pilot."'
    ),
])

# ── dashboard.html ────────────────────────────────────────
patch_file('dashboard.html', [
    ('<title>Rinqr — Dashboard</title>', '<title>My Dashboard — Rinqr Tag Manager</title>'),
    (
        '@media(max-width:720px){.stats-grid{grid-template-columns:repeat(2,1fr)}.two-col{grid-template-columns:1fr}}',
        SR_ONLY + '@media(max-width:720px){.stats-grid{grid-template-columns:repeat(2,1fr)}.two-col{grid-template-columns:1fr}}'
    ),
    ('\n<div class="main">', '\n<h1 class="sr-only">Rinqr Dashboard</h1>\n<div class="main">'),
])

# ── signin.html ───────────────────────────────────────────
patch_file('signin.html', [
    ('<title>Rinqr — Sign In</title>', '<title>Sign In to Your Rinqr Account — Rinqr</title>'),
    (
        '@media (max-width:700px) { .page-wrap{grid-template-columns:1fr}',
        SR_ONLY + '@media (max-width:700px) { .page-wrap{grid-template-columns:1fr}'
    ),
    (
        '      <div class="redirect-notice" id="redirectNotice">',
        '      <h1 class="sr-only">Sign in to Rinqr</h1>\n      <div class="redirect-notice" id="redirectNotice">'
    ),
    ('<h1 class="auth-heading">WELCOME<br>BACK</h1>', '<h2 class="auth-heading">WELCOME<br>BACK</h2>'),
    ('<h1 class="auth-heading">CREATE<br>ACCOUNT</h1>', '<h2 class="auth-heading">CREATE<br>ACCOUNT</h2>'),
])

# ── reset-password.html ───────────────────────────────────
patch_file('reset-password.html', [
    (
        '  <title>Reset Password — Rinqr</title>',
        '  <meta name="robots" content="noindex, nofollow">\n  <link rel="canonical" href="https://rinqr.com/reset-password.html">\n  <title>Reset Password — Rinqr</title>'
    ),
    ('<div class="card-title">Set new password</div>', '<h1 class="card-title">Set new password</h1>'),
    ('<div class="invalid-title">Link expired</div>', '<h2 class="invalid-title">Link expired</h2>'),
    (
        '<div class="invalid-title" style="color:var(--cyan)">Password updated!</div>',
        '<h2 class="invalid-title" style="color:var(--cyan)">Password updated!</h2>'
    ),
])

# ── sticker-generator.html ────────────────────────────────
patch_file('sticker-generator.html', [
    ('<a href="landing.html" class="nav-logo">', '<a href="index.html" class="nav-logo">'),
])

print("\nDone. Replace index.html and scan.html with the provided fixed versions.")
print("Then run: npx wrangler deploy")
