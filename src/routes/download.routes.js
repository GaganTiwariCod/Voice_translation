const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const APK_PATH = path.join(__dirname, '..', '..', 'public', 'downloads', 'MicTranslation.apk');

// Direct APK Download Endpoint
function serveApkDownload(req, res) {
  if (!fs.existsSync(APK_PATH)) {
    return res.status(404).send('APK file not found on server. Please contact administrator.');
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="MicTranslation.apk"');
  
  res.download(APK_PATH, 'MicTranslation.apk', (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Error downloading APK.');
    }
  });
}

router.get('/apk', serveApkDownload);
router.get('/download/apk', serveApkDownload);
router.get('/download-apk', serveApkDownload);

// Landing page with one-click download & installation instructions
router.get(['/', '/download'], (req, res) => {
  const fileExists = fs.existsSync(APK_PATH);
  let fileSizeMb = '53';
  if (fileExists) {
    try {
      const stats = fs.statSync(APK_PATH);
      fileSizeMb = (stats.size / (1024 * 1024)).toFixed(1);
    } catch (_) {}
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mic Translation - Download Android App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #1E1B4B 0%, #0D0F15 50%, #07080B 100%);
      color: #F9FAFB;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background: rgba(22, 25, 34, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      max-width: 480px;
      width: 100%;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 50px -10px rgba(99, 102, 241, 0.2);
    }
    .icon-wrapper {
      width: 88px;
      height: 88px;
      border-radius: 22px;
      background: linear-gradient(135deg, #6366F1 0%, #4338CA 100%);
      margin: 0 auto 20px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.15);
      font-size: 42px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .tagline {
      font-size: 14px;
      color: #9CA3AF;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .badge-row {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .badge {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #C7D2FE;
    }
    .download-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
      color: #FFFFFF;
      text-decoration: none;
      padding: 16px 24px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
      transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px -5px rgba(99, 102, 241, 0.6);
      background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%);
    }
    .download-btn:active {
      transform: translateY(0);
    }
    .install-guide {
      margin-top: 30px;
      text-align: left;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 22px;
    }
    .install-title {
      font-size: 13px;
      font-weight: 700;
      color: #818CF8;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
      text-transform: uppercase;
    }
    .step {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      align-items: flex-start;
    }
    .step-number {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid #6366F1;
      color: #A5B4FC;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .step-text {
      font-size: 13px;
      color: #9CA3AF;
      line-height: 1.5;
    }
    .step-text strong {
      color: #F3F4F6;
    }
    .footer {
      margin-top: 20px;
      font-size: 12px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">
      🎧
    </div>
    <h1>Mic Translation</h1>
    <p class="tagline">Real-Time Streaming Voice Translation Powered by Speech AI</p>

    <div class="badge-row">
      <span class="badge">v1.0.0 Release</span>
      <span class="badge">Android 8.0+</span>
      <span class="badge">~${fileSizeMb} MB</span>
      <span class="badge">Direct Install</span>
    </div>

    <a href="/download/apk" class="download-btn">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
      </svg>
      Download APK for Android
    </a>

    <div class="install-guide">
      <div class="install-title">How to Install on Android</div>
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-text">Tap <strong>Download APK for Android</strong> above.</div>
      </div>
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-text">Open the downloaded file. If Android prompts <em>"Install unknown apps"</em>, allow permission for your browser.</div>
      </div>
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-text">Tap <strong>Install</strong>, connect your headphones, and start translating!</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Mic Translation &bull; Live Voice Streaming Server
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

module.exports = router;
