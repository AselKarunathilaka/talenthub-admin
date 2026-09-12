const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client;
let isReady = false;
let qrCodeData = null;
let connectionStatus = 'INITIALIZING'; // INITIALIZING, DISCONNECTED, WAITING_FOR_SCAN, CONNECTED, ERROR
let connectedNumber = null;
let connectionTime = null;

/**
 * Initializes the WhatsApp Web client
 * This should be called once when the server starts
 */
const initializeWhatsApp = () => {
    console.log('[WhatsApp] Initializing automated client...');
    connectionStatus = 'INITIALIZING';
    qrCodeData = null;
    
    client = new Client({
        // Use LocalAuth to save the session so you don't have to scan the QR code every time
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        console.log('\n======================================================');
        console.log('⚠️  ACTION REQUIRED: LINK WHATSAPP ACCOUNT');
        console.log('Scan this QR code with the WhatsApp app on your phone:');
        qrcode.generate(qr, { small: true });
        console.log('======================================================\n');
        
        qrCodeData = qr;
        connectionStatus = 'WAITING_FOR_SCAN';
    });

    client.on('ready', () => {
        console.log('✅ [WhatsApp] Client is ready and authenticated!');
        isReady = true;
        connectionStatus = 'CONNECTED';
        qrCodeData = null;
        connectedNumber = client.info?.wid?.user || 'Unknown';
        connectionTime = new Date().toISOString();
    });
    
    client.on('disconnected', (reason) => {
        console.log('❌ [WhatsApp] Client was logged out or disconnected:', reason);
        isReady = false;
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
        connectedNumber = null;
        connectionTime = null;
        
        // Optionally auto-reinitialize after a small delay
        setTimeout(() => {
            if (connectionStatus === 'DISCONNECTED') {
               initializeWhatsApp();
            }
        }, 5000);
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ [WhatsApp] Authentication failure:', msg);
        connectionStatus = 'ERROR';
        qrCodeData = null;
    });

    client.initialize().catch(err => {
        console.error('❌ [WhatsApp] Initialization failed:', err);
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
    if (!client) return { success: false, error: "Client not initialized" };
    try {
        await client.logout();
        isReady = false;
        connectionStatus = 'DISCONNECTED';
        qrCodeData = null;
        connectedNumber = null;
        connectionTime = null;
        
        // Wait a brief moment before re-initializing to get a new QR code
        setTimeout(() => {
            initializeWhatsApp();
        }, 2000);
        
        return { success: true };
    } catch (error) {
        // Fallback destroy if logout fails
        try {
            await client.destroy();
            connectionStatus = 'DISCONNECTED';
            setTimeout(() => initializeWhatsApp(), 2000);
            return { success: true };
        } catch (destroyErr) {
            console.error('[WhatsApp Sender] Disconnect failed:', error);
            return { success: false, error: error.message };
        }
    }
};

/**
 * Send a WhatsApp message to a specific phone number.
 */
const sendWhatsAppMessage = async (toPhoneNumber, message) => {
  console.log(`[WhatsApp Sender] Attempting to send WhatsApp message to ${toPhoneNumber}...`);
  console.log(`[WhatsApp Sender] Message Content:\n${message}\n`);

  if (!client || !isReady) {
      console.error('[WhatsApp Sender] Failed: WhatsApp client is not ready. Please check the server terminal and scan the QR code if prompted.');
      return { success: false, error: 'Client not ready' };
  }

  try {
    // Format the phone number to the required format (e.g., 94702443742@c.us)
    // Assumes Sri Lankan numbers start with '0' (e.g., 0702443742 -> 94702443742)
    let formattedNumber = toPhoneNumber.replace(/[^0-9]/g, '');
    if (formattedNumber.startsWith('0')) {
        formattedNumber = '94' + formattedNumber.substring(1);
    } else if (!formattedNumber.startsWith('94') && formattedNumber.length === 9) {
        formattedNumber = '94' + formattedNumber;
    }
    
    const chatId = `${formattedNumber}@c.us`;
    
    // Send the message via the automated headless browser
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
  disconnectWhatsApp
};
