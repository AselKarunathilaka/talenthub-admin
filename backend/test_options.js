const { generateRegistrationOptions } = require('@simplewebauthn/server');

async function test() {
  try {
    const options = await generateRegistrationOptions({
      rpName: 'Test',
      rpID: 'localhost',
      userID: new Uint8Array(Buffer.from('507f1f77bcf86cd799439011')),
      userName: 'test@test.com',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });
    console.log('Success:', options);
  } catch (error) {
    console.error('Failed:', error);
  }
}
test();
