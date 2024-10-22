const crypto = require('crypto');

const encrypt = (text, secretKey) => {
    try {
        // Generate a random initialization vector (IV)
        const iv = crypto.randomBytes(16);
        
        // Create a cipher using AES-256-CBC algorithm with the provided secret key and IV
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
        
        // Update the cipher with the input text and finalize it to get the encrypted data
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Return an object containing the IV and the encrypted content, both encoded as hexadecimal strings
        return {
            iv: iv.toString('hex'),
            content: encrypted
        };
    } catch (error) {
        console.error("Error encrypting content:", error);
        throw error; // Propagate the error if encryption fails
    }
};

const decrypt = (encryptedContent, secretKey) => {
    try {
        // Parse the IV and encrypted content from the input encryptedContent
        const iv = Buffer.from(encryptedContent.iv, 'hex');
        const content = Buffer.from(encryptedContent.content, 'hex');
        
        // Create a decipher using AES-256-CBC algorithm with the provided secret key and IV
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
        
        // Update the decipher with the encrypted content and finalize it to get the decrypted data
        let decrypted = decipher.update(content);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        // Return the decrypted data as a UTF-8 string
        return decrypted.toString('utf8');
    } catch (error) {
        console.error("Error decrypting content:", error);
        throw error; // Propagate the error if decryption fails
    }
};

module.exports = {
    encrypt,
    decrypt
};
