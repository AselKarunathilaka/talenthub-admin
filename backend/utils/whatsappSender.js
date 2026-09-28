const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

let client;
let isReady = false;
let qrCodeData = null;
let connectionStatus = 'INITIALIZING'; // INITIALIZING, DISCONNECTED, WAITING_FOR_SCAN, AUTHENTICATING, CONNECTED, ERROR
let connectedNumber = null;
let connectionTime = null;

/**
 * Initializes the WhatsApp Web client
 * This should be called once when the server starts
 */
const initializeWhatsApp = async () => {
    console.log('[WhatsApp] Initializing automated client...');
    connectionStatus = 'INITIALIZING';
    qrCodeData = null;
    
    if (client) {
        try {
            await client.destroy();
        } catch (e) {
            console.log('[WhatsApp] Ignored error while destroying previous client.');
        }
        client = null;
    }
    
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        authTimeoutMs: 0,
        qrMaxRetries: 0,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        webVersionCache: { type: 'none' },
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-extensions',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            protocolTimeout: 300000
        }
    });

    client.on('qr', (qr) => {
        console.log('\n======================================================');
        console.log('WARNING: ACTION REQUIRED: LINK WHATSAPP ACCOUNT');
        console.log('Scan this QR code with the WhatsApp app on your phone:');
        qrcode.generate(qr, { small: true });
        console.log('======================================================\n');
        
        qrCodeData = qr;
        connectionStatus = 'WAITING_FOR_SCAN';
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`[WhatsApp] Loading: ${percent}% - ${message}`);
    });

    client.on('authenticated', () => {
        console.log('[WhatsApp] QR scanned & authenticated! Waiting for ready...');
        connectionStatus = 'AUTHENTICATING';
        qrCodeData = null;
    });

    client.on('ready', () => {
        console.log('[WhatsApp] Client is ready and authenticated!');
        isReady = true;
        connectionStatus = 'CONNECTED';
        qrCodeData = null;
        connectedNumber = client.info?.wid?.user || 'Unknown';
        connectionTime = new Date().toISOString();
    });
    
    client.on('disconnected', (reason) => {
        console.log('[WhatsApp] Client was logged out or disconnected:', reason);
        isReady = false;
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
        connectedNumber = null;
        connectionTime = null;
        
        if (reason === 'NAVIGATION' || reason === 'CONFLICT') {
            console.log('[WhatsApp] Transient disconnection, auto-reconnect in 5s...');
            setTimeout(() => {
                initializeWhatsApp().catch(err => console.error('[WhatsApp] Auto-reconnect failed:', err));
            }, 5000);
        }
    });

    client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Authentication failure:', msg);
        connectionStatus = 'ERROR';
        qrCodeData = null;
        
        if (fs.existsSync('./.wwebjs_auth')) {
            try { fs.rmSync('./.wwebjs_auth', { recursive: true, force: true }); } catch (e) {}
        }
        console.log('[WhatsApp] Restarting in 5s after auth_failure...');
        setTimeout(() => {
            initializeWhatsApp().catch(err => console.error('[WhatsApp] Restart failed:', err));
        }, 5000);
    });

    client.initialize().catch(err => {
        console.error('[WhatsApp] Initialization failed:', err);
        connectionStatus = 'ERROR';
    });
};

const getWhatsAppStatus = () => {
    return {
        status: connectionStatus,
        qrCode: qrCodeData,
        connectedNumber: connectedNumber,
        connectionTime: connectionTime
    };
};

const disconnectWhatsApp = async () => {
    if (!client) {
        if (fs.existsSync('./.wwebjs_auth')) {
            try { fs.rmSync('./.wwebjs_auth', { recursive: true, force: true }); } catch (e) {}
        }
        return { success: true, message: "Cleaned up" };
    }
    
    const cleanupAndRestart = (shouldRestart = false) => {
        isReady = false;
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
        connectedNumber = null;
        connectionTime = null;
        
        if (fs.existsSync('./.wwebjs_auth')) {
            try { fs.rmSync('./.wwebjs_auth', { recursive: true, force: true }); } catch (e) {}
        }
        
        if (shouldRestart) {
            setTimeout(() => {
                initializeWhatsApp();
            }, 2000);
        }
    };

    const safeLogout = () => Promise.race([
        client.logout(),
        new Promise(resolve => setTimeout(resolve, 3000))
    ]);

    const safeDestroy = () => Promise.race([
        client.destroy(),
        new Promise(resolve => setTimeout(resolve, 3000))
    ]);

    try {
        await safeLogout();
        cleanupAndRestart(false);
        return { success: true };
    } catch (error) {
        try {
            await safeDestroy();
            cleanupAndRestart(false);
            return { success: true };
        } catch (destroyErr) {
            console.error('[WhatsApp Sender] Disconnect failed:', error);
            cleanupAndRestart(false);
            return { success: true, message: "Forced cleanup" };
        }
    }
};

/**
 * Manually trigger linking (initialization).
 */
const linkWhatsApp = async () => {
    if (connectionStatus === 'WAITING_FOR_SCAN' || connectionStatus === 'CONNECTED' || connectionStatus === 'AUTHENTICATING') {
        return { success: true, message: "Already linking or connected" };
    }
    await initializeWhatsApp();
    return { success: true };
};

/**
 * Send a WhatsApp message to a specific phone number.
 */
const sendWhatsAppMessage = async (toPhoneNumber, message) => {
  console.log(`[WhatsApp Sender] Attempting to send WhatsApp message to ${toPhoneNumber}...`);
  console.log(`[WhatsApp Sender] Message Content:\n${message}\n`);

  if (!client || !isReady) {
      console.error('[WhatsApp Sender] Failed: WhatsApp client is not ready.');
      return { success: false, error: 'Client not ready' };
  }

  try {
    let formattedNumber = toPhoneNumber.replace(/[^0-9]/g, '');
    if (formattedNumber.startsWith('0')) {
        formattedNumber = '94' + formattedNumber.substring(1);
    } else if (!formattedNumber.startsWith('94') && formattedNumber.length === 9) {
        formattedNumber = '94' + formattedNumber;
    }
    
    const chatId = `${formattedNumber}@c.us`;
    await client.sendMessage(chatId, message);
    
    console.log(`[WhatsApp Sender] Successfully sent WhatsApp message to ${toPhoneNumber}.`);
    return { success: true };
  } catch (error) {
    console.error(`[WhatsApp Sender] Failed to send WhatsApp message to ${toPhoneNumber}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  getWhatsAppStatus,
  disconnectWhatsApp,
  linkWhatsApp
};
